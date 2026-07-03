// ============================================================
// 🌟 src/services/workspace/living-workspace.service.js
// SUPREME Living Workspace — Never sleeps, always working
// ============================================================
const snapshotEngine = require('./snapshot-engine.service');
const restoreEngine = require('./restore-engine.service');
const backgroundAgentService = require('./background-agent.service');
const Workspace = require('./models/Workspace');
const Activity = require('../models/Activity');

class LivingWorkspaceService {
    constructor() {
        this.activeWorkspaces = new Map();
    }

    /**
     * User logs in — instant restore
     */
    async onUserLogin(userId) {
        console.log(`🌟 Living Workspace: User ${userId} logged in`);

        const startTime = Date.now();

        // 1. Restore workspace instantly
        const workspace = await restoreEngine.restoreLatest(userId);

        // 2. Get background work summary
        const backgroundWork = await backgroundAgentService.getBackgroundWorkStatus(userId);

        // 3. Start auto-snapshot
        snapshotEngine.startAutoSnapshot(userId);

        // 4. Track active workspace
        this.activeWorkspaces.set(userId, {
            loginTime: new Date(),
            workspaceId: workspace.workspace?.id
        });

        // 5. Log activity
        await Activity.create({
            userId,
            type: 'workspace.login',
            action: 'workspace_restored',
            description: `🌟 Welcome back! Workspace restored in ${workspace.restoreMetadata?.restoreLatency || '0ms'}`,
            metadata: {
                restoreTime: Date.now() - startTime,
                backgroundTasksCompleted: backgroundWork.completed
            }
        });

        return {
            workspace,
            backgroundWork,
            welcomeMessage: this.generateWelcomeMessage(backgroundWork),
            restoreTime: `${Date.now() - startTime}ms`,
            status: '🚀 Ready!'
        };
    }

    /**
     * User logs out — freeze workspace, continue background work
     */
    async onUserLogout(userId) {
        console.log(`🌟 Living Workspace: User ${userId} logged out`);

        // 1. Force final snapshot
        await snapshotEngine.forceSnapshot(userId);

        // 2. Stop auto-snapshot
        snapshotEngine.stopAutoSnapshot(userId);

        // 3. Start background work
        const backgroundWork = await backgroundAgentService.startBackgroundWork(userId);

        // 4. Mark workspace as frozen
        await Workspace.findOneAndUpdate(
            { userId, status: 'active' },
            { status: 'frozen' }
        );

        // 5. Remove from active
        this.activeWorkspaces.delete(userId);

        // 6. Log activity
        await Activity.create({
            userId,
            type: 'workspace.logout',
            action: 'workspace_frozen',
            description: `💤 Workspace frozen. ${backgroundWork.tasksCompleted} background tasks started.`,
            metadata: backgroundWork
        });

        return {
            message: '💤 Workspace frozen. AI agents continue working.',
            backgroundWork,
            snapshotSaved: true,
            willRestoreInstantly: true
        };
    }

    /**
     * Generate welcome message
     */
    generateWelcomeMessage(backgroundWork) {
        if (backgroundWork.completed === 0) {
            return 'Welcome back! Your workspace is exactly as you left it.';
        }

        return `Welcome back! While you were away:\n` +
               backgroundWork.recentTasks
                   .filter(t => t.status === 'completed')
                   .slice(0, 5)
                   .map(t => `• ${t.result?.message || t.type}`)
                   .join('\n');
    }

    /**
     * Get living workspace stats
     */
    async getStats(userId) {
        const workspace = await Workspace.findOne({ userId });
        if (!workspace) return null;

        const backgroundWork = await backgroundAgentService.getBackgroundWorkStatus(userId);
        const snapshots = await snapshotEngine.getStats(userId);

        return {
            status: workspace.status,
            isAlive: workspace.status === 'active',
            totalUptime: this.formatUptime(workspace.totalUptime),
            snapshots,
            backgroundWork: {
                tasksCompleted: backgroundWork.completed,
                tasksRunning: backgroundWork.running,
                tasksFailed: backgroundWork.failed
            },
            workspaces: Array.from(this.activeWorkspaces.entries()).map(([id, data]) => ({
                userId: id,
                onlineSince: data.loginTime,
                duration: this.formatUptime((Date.now() - data.loginTime) / 1000)
            }))
        };
    }

    formatUptime(seconds) {
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        
        const parts = [];
        if (d > 0) parts.push(`${d}d`);
        if (h > 0) parts.push(`${h}h`);
        if (m > 0) parts.push(`${m}m`);
        parts.push(`${s}s`);
        
        return parts.join(' ');
    }
}

module.exports = new LivingWorkspaceService();
