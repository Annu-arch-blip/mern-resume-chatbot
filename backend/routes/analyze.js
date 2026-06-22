const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { analyze, getHistory, getConversation } = require('../controllers/analyzeController');

// POST /api/analyze - requires valid JWT
router.post('/analyze', authMiddleware, analyze);

// GET /api/history - requires valid JWT (optional ?mode= query filter)
router.get('/history', authMiddleware, getHistory);

// GET /api/conversation/:id - requires valid JWT, returns full thread
router.get('/conversation/:id', authMiddleware, getConversation);

module.exports = router;
