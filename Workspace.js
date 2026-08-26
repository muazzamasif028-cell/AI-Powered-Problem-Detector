// ============================================================
// 🗄️ src/services/workspace/models/Workspace.js
// SUPREME Persistent Workspace Model
// ============================================================
const mongoose = require('mongoose');

const WorkspaceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    name: { type: String, default: 'My Workspace' },
    
    // Current state
    currentState: {
        openTabs: [{
            id: String,
            type: { type: String, enum: ['ai-chat', 'code-editor', 'agent-dashboard', 'file-manager', 'terminal', 'browser', 'docs', 'settings'] },
            title: String,
            icon: String,
            url: String,
            position: { x: Number, y: Number },
            size: { width: Number, height: Number },
            isActive: Boolean,
            isPinned: Boolean,
            data: mongoose.Schema.Types.Mixed // Tab-specific state
        }],
        layout: {
            type: { type: String, enum: ['grid', 'tabs', 'split', 'custom'], default: 'grid' },
            panels: [{
                id: String,
                type: String,
                position: String,
                size: Number,
                tabs: [String] // Tab IDs
            }],
            sidebarOpen: Boolean,
            sidebarWidth: Number,
            terminalOpen: Boolean,
            terminalHeight: Number
        },
        cursorPosition: {
            activeTab: String,
            line: Number,
            column: Number,
            scrollPosition: Number
        },
        activeAIProvider: String,
        activeModel: String
    },
    
    // AI Context
    aiContext: {
        conversations: [{
            provider: String,
            model: String,
            messages: [{
                role: { type: String, enum: ['system', 'user', 'assistant'] },
                content: String,
                timestamp: Date,
                metadata: mongoose.Schema.Types.Mixed
            }],
            summary: String,
            lastActivity: Date
        }],
        memory: {
            shortTerm: [{
                content: String,
                importance: Number,
                timestamp: Date
            }],
            longTerm: [{
                content: String,
                importance: Number,
                tags: [String],
                timestamp: Date
            }],
            preferences: mongoose.Schema.Types.Mixed,
            learnedFacts: [String]
        },
        agentStates: [{
            agentId: String,
            name: String,
            status: { type: String, enum: ['idle', 'running', 'completed', 'error'] },
            currentTask: String,
            progress: Number,
            lastOutput: String,
            lastActivity: Date
        }]
    },
    
    // File System State
    fileSystem: {
        openFiles: [{
            path: String,
            name: String,
            type: String,
            content: String,
            language: String,
            lastModified: Date,
            cursorPosition: { line: Number, column: Number },
            scrollPosition: Number,
            isDirty: Boolean,
            unsavedContent: String
        }],
        recentFiles: [String],
        projectRoot: String,
        activeProject: String
    },
    
    // Terminal State
    terminal: {
        sessions: [{
            id: String,
            name: String,
            command: String,
            output: String,
            history: [String],
            workingDirectory: String,
            environment: mongoose.Schema.Types.Mixed
        }],
        activeSession: String
    },
    
    // Browser State (built-in browser)
    browser: {
        tabs: [{
            id: String,
            url: String,
            title: String,
            favicon: String,
            scrollPosition: Number,
            formData: mongoose.Schema.Types.Mixed,
            cookies: mongoose.Schema.Types.Mixed
        }],
        history: [String],
        bookmarks: [{
            url: String,
            title: String,
            tags: [String]
        }]
    },
    
    // Cloud Resources
    cloudResources: {
        runningInstances: [String],
        activeDeployments: [String],
        databaseConnections: [{
            id: String,
            type: String,
            host: String,
            database: String,
            status: String
        }]
    },
    
    // Background Tasks
    backgroundTasks: [{
        id: String,
        type: String,
        status: { type: String, enum: ['queued', 'running', 'completed', 'failed'] },
        progress: Number,
        result: mongoose.Schema.Types.Mixed,
        startedAt: Date,
        completedAt: Date
    }],
    
    // Collaboration
    collaborators: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: String,
        avatar: String,
        role: { type: String, enum: ['viewer', 'editor', 'admin'] },
        isOnline: Boolean,
        lastSeen: Date,
        cursorPosition: mongoose.Schema.Types.Mixed
    }],
    
    // Metadata
    lastSnapshotId: String,
    lastSnapshotAt: Date,
    snapshotCount: { type: Number, default: 0 },
    totalUptime: { type: Number, default: 0 }, // seconds
    status: { type: String, enum: ['active', 'frozen', 'archived'], default: 'active' },
    isPersistent: { type: Boolean, default: true },
    version: { type: Number, default: 1 }
    
}, { timestamps: true });

module.exports = mongoose.model('Workspace', WorkspaceSchema);
