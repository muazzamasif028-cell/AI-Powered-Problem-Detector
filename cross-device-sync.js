// ============================================================
// 🔗 services/cross-device-sync.js
// SUPREME Cross-Device Sync — Desktop ↔ Mobile ↔ Tablet
// ============================================================
const Workspace = require('../models/Workspace');
const autoSaveService = require('./auto-save.service');
const stateRestoreService = require('./state-restore.service');

class CrossDeviceSync {
    constructor() {
        this.deviceSessions = new Map(); // userId -> Set of deviceIds
        this.syncChannels = new Map();   // userId -> WebSocket connections
    }

    /**
     * Register device on login
     */
    async registerDevice(userId, deviceInfo) {
        const { deviceId, platform, deviceName, deviceType } = deviceInfo;

        if (!this.deviceSessions.has(userId)) {
            this.deviceSessions.set(userId, new Set());
        }

        this.deviceSessions.get(userId).add(deviceId);

        // Update workspace with device info
        await Workspace.findOneAndUpdate(
            { userId },
            {
                $set: {
                    'metadata.deviceId': deviceId,
                    'metadata.platform': platform
                }
            }
        );

        console.log(`🔗 Device registered: ${deviceName} (${platform}) for user ${userId}`);

        return {
            deviceId,
            platform,
            otherDevices: Array.from(this.deviceSessions.get(userId)).filter(id => id !== deviceId)
        };
    }

    /**
     * Unregister device on logout
     */
    async unregisterDevice(userId, deviceId) {
        const devices = this.deviceSessions.get(userId);
        if (devices) {
            devices.delete(deviceId);
            if (devices.size === 0) {
                this.deviceSessions.delete(userId);
            }
        }
    }

    /**
     * Sync state to all connected devices
     */
    async syncToAllDevices(userId, changedBy) {
        const devices = this.deviceSessions.get(userId);
        if (!devices || devices.size <= 1) return; // No other devices

        // Get latest workspace state
        const workspace = await Workspace.findOne({ userId });
        const state = stateRestoreService.formatForClient(workspace);

        // Send to all other devices
        const otherDevices = Array.from(devices).filter(id => id !== changedBy);

        for (const deviceId of otherDevices) {
            this.sendToDevice(userId, deviceId, {
                type: 'workspace_sync',
                state,
                changedBy,
                timestamp: new Date().toISOString()
            });
        }

        console.log(`🔗 Synced workspace to ${otherDevices.length} other device(s) for user ${userId}`);
    }

    /**
     * Send message to specific device
     */
    sendToDevice(userId, deviceId, message) {
        const channel = this.syncChannels.get(userId);
        if (channel) {
            channel.send(JSON.stringify({
                targetDevice: deviceId,
                ...message
            }));
        }
    }

    /**
     * Register WebSocket for real-time sync
     */
    registerWebSocket(userId, ws) {
        this.syncChannels.set(userId, ws);
        
        ws.on('message', async (data) => {
            const message = JSON.parse(data);
            
            if (message.type === 'state_changed') {
                // Trigger save and sync
                await autoSaveService.saveWorkspace(userId);
                await this.syncToAllDevices(userId, message.deviceId);
            }
        });

        ws.on('close', () => {
            this.syncChannels.delete(userId);
        });
    }

    /**
     * Get connected devices
     */
    getConnectedDevices(userId) {
        const devices = this.deviceSessions.get(userId);
        return devices ? Array.from(devices) : [];
    }
}

module.exports = new CrossDeviceSync();
