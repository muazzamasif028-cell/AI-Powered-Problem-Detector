// ============================================================
// 📸 src/services/workspace/snapshot-engine.service.js
// SUPREME Snapshot Engine — Automatic state capture
// ============================================================
const Workspace = require('./models/Workspace');
const Snapshot = require('./models/Snapshot');
const crypto = require('crypto');
const zlib = require('zlib');
const util = require('util');

const gzip = util.promisify(zlib.gzip);
const gunzip = util.promisify(zlib.gunzip);

class SnapshotEngine {
    constructor() {
        this.snapshotInterval = 5000; // 5 seconds
        this.maxSnapshots = 100; // Keep last 100 snapshots
        this.snapshots = new Map(); // Active snapshot timers
    }

    /**
     * Start automatic snapshots for a workspace
     */
    startAutoSnapshot(userId) {
        if (this.snapshots.has(userId)) {
            return; // Already running
        }

        console.log(`📸 Starting auto-snapshot for user ${userId}`);

        const interval = setInterval(async () => {
            try {
                await this.captureSnapshot(userId);
            } catch (error) {
                console.error(`Auto-snapshot failed for ${userId}:`, error.message);
            }
        }, this.snapshotInterval);

        this.snapshots.set(userId, interval);
    }

    /**
     * Stop automatic snapshots
     */
    stopAutoSnapshot(userId) {
        const interval = this.snapshots.get(userId);
        if (interval) {
            clearInterval(interval);
            this.snapshots.delete(userId);
            console.log(`📸 Stopped auto-snapshot for user ${userId}`);
        }
    }

    /**
     * Capture a full workspace snapshot
     */
    async captureSnapshot(userId) {
        const startTime = Date.now();
        
        // Get current workspace state
        const workspace = await Workspace.findOne({ userId, status: 'active' });
        if (!workspace) return null;

        // Create snapshot object
        const snapshot = {
            workspaceId: workspace._id,
            userId,
            state: {
                openTabs: workspace.currentState.openTabs,
                layout: workspace.currentState.layout,
                cursorPosition: workspace.currentState.cursorPosition,
                aiContext: workspace.aiContext,
                fileSystem: workspace.fileSystem,
                terminal: workspace.terminal,
                browser: workspace.browser,
                cloudResources: workspace.cloudResources,
                backgroundTasks: workspace.backgroundTasks
            },
            metadata: {
                workspaceVersion: workspace.version,
                capturedAt: new Date(),
                captureLatency: 0,
                compressedSize: 0,
                originalSize: 0,
                checksum: ''
            }
        };

        // Calculate original size
        const originalData = JSON.stringify(snapshot.state);
        snapshot.metadata.originalSize = originalData.length;

        // Compress
        const compressed = await gzip(originalData);
        snapshot.metadata.compressedSize = compressed.length;
        snapshot.metadata.compressionRatio = ((1 - compressed.length / originalData.length) * 100).toFixed(1) + '%';

        // Calculate checksum
        snapshot.metadata.checksum = crypto.createHash('sha256').update(compressed).digest('hex');

        // Check if state actually changed
        const lastSnapshot = await Snapshot.findOne({ workspaceId: workspace._id })
            .sort({ 'metadata.capturedAt': -1 })
            .limit(1);

        if (lastSnapshot && lastSnapshot.metadata.checksum === snapshot.metadata.checksum) {
            // State hasn't changed, skip this snapshot
            return { skipped: true, reason: 'No changes detected' };
        }

        // Store compressed data in MongoDB (GridFS for large snapshots)
        const snapshotDoc = await Snapshot.create({
            ...snapshot,
            compressedData: compressed
        });

        // Update workspace
        workspace.lastSnapshotId = snapshotDoc._id;
        workspace.lastSnapshotAt = new Date();
        workspace.snapshotCount += 1;
        workspace.totalUptime += 5; // seconds since last snapshot
        await workspace.save();

        // Cleanup old snapshots
        await this.cleanupOldSnapshots(workspace._id);

        snapshot.metadata.captureLatency = Date.now() - startTime;

        console.log(`📸 Snapshot captured for ${userId}: ${snapshot.metadata.compressedSize} bytes (${snapshot.metadata.compressionRatio} compression) in ${snapshot.metadata.captureLatency}ms`);

        return snapshotDoc;
    }

    /**
     * Force an immediate snapshot
     */
    async forceSnapshot(userId) {
        console.log(`📸 Force snapshot for ${userId}`);
        return this.captureSnapshot(userId);
    }

    /**
     * Cleanup old snapshots
     */
    async cleanupOldSnapshots(workspaceId) {
        const count = await Snapshot.countDocuments({ workspaceId });
        
        if (count > this.maxSnapshots) {
            const toDelete = count - this.maxSnapshots;
            
            // Delete oldest snapshots
            const oldSnapshots = await Snapshot.find({ workspaceId })
                .sort({ 'metadata.capturedAt': 1 })
                .limit(toDelete);

            const ids = oldSnapshots.map(s => s._id);
            await Snapshot.deleteMany({ _id: { $in: ids } });
            
            console.log(`🧹 Cleaned up ${toDelete} old snapshots for workspace ${workspaceId}`);
        }
    }

    /**
     * Get latest snapshot
     */
    async getLatestSnapshot(userId) {
        const workspace = await Workspace.findOne({ userId, status: 'active' });
        if (!workspace) return null;

        return Snapshot.findOne({ workspaceId: workspace._id })
            .sort({ 'metadata.capturedAt': -1 })
            .limit(1);
    }

    /**
     * Get snapshot from specific time
     */
    async getSnapshotAtTime(userId, timestamp) {
        const workspace = await Workspace.findOne({ userId });
        if (!workspace) return null;

        return Snapshot.findOne({
            workspaceId: workspace._id,
            'metadata.capturedAt': { $lte: new Date(timestamp) }
        }).sort({ 'metadata.capturedAt': -1 });
    }

    /**
     * Get snapshot by ID
     */
    async getSnapshotById(snapshotId) {
        return Snapshot.findById(snapshotId);
    }

    /**
     * Get snapshot stats
     */
    async getStats(userId) {
        const workspace = await Workspace.findOne({ userId });
        if (!workspace) return null;

        const snapshots = await Snapshot.find({ workspaceId: workspace._id })
            .sort({ 'metadata.capturedAt': -1 })
            .limit(20)
            .select('metadata');

        const totalSnapshots = await Snapshot.countDocuments({ workspaceId: workspace._id });
        const totalSize = await Snapshot.aggregate([
            { $match: { workspaceId: workspace._id } },
            { $group: { _id: null, total: { $sum: '$metadata.compressedSize' } } }
        ]);

        return {
            totalSnapshots,
            lastSnapshot: workspace.lastSnapshotAt,
            snapshotInterval: this.snapshotInterval,
            totalStorageUsed: totalSize[0]?.total || 0,
            recentSnapshots: snapshots.map(s => ({
                id: s._id,
                capturedAt: s.metadata.capturedAt,
                size: s.metadata.compressedSize,
                ratio: s.metadata.compressionRatio,
                checksum: s.metadata.checksum?.substring(0, 16) + '...'
            }))
        };
    }
}

module.exports = new SnapshotEngine();
