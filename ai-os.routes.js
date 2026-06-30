// ============================================================
// 🧠 modules/01-ai-os/routes/ai-os.routes.js
// SUPREME AI OS Routes v11.0
// ============================================================
const express = require('express');
const router = express.Router();
const asyncHandler = require('../../../middleware/asyncHandler');
const aiController = require('../controllers/ai.controller');

// =============================================
// 🤖 LLM GATEWAY
// =============================================
router.post('/chat', asyncHandler(aiController.chat));
router.post('/chat/stream', asyncHandler(aiController.chatStream));
router.post('/embed', asyncHandler(aiController.generateEmbedding));
router.get('/models', asyncHandler(aiController.getModels));
router.post('/models/switch', asyncHandler(aiController.switchModel));

// =============================================
// 🎨 PROMPT STUDIO
// =============================================
router.post('/prompts', asyncHandler(aiController.createPrompt));
router.get('/prompts', asyncHandler(aiController.getPrompts));
router.get('/prompts/:id', asyncHandler(aiController.getPrompt));
router.put('/prompts/:id', asyncHandler(aiController.updatePrompt));
router.delete('/prompts/:id', asyncHandler(aiController.deletePrompt));
router.post('/prompts/test', asyncHandler(aiController.testPrompt));

// =============================================
// 📚 RAG BUILDER
// =============================================
router.post('/rag/upload', asyncHandler(aiController.uploadDocument));
router.post('/rag/query', asyncHandler(aiController.ragQuery));
router.get('/rag/collections', asyncHandler(aiController.getCollections));
router.delete('/rag/collection/:id', asyncHandler(aiController.deleteCollection));

// =============================================
// 🎯 AI AGENT BUILDER
// =============================================
router.post('/agents', asyncHandler(aiController.createAgent));
router.get('/agents', asyncHandler(aiController.getAgents));
router.get('/agents/:id', asyncHandler(aiController.getAgent));
router.put('/agents/:id', asyncHandler(aiController.updateAgent));
router.delete('/agents/:id', asyncHandler(aiController.deleteAgent));
router.post('/agents/:id/deploy', asyncHandler(aiController.deployAgent));
router.post('/agents/:id/test', asyncHandler(aiController.testAgent));

// =============================================
// 🔄 WORKFLOW BUILDER
// =============================================
router.post('/workflows', asyncHandler(aiController.createWorkflow));
router.get('/workflows', asyncHandler(aiController.getWorkflows));
router.post('/workflows/:id/execute', asyncHandler(aiController.executeWorkflow));

// =============================================
// 🎤 VOICE AI
// =============================================
router.post('/voice/tts', asyncHandler(aiController.textToSpeech));
router.post('/voice/stt', asyncHandler(aiController.speechToText));

// =============================================
// 🖼️ IMAGE AI
// =============================================
router.post('/image/generate', asyncHandler(aiController.generateImage));
router.post('/image/edit', asyncHandler(aiController.editImage));
router.post('/image/analyze', asyncHandler(aiController.analyzeImage));

// =============================================
// 📝 CODE AI
// =============================================
router.post('/code/generate', asyncHandler(aiController.generateCode));
router.post('/code/review', asyncHandler(aiController.reviewCode));
router.post('/code/debug', asyncHandler(aiController.debugCode));
router.post('/code/explain', asyncHandler(aiController.explainCode));

// =============================================
// 🎯 FINE-TUNING
// =============================================
router.post('/finetune', asyncHandler(aiController.createFineTune));
router.get('/finetune/:id', asyncHandler(aiController.getFineTuneStatus));
router.get('/finetunes', asyncHandler(aiController.listFineTunes));

// =============================================
// 📊 EVALUATION
// =============================================
router.post('/evaluate', asyncHandler(aiController.evaluate));
router.get('/evaluations', asyncHandler(aiController.getEvaluations));

// =============================================
// 🎮 PLAYGROUND
// =============================================
router.post('/playground/compare', asyncHandler(aiController.compareModels));

module.exports = router;
