'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { io } = require('socket.io-client');

const PORT = 5198;
const BASE_URL = `http://127.0.0.1:${PORT}`;

let server;
let token;

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(url, {
    timeoutMs = 10000,
    intervalMs = 250
} = {}) {
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
        try {
            const response = await fetch(url);

            if (response.ok) {
                return response;
            }
        } catch {
            // Server not ready yet.
        }

        await wait(intervalMs);
    }

    throw new Error(`Timed out waiting for ${url}`);
}

async function jsonFetch(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json();

    return {
        response,
        data
    };
}

before(async () => {
    server = spawn(process.execPath, ['server.js'], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            PORT: String(PORT),
            NEOM_TELEMETRY_MODE: 'SIMULATION',
            NEOM_TELEMETRY_MONGODB: 'false',
            NEOM_TELEMETRY_REDIS: 'false',
            NEOM_TELEMETRY_KAFKA: 'false',
            NODE_ENV: 'test'
        },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';

    server.stdout.on('data', data => {
        const text = data.toString();
        output += text;
        process.stdout.write(text);
    });

    server.stderr.on('data', data => {
        const text = data.toString();
        output += text;
        process.stderr.write(text);
    });

    await waitFor(
        `${BASE_URL}/api/health`,
        { timeoutMs: 10000, intervalMs: 250 }
    );

    const tokenResponse = await fetch(
        `${BASE_URL}/api/auth/dev-token`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                organization: 'NEOM',
                role: 'SUPER_ADMIN'
            })
        }
    );

    if (!tokenResponse.ok) {
        throw new Error(
            `E2E token request failed: HTTP ${tokenResponse.status}\n${output}`
        );
    }

    const tokenData = await tokenResponse.json();

    if (!tokenData.token) {
        throw new Error(
            `E2E token missing from response.\n${output}`
        );
    }

    token = tokenData.token;
});

after(async () => {
    if (!server || server.killed) {
        return;
    }

    server.kill();

    await new Promise(resolve => {
        const timeout = setTimeout(resolve, 2000);

        server.once('exit', () => {
            clearTimeout(timeout);
            resolve();
        });
    });
});

test('GET / returns SUPREME Platform', async () => {
    const { response, data } =
        await jsonFetch(`${BASE_URL}/`);

    assert.equal(response.status, 200);
    assert.equal(data.name, 'SUPREME Platform');
    assert.equal(data.version, '14.0.0');
    assert.equal(data.status, 'RUNNING');
});

test('GET /api/health returns HEALTHY', async () => {
    const { response, data } =
        await jsonFetch(`${BASE_URL}/api/health`);

    assert.equal(response.status, 200);
    assert.equal(data.status, 'HEALTHY');
    assert.equal(typeof data.uptime, 'number');
    assert.equal(typeof data.timestamp, 'string');
});

test('GET /api/dashboard returns operational dashboard', async () => {
    const { response, data } =
        await jsonFetch(`${BASE_URL}/api/dashboard`);

    assert.equal(response.status, 200);
    assert.equal(data.dashboard, 'SUPREME PLATFORM');
    assert.equal(data.version, '14.0.0');
    assert.equal(data.status, 'OPERATIONAL');
    assert.ok(Array.isArray(data.modules));
});

test('NEOM telemetry rejects unauthenticated access', async () => {
    const { response, data } =
        await jsonFetch(
            `${BASE_URL}/api/neom/telemetry/status`
        );

    assert.equal(response.status, 401);
    assert.equal(
        data.error,
        'AUTHENTICATION_REQUIRED'
    );
});

test('NEOM telemetry status reports running ingestion', async () => {
    const { response, data } =
        await jsonFetch(
            `${BASE_URL}/api/neom/telemetry/status`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

    assert.equal(response.status, 200);
    assert.equal(data.status, 'ONLINE');
    assert.equal(data.transport, 'SOCKET_IO');
    assert.equal(data.ingestion, 'RUNNING');
    assert.equal(data.mode, 'SIMULATION');
    assert.ok(
        Array.isArray(data.domains)
    );
    assert.ok(
        Array.isArray(data.zones)
    );
    assert.ok(
        typeof data.metrics === 'object'
    );
});

test('NEOM system telemetry exposes observability data', async () => {
    const { response, data } =
        await jsonFetch(
            `${BASE_URL}/api/neom/telemetry/system`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

    assert.equal(response.status, 200);

    assert.ok(
        data.performance
    );

    assert.ok(
        data.network
    );

    assert.ok(
        data.query
    );

    assert.equal(
        typeof data.performance.uptimeSeconds,
        'number'
    );

    assert.equal(
        typeof data.performance.memory.heapUsed,
        'number'
    );

    assert.equal(
        typeof data.query.total,
        'number'
    );
});

test('NEOM telemetry accepts authorized telemetry', async () => {
    const assetId =
        `NEOM-E2E-${Date.now()}`;

    const { response, data } =
        await jsonFetch(
            `${BASE_URL}/api/neom/telemetry`,
            {
                method: 'POST',
                headers: {
                    Authorization:
                        `Bearer ${token}`,
                    'Content-Type':
                        'application/json'
                },
                body: JSON.stringify({
                    domain: 'ENERGY',
                    zone: 'THE LINE',
                    assetId,
                    source: 'E2E_TEST',
                    metrics: {
                        powerKw: 1250,
                        temperatureC: 42,
                        efficiencyPct: 94.7
                    }
                })
            }
        );

    assert.equal(response.status, 201);
    assert.equal(
        data.status,
        'TELEMETRY_INGESTED'
    );

    assert.equal(
        data.telemetry.assetId,
        assetId
    );

    assert.equal(
        data.telemetry.organization,
        'NEOM'
    );

    assert.equal(
        data.telemetry.zone,
        'THE LINE'
    );

    assert.equal(
        data.telemetry.domain,
        'ENERGY'
    );

    assert.equal(
        data.telemetry.source,
        'E2E_TEST'
    );
});

test('NEOM anomaly engine detects critical telemetry conditions', async () => {
    const { response, data } =
        await jsonFetch(
            `${BASE_URL}/api/neom/telemetry`,
            {
                method: 'POST',
                headers: {
                    Authorization:
                        `Bearer ${token}`,
                    'Content-Type':
                        'application/json'
                },
                body: JSON.stringify({
                    domain: 'ENERGY',
                    zone: 'THE LINE',
                    assetId: `NEOM-ANOMALY-${Date.now()}`,
                    source: 'E2E_TEST',
                    metrics: {
                        powerKw: 1250,
                        temperatureC: 95,
                        failureProbability: 0.85
                    }
                })
            }
        );

    assert.equal(response.status, 201);

    assert.equal(
        data.telemetry.anomaly.type,
        'HIGH_TEMPERATURE'
    );

    assert.equal(
        data.telemetry.anomaly.severity,
        'HIGH'
    );

    assert.equal(
        data.telemetry.anomaly.value,
        95
    );
});

test('NEOM telemetry history returns filtered events', async () => {
    const assetId =
        `NEOM-HISTORY-${Date.now()}`;

    await fetch(
        `${BASE_URL}/api/neom/telemetry`,
        {
            method: 'POST',
            headers: {
                Authorization:
                    `Bearer ${token}`,
                'Content-Type':
                    'application/json'
            },
            body: JSON.stringify({
                domain: 'INFRASTRUCTURE',
                zone: 'OXAGON',
                assetId,
                source: 'E2E_TEST',
                metrics: {
                    loadPct: 73
                }
            })
        }
    );

    const { response, data } =
        await jsonFetch(
            `${BASE_URL}/api/neom/telemetry/history` +
            `?zone=OXAGON&assetId=${encodeURIComponent(assetId)}` +
            `&limit=5`,
            {
                headers: {
                    Authorization:
                        `Bearer ${token}`
                }
            }
        );

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(data.events));
    assert.ok(data.events.length >= 1);
    assert.equal(
        data.events[data.events.length - 1].assetId,
        assetId
    );
});

test('NEOM simulation adapter generates automatic telemetry', async () => {
    const started = Date.now();
    let events = 0;

    while (Date.now() - started < 7500) {
        const { response, data } =
            await jsonFetch(
                `${BASE_URL}/api/neom/telemetry/status`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

        assert.equal(response.status, 200);

        events = data.eventsInMemory;

        if (events > 0) {
            break;
        }

        await wait(500);
    }

    assert.ok(
        events > 0,
        'Expected automatic simulation telemetry'
    );
});

test('NEOM Socket.IO rejects missing authentication', async () => {
    const socket =
        io(BASE_URL, {
            transports: ['websocket']
        });

    const error =
        await new Promise(resolve => {
            const timeout = setTimeout(() => {
                resolve(
                    new Error(
                        'Socket authentication timeout'
                    )
                );
            }, 5000);

            socket.once(
                'connect_error',
                err => {
                    clearTimeout(timeout);
                    resolve(err);
                }
            );
        });

    socket.disconnect();

    assert.equal(
        error.message,
        'AUTHENTICATION_REQUIRED'
    );
});

test('NEOM Socket.IO delivers authorized live telemetry', async () => {
    const assetId =
        `NEOM-SOCKET-${Date.now()}`;

    const socket =
        io(BASE_URL, {
            auth: {
                token
            },
            transports: ['websocket']
        });

    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(
                new Error(
                    'Socket did not connect within 5 seconds'
                )
            );
        }, 5000);

        socket.once('connect', () => {
            clearTimeout(timeout);
            resolve();
        });

        socket.once('connect_error', err => {
            clearTimeout(timeout);
            reject(err);
        });
    });

    socket.emit(
        'subscribe',
        {
            zone: 'THE LINE',
            assetId
        }
    );

    const telemetryPromise =
        new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(
                    new Error(
                        'Live telemetry event timeout'
                    )
                );
            }, 5000);

            socket.once(
                'neom:telemetry',
                event => {
                    clearTimeout(timeout);
                    resolve(event);
                }
            );
        });

    await fetch(
        `${BASE_URL}/api/neom/telemetry`,
        {
            method: 'POST',
            headers: {
                Authorization:
                    `Bearer ${token}`,
                'Content-Type':
                    'application/json'
            },
            body: JSON.stringify({
                domain: 'ENERGY',
                zone: 'THE LINE',
                assetId,
                source: 'SOCKET_E2E',
                metrics: {
                    powerKw: 1400
                }
            })
        }
    );

    const event =
        await telemetryPromise;

    socket.disconnect();

    assert.equal(
        event.assetId,
        assetId
    );

    assert.equal(
        event.zone,
        'THE LINE'
    );

    assert.equal(
        event.organization,
        'NEOM'
    );

    assert.equal(
        event.source,
        'SOCKET_E2E'
    );
});

test('GET unknown endpoint returns 404 JSON', async () => {
    const { response, data } =
        await jsonFetch(
            `${BASE_URL}/api/does-not-exist`
        );

    assert.equal(response.status, 404);
    assert.equal(
        data.error,
        'ENDPOINT_NOT_FOUND'
    );
});
