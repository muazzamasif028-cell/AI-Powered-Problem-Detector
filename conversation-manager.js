/**
 * ============================================================
 * SUPREME Planetary OS
 * Conversation Isolation Manager
 * conversation-manager.js
 * ============================================================
 */

const crypto = require("crypto");

class ConversationManager {

    constructor() {

        this.conversations = new Map();

    }

    // =========================================================
    // Create New Conversation
    // =========================================================

    create({

        tenantId,

        userId,

        title = "New Chat"

    }) {

        const conversationId = crypto.randomUUID();

        const conversation = {

            id: conversationId,

            tenantId,

            userId,

            title,

            createdAt: new Date().toISOString(),

            updatedAt: new Date().toISOString(),

            status: "ACTIVE",

            messages: [],

            memory: [],

            files: [],

            agents: [],

            metadata: {}

        };

        this.conversations.set(conversationId, conversation);

        return conversation;

    }

    // =========================================================
    // Get Conversation
    // =========================================================

    get(conversationId){

        return this.conversations.get(conversationId);

    }

    // =========================================================
    // Verify Ownership
    // =========================================================

    verify({

        tenantId,

        userId,

        conversationId

    }){

        const chat=this.conversations.get(conversationId);

        if(!chat)
            return false;

        return(

            chat.tenantId===tenantId &&

            chat.userId===userId

        );

    }

    // =========================================================
    // Add Message
    // =========================================================

    addMessage({

        conversationId,

        role,

        content

    }){

        const chat=this.conversations.get(conversationId);

        if(!chat)
            throw new Error("Conversation Not Found");

        chat.messages.push({

            id:crypto.randomUUID(),

            role,

            content,

            timestamp:new Date().toISOString()

        });

        chat.updatedAt=new Date().toISOString();

    }

    // =========================================================
    // Get Messages
    // =========================================================

    getMessages(conversationId){

        const chat=this.conversations.get(conversationId);

        if(!chat)
            return [];

        return chat.messages;

    }

    // =========================================================
    // Delete Conversation
    // =========================================================

    delete(conversationId){

        return this.conversations.delete(conversationId);

    }

}

module.exports=new ConversationManager();
