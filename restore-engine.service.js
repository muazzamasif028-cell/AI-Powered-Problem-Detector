// ============================================================
// 🔄 src/services/workspace/restore-engine.service.js
// SUPREME Restore Engine — Instant state restoration
// ============================================================
const Workspace = require('./models/Workspace');
const Snapshot = require('./models/Snapshot');
const snapshotEngine = require('./snapshot-engine.service');
const zlib = require('zlib');
const util = require('util');

const gunzip = util.promisify(zlib.gunzip);

class RestoreEngine {
    constructor() {
        this.restoreLatencyTarget = 1000; // 1 second target
    }

    /**
     * Restore workspace to latest state
     */
    async restoreLatest(userId) {
        const startTime = Date.now();
        
        console.log(`🔄 Restoring workspace for user ${userId}...`);

        // Get latest snapshot
        const snapshot = await snapshotEngine.getLatestSnapshot(userId);
        
        if (!snapshot) {
            // No snapshot exists, create fresh workspace
            return this.createFreshWorkspace(userId);
        }

        // Decompress snapshot
        const decompressed = await gunzip(snapshot.compressedData);
        const state = JSON.parse(decompressed.toString());

        // Find workspace
        let workspace = await Workspace.findOne({ userId });
        
        if (!workspace) {
            workspace = await Workspace.create({
                userId,
                name: 'My Workspace',
                status: 'active'
            });
        }

        // Restore state
        workspace.currentState = state.openTabs ? {
            openTabs: state.openTabs,
            layout: state.layout,
            cursorPosition: state.cursorPosition
        } : workspace.currentState;

        workspace.aiContext = state.aiContext || workspace.aiContext;
        workspace.fileSystem = state.fileSystem || workspace.fileSystem;
        workspace.terminal = state.terminal || workspace.terminal;
        workspace.browser = state.browser || workspace.browser;
        workspace.cloudResources = state.cloudResources || workspace.cloudResources;
        workspace.backgroundTasks = state.backgroundTasks || workspace.backgroundTasks;
        workspace.status = 'active';
        workspace.version += 1;

        await workspace.save();

        // Restart auto-snapshot
        snapshotEngine.startAutoSnapshot(userId);

        const restoreLatency = Date.now() - startTime;

        console.log(`✅ Workspace restored in ${restoreLatency}ms`);

        return {
            workspace: this.formatWorkspace(workspace),
            restoreMetadata: {
                snapshotId: snapshot._id,
                capturedAt: snapshot.metadata.capturedAt,
                restoredAt: new Date(),
                restoreLatency: `${restoreLatency}ms`,
                targetLatency: `${this.restoreLatencyTarget}ms`,
                status: restoreLatency <= this.restoreLatencyTarget ? '🚀 Instant' : '⏳ Fast',
                changes: {
                    tabsRestored: workspace.currentState.openTabs?.length || 0,
                    filesRestored: workspace.fileSystem.openFiles?.length || 0,
                    conversationsRestored: workspace.aiContext.conversations?.length || 0,
                    agentsRestored: workspace.aiContext.agentStates?.length || 0
                }
            }
        };
    }

    /**
     * Restore from specific time (Time Machine)
     */
    async restoreFromTime(userId, timestamp) {
        console.log(`⏰ Time Machine: Restoring workspace for ${userId} to ${new Date(timestamp).toISOString()}`);

        const snapshot = await snapshotEngine.getSnapshotAtTime(userId, timestamp);
        
        if (!snapshot) {
            throw new Error('No snapshot found for the specified time');
        }

        // Save current state before time travel
        await snapshotEngine.forceSnapshot(userId);

        // Decompress and restore
        const decompressed = await gunzip(snapshot.compressedData);
        const state = JSON.parse(decompressed.toString());

        const workspace = await Workspace.findOne({ userId });
        
        workspace.currentState = {
            openTabs: state.openTabs || [],
            layout: state.layout || {},
            cursorPosition: state.cursorPosition || {}
        };
        workspace.aiContext = state.aiContext || workspace.aiContext;
        workspace.fileSystem = state.fileSystem || workspace.fileSystem;
        workspace.terminal = state.terminal || workspace.terminal;
        workspace.browser = state.browser || workspace.browser;
        workspace.version += 1;

        await workspace.save();

        return {
            message: `⏰ Restored to state from ${new Date(timestamp).toLocaleString()}`,
            workspace: this.formatWorkspace(workspace),
            timeTravel: {
                from: snapshot.metadata.capturedAt,
                to: new Date(),
                snapshotId: snapshot._id
            }
        };
    }

    /**
     * Restore from specific snapshot ID
     */
    async restoreFromSnapshot(userId, snapshotId) {
        const snapshot = await snapshotEngine.getSnapshotById(snapshotId);
        
        if (!snapshot || snapshot.userId.toString() !== userId) {
            throw new Error('Snapshot not found');
        }

        const decompressed = await gunzip(snapshot.compressedData);
        const state = JSON.parse(decompressed.toString());

        const workspace = await Workspace.findOne({ userId });
        
        workspace.currentState = {
            openTabs: state.openTabs || [],
            layout: state.layout || {},
            cursorPosition: state.cursorPosition || {}
        };
        workspace.aiContext = state.aiContext || {};
        workspace.fileSystem = state.fileSystem || {};
        workspace.terminal = state.terminal || {};
        workspace.browser = state.browser || {};

        await workspace.save();

        return {
            message: '✅ Restored from snapshot',
            workspace: this.formatWorkspace(workspace)
        };
    }

    /**
     * Create fresh workspace
     */
    async createFreshWorkspace(userId) {
        const workspace = await Workspace.create({
            userId,
            name: 'My Workspace',
            status: 'active',
            currentState: {
                openTabs: [{
                    id: 'welcome',
                    type: 'ai-chat',
                    title: 'Welcome',
                    isActive: true,
                    isPinned: false
                }],
                layout: { type: 'grid', panels: [], sidebarOpen: true, terminalOpen: false },
                cursorPosition: { activeTab: 'welcome', line: 1, column: 1, scrollPosition: 0 }
            }
        });

        snapshotEngine.startAutoSnapshot(userId);

        return {
            workspace: this.formatWorkspace(workspace),
            isNew: true,
            message: '🌟 Fresh workspace created!'
        };
    }

    /**
     * Format workspace for API response
     */
    formatWorkspace(workspace) {
        return {
            id: workspace._id,
            name: workspace.name,
            status: workspace.status,
            isPersistent: workspace.isPersistent,
            stats: {
                openTabs: workspace.currentState.openTabs?.length || 0,
                aiConversations: workspace.aiContext.conversations?.length || 0,
                runningAgents: workspace.aiContext.agentStates?.filter(a => a.status === 'running').length || 0,
                openFiles: workspace.fileSystem.openFiles?.length || 0,
                backgroundTasks: workspace.backgroundTasks?.filter(t => t.status === 'running').length || 0,
                totalUptime: workspace.totalUptime,
                snapshotCount: workspace.snapshotCount
            },
            currentState: {
                activeTab: workspace.currentState.openTabs?.find(t => t.isActive),
                activeAIProvider: workspace.currentState.activeAIProvider,
                activeModel: workspace.currentState.activeModel
            },
            updatedAt: workspace.updatedAt
        };
    }
}

module.exports = new RestoreEngine();
