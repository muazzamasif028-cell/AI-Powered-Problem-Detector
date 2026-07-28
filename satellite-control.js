'use strict';

/**
 * SUPREME PLATFORM v14.0.0 — Satellite Control System
 *
 * Simulates the 72-satellite telemetry constellation: 6 orbital planes x 12
 * satellites. Positions are propagated from a circular-orbit model on read, so
 * `track()` returns a fresh sub-satellite point without a background timer.
 *
 * The simulation is deterministic given a satellite's plane/slot, which keeps
 * fleet views reproducible across restarts.
 */

const { randomUUID } = require('crypto');

const CONSTELLATION = Object.freeze({
  totalSatellites: 72,
  planes: 6,
  satellitesPerPlane: 12,
  altitudeKm: 550,
  inclinationDeg: 53,
  orbitalPeriodMinutes: 95.6,
  earthRadiusKm: 6371,
});

const STATES = Object.freeze(['NOMINAL', 'DEGRADED', 'MAINTENANCE', 'OFFLINE']);

const COMMANDS = Object.freeze({
  PING: { id: 'PING', requiresPermission: false, executionSeconds: 1, description: 'Round-trip liveness check' },
  TELEMETRY_DUMP: { id: 'TELEMETRY_DUMP', requiresPermission: false, executionSeconds: 4, description: 'Download the buffered telemetry window' },
  REORIENT: { id: 'REORIENT', requiresPermission: true, executionSeconds: 12, description: 'Adjust attitude to a new pointing target' },
  DOWNLINK_PRIORITY: { id: 'DOWNLINK_PRIORITY', requiresPermission: true, executionSeconds: 6, description: 'Raise downlink priority for this satellite' },
  FIRMWARE_STAGE: { id: 'FIRMWARE_STAGE', requiresPermission: true, executionSeconds: 30, description: 'Stage a firmware image without activating it' },
  SAFE_MODE: { id: 'SAFE_MODE', requiresPermission: true, executionSeconds: 8, description: 'Enter safe mode and suspend payload operations' },
  RESUME: { id: 'RESUME', requiresPermission: true, executionSeconds: 8, description: 'Exit safe mode and resume payload operations' },
});

const COMMAND_PERMISSION = 'satellite:command';

const GROUND_STATIONS = Object.freeze([
  { id: 'GS-KHI', name: 'Karachi', latitude: 24.86, longitude: 67.0 },
  { id: 'GS-DXB', name: 'Dubai', latitude: 25.2, longitude: 55.27 },
  { id: 'GS-FRA', name: 'Frankfurt', latitude: 50.11, longitude: 8.68 },
  { id: 'GS-IAD', name: 'Ashburn', latitude: 39.04, longitude: -77.49 },
  { id: 'GS-SIN', name: 'Singapore', latitude: 1.35, longitude: 103.82 },
  { id: 'GS-GRU', name: 'Sao Paulo', latitude: -23.55, longitude: -46.63 },
]);

const DEFAULT_OPTIONS = {
  commandHistoryLimit: 1000,
  degradedSlots: [7, 23, 41, 58],
  maintenanceSlots: [12, 66],
  offlineSlots: [31],
};

class SatelliteControlSystem {
  constructor(options = {}) {
    this.name = 'SatelliteControlSystem';
    this.version = '14.0.0';
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.ready = false;
    this.startedAt = null;

    this.constellation = CONSTELLATION;
    this.satellites = new Map();
    this.commandQueue = [];
    this.commandHistory = [];

    this.stats = {
      commandsSent: 0,
      commandsSucceeded: 0,
      commandsFailed: 0,
      commandsRejected: 0,
      trackRequests: 0,
      byCommand: {},
    };
  }

  async initialize() {
    if (this.ready) {
      return this.status();
    }

    console.log('🤫 [SatelliteControlSystem] deploying constellation...');

    this.satellites.clear();

    for (let index = 0; index < CONSTELLATION.totalSatellites; index += 1) {
      const plane = Math.floor(index / CONSTELLATION.satellitesPerPlane) + 1;
      const slot = (index % CONSTELLATION.satellitesPerPlane) + 1;
      const satellite = this._buildSatellite(index, plane, slot);
      this.satellites.set(satellite.satelliteId, satellite);
    }

    this.ready = true;
    this.startedAt = new Date();

    const fleet = this.getFleetStatus();

    console.log(
      `🤫 [SatelliteControlSystem] ready — ${fleet.total} satellites across ` +
        `${CONSTELLATION.planes} plane(s) @ ${CONSTELLATION.altitudeKm}km, ` +
        `nominal=${fleet.byState.NOMINAL} degraded=${fleet.byState.DEGRADED} ` +
        `maintenance=${fleet.byState.MAINTENANCE} offline=${fleet.byState.OFFLINE}`
    );

    return this.status();
  }

  /** Whole-fleet health rollup. */
  getFleetStatus() {
    this._assertReady();

    const satellites = [...this.satellites.values()];
    const byState = STATES.reduce((acc, state) => ({ ...acc, [state]: 0 }), {});
    const byPlane = {};

    let batterySum = 0;
    let signalSum = 0;
    let linkSum = 0;

    for (const satellite of satellites) {
      byState[satellite.state] += 1;

      if (!byPlane[satellite.plane]) {
        byPlane[satellite.plane] = { total: 0, nominal: 0 };
      }
      byPlane[satellite.plane].total += 1;
      if (satellite.state === 'NOMINAL') {
        byPlane[satellite.plane].nominal += 1;
      }

      batterySum += satellite.telemetry.batteryPct;
      signalSum += satellite.telemetry.signalStrengthDbm;
      linkSum += satellite.telemetry.downlinkMbps;
    }

    const operational = byState.NOMINAL + byState.DEGRADED;

    return {
      total: satellites.length,
      operational,
      healthPct: Number(((byState.NOMINAL / satellites.length) * 100).toFixed(2)),
      coveragePct: Number(((operational / satellites.length) * 100).toFixed(2)),
      byState,
      byPlane,
      constellation: CONSTELLATION,
      groundStations: GROUND_STATIONS.length,
      averages: {
        batteryPct: Number((batterySum / satellites.length).toFixed(2)),
        signalStrengthDbm: Number((signalSum / satellites.length).toFixed(2)),
        downlinkMbps: Number((linkSum / satellites.length).toFixed(2)),
      },
      pendingCommands: this.commandQueue.length,
      generatedAt: new Date().toISOString(),
    };
  }

  /** Every satellite, optionally filtered. */
  listSatellites(filter = {}) {
    this._assertReady();

    let satellites = [...this.satellites.values()];

    if (filter.state) {
      const wanted = String(filter.state).toUpperCase();
      satellites = satellites.filter((satellite) => satellite.state === wanted);
    }
    if (filter.plane) {
      const wanted = Number(filter.plane);
      satellites = satellites.filter((satellite) => satellite.plane === wanted);
    }

    return satellites.map((satellite) => this._summarize(satellite));
  }

  /**
   * Current position and telemetry for one satellite.
   * @param {string} satelliteId
   */
  track(satelliteId) {
    this._assertReady();

    const satellite = this._requireSatellite(satelliteId);
    this.stats.trackRequests += 1;

    const position = this._propagate(satellite);
    const visibleFrom = this._visibleGroundStations(position);

    satellite.telemetry.lastContactAt = new Date().toISOString();

    return {
      satelliteId: satellite.satelliteId,
      name: satellite.name,
      state: satellite.state,
      plane: satellite.plane,
      slot: satellite.slot,
      position,
      telemetry: { ...satellite.telemetry },
      visibleFrom,
      inContact: visibleFrom.length > 0,
      trackedAt: new Date().toISOString(),
    };
  }

  /**
   * Send a command to a satellite.
   *
   * Mutating commands require the `satellite:command` permission.
   *
   * @param {object} input
   * @param {string} input.satelliteId
   * @param {string} input.command  One of COMMANDS.
   * @param {object} [input.parameters]
   * @param {object} [user] Caller, checked for the command permission.
   */
  async sendCommand(input = {}, user = null) {
    this._assertReady();

    const satelliteId = input.satelliteId;
    const commandId = String(input.command || '').toUpperCase();
    const command = COMMANDS[commandId];

    if (!command) {
      this.stats.commandsRejected += 1;
      const error = new Error(
        `Unknown command "${commandId}". Expected one of ${Object.keys(COMMANDS).join(', ')}`
      );
      error.code = 'UNKNOWN_COMMAND';
      error.statusCode = 400;
      throw error;
    }

    const satellite = this._requireSatellite(satelliteId);

    if (command.requiresPermission && !this._canCommand(user)) {
      this.stats.commandsRejected += 1;
      const error = new Error(`Command "${commandId}" requires the "${COMMAND_PERMISSION}" permission`);
      error.code = 'COMMAND_FORBIDDEN';
      error.statusCode = 403;
      console.log(
        `🤫 [SatelliteControlSystem] command ${commandId} DENIED on ${satelliteId} ` +
          `for ${user && (user.email || user.userId) ? user.email || user.userId : 'anonymous'}`
      );
      throw error;
    }

    if (satellite.state === 'OFFLINE') {
      this.stats.commandsRejected += 1;
      const error = new Error(`Satellite ${satelliteId} is OFFLINE and cannot accept commands`);
      error.code = 'SATELLITE_OFFLINE';
      error.statusCode = 409;
      throw error;
    }

    const position = this._propagate(satellite);
    const visibleFrom = this._visibleGroundStations(position);

    const record = {
      commandId: `CMD-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`,
      satelliteId: satellite.satelliteId,
      command: commandId,
      description: command.description,
      parameters: input.parameters && typeof input.parameters === 'object' ? input.parameters : {},
      issuedBy: user ? user.email || user.userId || 'system' : 'system',
      relayGroundStation: visibleFrom.length > 0 ? visibleFrom[0].id : null,
      queuedForNextPass: visibleFrom.length === 0,
      status: 'SENT',
      sentAt: new Date().toISOString(),
    };

    this.stats.commandsSent += 1;
    this.stats.byCommand[commandId] = (this.stats.byCommand[commandId] || 0) + 1;

    try {
      const effect = this._applyCommand(satellite, commandId, record.parameters);

      record.status = record.queuedForNextPass ? 'QUEUED' : 'ACKNOWLEDGED';
      record.effect = effect;
      record.executionSeconds = command.executionSeconds;
      record.acknowledgedAt = new Date().toISOString();
      record.roundTripMs = this._roundTripMs(position.altitudeKm);

      this.stats.commandsSucceeded += 1;

      if (record.queuedForNextPass) {
        this.commandQueue.push(record);
      }

      this._pushHistory(record);

      console.log(
        `🤫 [SatelliteControlSystem] ${record.commandId} ${commandId} -> ${satelliteId} ` +
          `${record.status}${record.relayGroundStation ? ` via ${record.relayGroundStation}` : ' (no station in view)'}`
      );

      return record;
    } catch (error) {
      record.status = 'FAILED';
      record.error = error.message;
      record.failedAt = new Date().toISOString();

      this.stats.commandsFailed += 1;
      this._pushHistory(record);

      console.log(`🤫 [SatelliteControlSystem] ${record.commandId} FAILED — ${error.message}`);

      error.statusCode = error.statusCode || 500;
      throw error;
    }
  }

  getCommandHistory(limit = 100, satelliteId = null) {
    const entries = satelliteId
      ? this.commandHistory.filter((entry) => entry.satelliteId === satelliteId)
      : this.commandHistory;
    return entries.slice(0, Math.max(0, limit));
  }

  listCommands() {
    return Object.values(COMMANDS);
  }

  listGroundStations() {
    return [...GROUND_STATIONS];
  }

  status() {
    return {
      engine: this.name,
      version: this.version,
      ready: this.ready,
      startedAt: this.startedAt,
      constellation: CONSTELLATION,
      fleet: this.ready ? this.getFleetStatus() : null,
      commands: Object.keys(COMMANDS),
      commandPermission: COMMAND_PERMISSION,
      stats: this.stats,
    };
  }

  async shutdown() {
    console.log(
      `🤫 [SatelliteControlSystem] shutting down — ${this.satellites.size} satellite(s), ` +
        `${this.commandQueue.length} queued command(s)`
    );
    this.ready = false;
    return { engine: this.name, stopped: true };
  }

  // ---------------------------------------------------------------- internals

  _assertReady() {
    if (!this.ready) {
      throw new Error('SatelliteControlSystem used before initialize()');
    }
  }

  _buildSatellite(index, plane, slot) {
    const globalSlot = index + 1;

    let state = 'NOMINAL';
    if (this.options.offlineSlots.includes(globalSlot)) {
      state = 'OFFLINE';
    } else if (this.options.maintenanceSlots.includes(globalSlot)) {
      state = 'MAINTENANCE';
    } else if (this.options.degradedSlots.includes(globalSlot)) {
      state = 'DEGRADED';
    }

    // Deterministic per-satellite jitter so telemetry looks realistic but stable.
    const jitter = (seed, spread) => Number((((globalSlot * seed) % 100) / 100) * spread);

    const healthFactor = state === 'NOMINAL' ? 1 : state === 'DEGRADED' ? 0.72 : state === 'MAINTENANCE' ? 0.5 : 0;

    return {
      satelliteId: `SAT-${String(globalSlot).padStart(3, '0')}`,
      name: `SUPREME-${plane}${String(slot).padStart(2, '0')}`,
      plane,
      slot,
      globalSlot,
      state,
      launchedAt: new Date(Date.UTC(2024, (globalSlot % 12), 1 + (globalSlot % 27))).toISOString(),
      orbit: {
        altitudeKm: CONSTELLATION.altitudeKm,
        inclinationDeg: CONSTELLATION.inclinationDeg,
        periodMinutes: CONSTELLATION.orbitalPeriodMinutes,
        raanDeg: Number((((plane - 1) * 360) / CONSTELLATION.planes).toFixed(2)),
        phaseDeg: Number((((slot - 1) * 360) / CONSTELLATION.satellitesPerPlane).toFixed(2)),
      },
      telemetry: {
        batteryPct: Number((state === 'OFFLINE' ? 0 : 78 + jitter(7, 20) * healthFactor).toFixed(2)),
        solarInputWatts: Number((state === 'OFFLINE' ? 0 : (1800 + jitter(13, 400)) * healthFactor).toFixed(2)),
        temperatureC: Number((-12 + jitter(3, 40)).toFixed(2)),
        signalStrengthDbm: Number((state === 'OFFLINE' ? -140 : -70 - jitter(11, 25) / healthFactor).toFixed(2)),
        downlinkMbps: Number((state === 'OFFLINE' ? 0 : (420 + jitter(5, 180)) * healthFactor).toFixed(2)),
        uplinkMbps: Number((state === 'OFFLINE' ? 0 : (90 + jitter(17, 40)) * healthFactor).toFixed(2)),
        packetsRelayed: 1000000 + globalSlot * 31337,
        payloadActive: state === 'NOMINAL' || state === 'DEGRADED',
        safeMode: state === 'MAINTENANCE',
        firmwareVersion: '14.0.0',
        stagedFirmwareVersion: null,
        lastContactAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Propagate a circular orbit to "now" and return the sub-satellite point.
   * Not a precision SGP4 model — sufficient for pass planning in the simulator.
   */
  _propagate(satellite) {
    const periodMs = CONSTELLATION.orbitalPeriodMinutes * 60 * 1000;
    const fraction = (Date.now() % periodMs) / periodMs;

    const meanAnomalyDeg = (satellite.orbit.phaseDeg + fraction * 360) % 360;
    const meanAnomalyRad = (meanAnomalyDeg * Math.PI) / 180;
    const inclinationRad = (CONSTELLATION.inclinationDeg * Math.PI) / 180;

    const latitude = Math.asin(Math.sin(inclinationRad) * Math.sin(meanAnomalyRad)) * (180 / Math.PI);

    const argOfLatitude =
      Math.atan2(Math.cos(inclinationRad) * Math.sin(meanAnomalyRad), Math.cos(meanAnomalyRad)) *
      (180 / Math.PI);

    // Subtract Earth's rotation so ground tracks drift west between passes.
    const earthRotationDeg = (Date.now() / (24 * 60 * 60 * 1000)) * 360;
    const longitude = this._wrapLongitude(satellite.orbit.raanDeg + argOfLatitude - earthRotationDeg);

    const orbitalRadiusKm = CONSTELLATION.earthRadiusKm + CONSTELLATION.altitudeKm;
    const velocityKmS = (2 * Math.PI * orbitalRadiusKm) / (CONSTELLATION.orbitalPeriodMinutes * 60);

    return {
      latitude: Number(latitude.toFixed(4)),
      longitude: Number(longitude.toFixed(4)),
      altitudeKm: CONSTELLATION.altitudeKm,
      velocityKmS: Number(velocityKmS.toFixed(3)),
      meanAnomalyDeg: Number(meanAnomalyDeg.toFixed(2)),
      orbitFractionPct: Number((fraction * 100).toFixed(2)),
      epoch: new Date().toISOString(),
    };
  }

  _visibleGroundStations(position) {
    // Central angle within which a 550km satellite clears a 10-degree elevation mask.
    const maxCentralAngleDeg = 15;

    return GROUND_STATIONS.map((station) => {
      const separationDeg = this._greatCircleDeg(
        position.latitude,
        position.longitude,
        station.latitude,
        station.longitude
      );
      return { ...station, separationDeg: Number(separationDeg.toFixed(2)) };
    })
      .filter((station) => station.separationDeg <= maxCentralAngleDeg)
      .sort((a, b) => a.separationDeg - b.separationDeg);
  }

  _greatCircleDeg(lat1, lon1, lat2, lon2) {
    const toRad = (degrees) => (degrees * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

    return (2 * Math.asin(Math.min(1, Math.sqrt(a))) * 180) / Math.PI;
  }

  _wrapLongitude(longitude) {
    let wrapped = longitude % 360;
    if (wrapped > 180) {
      wrapped -= 360;
    }
    if (wrapped < -180) {
      wrapped += 360;
    }
    return wrapped;
  }

  _roundTripMs(altitudeKm) {
    const speedOfLightKmMs = 299.792458;
    return Number(((2 * altitudeKm) / speedOfLightKmMs).toFixed(3));
  }

  _canCommand(user) {
    if (!user || typeof user !== 'object') {
      return false;
    }
    if (Array.isArray(user.permissions) && user.permissions.includes(COMMAND_PERMISSION)) {
      return true;
    }
    return user.role === 'SUPER_ADMIN';
  }

  _applyCommand(satellite, commandId, parameters) {
    switch (commandId) {
      case 'PING':
        satellite.telemetry.lastContactAt = new Date().toISOString();
        return { pinged: true };

      case 'TELEMETRY_DUMP':
        return {
          window: '15m',
          samples: 900,
          sizeMb: Number(((satellite.telemetry.downlinkMbps * 15 * 60) / 8 / 1024).toFixed(2)),
        };

      case 'REORIENT': {
        const pitch = Number(parameters.pitchDeg);
        const yaw = Number(parameters.yawDeg);

        if (!Number.isFinite(pitch) || !Number.isFinite(yaw)) {
          const error = new Error('REORIENT requires numeric "pitchDeg" and "yawDeg" parameters');
          error.code = 'INVALID_COMMAND_PARAMETERS';
          error.statusCode = 400;
          throw error;
        }
        if (Math.abs(pitch) > 45 || Math.abs(yaw) > 45) {
          const error = new Error('REORIENT is limited to +/-45 degrees per manoeuvre');
          error.code = 'COMMAND_OUT_OF_RANGE';
          error.statusCode = 400;
          throw error;
        }

        satellite.attitude = { pitchDeg: pitch, yawDeg: yaw, setAt: new Date().toISOString() };
        return { attitude: satellite.attitude };
      }

      case 'DOWNLINK_PRIORITY':
        satellite.telemetry.downlinkPriority = 'HIGH';
        return { downlinkPriority: 'HIGH' };

      case 'FIRMWARE_STAGE': {
        const version = typeof parameters.version === 'string' ? parameters.version.trim() : '';
        if (!/^\d+\.\d+\.\d+$/.test(version)) {
          const error = new Error('FIRMWARE_STAGE requires a semver "version" parameter');
          error.code = 'INVALID_COMMAND_PARAMETERS';
          error.statusCode = 400;
          throw error;
        }

        satellite.telemetry.stagedFirmwareVersion = version;
        return { staged: version, activated: false };
      }

      case 'SAFE_MODE':
        satellite.state = 'MAINTENANCE';
        satellite.telemetry.safeMode = true;
        satellite.telemetry.payloadActive = false;
        return { state: satellite.state, safeMode: true };

      case 'RESUME':
        satellite.state = 'NOMINAL';
        satellite.telemetry.safeMode = false;
        satellite.telemetry.payloadActive = true;
        return { state: satellite.state, safeMode: false };

      default: {
        const error = new Error(`Command "${commandId}" has no handler`);
        error.code = 'COMMAND_NOT_IMPLEMENTED';
        error.statusCode = 501;
        throw error;
      }
    }
  }

  _requireSatellite(satelliteId) {
    const satellite = this.satellites.get(String(satelliteId || '').toUpperCase());

    if (!satellite) {
      const error = new Error(`Unknown satelliteId "${satelliteId}"`);
      error.code = 'SATELLITE_NOT_FOUND';
      error.statusCode = 404;
      throw error;
    }

    return satellite;
  }

  _summarize(satellite) {
    return {
      satelliteId: satellite.satelliteId,
      name: satellite.name,
      plane: satellite.plane,
      slot: satellite.slot,
      state: satellite.state,
      batteryPct: satellite.telemetry.batteryPct,
      downlinkMbps: satellite.telemetry.downlinkMbps,
      signalStrengthDbm: satellite.telemetry.signalStrengthDbm,
      payloadActive: satellite.telemetry.payloadActive,
      firmwareVersion: satellite.telemetry.firmwareVersion,
      lastContactAt: satellite.telemetry.lastContactAt,
    };
  }

  _pushHistory(record) {
    this.commandHistory.unshift(record);
    if (this.commandHistory.length > this.options.commandHistoryLimit) {
      this.commandHistory.pop();
    }
  }
}

module.exports = { SatelliteControlSystem, CONSTELLATION, COMMANDS, GROUND_STATIONS };
module.exports.default = SatelliteControlSystem;
