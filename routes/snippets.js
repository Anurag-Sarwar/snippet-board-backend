const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Snippet = require('../models/Snippet');
const { GoogleGenerativeAI } = require('@google/generative-ai');

require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("🔴 CRITICAL ERROR: GEMINI_API_KEY is missing from your .env file!");
}

const genAI = new GoogleGenerativeAI(apiKey || 'missing-key');

// =======================================================
// MIDDLEWARE: Check valid JWT token
// =======================================================
const verifyToken = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ message: "Access denied." });

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = verified.userId; 
        next(); 
    } catch (error) {
        res.status(400).json({ message: "Invalid token." });
    }
};

// Helper function to call Gemini using the required 3.6-flash model
async function generateAIResponse(prompt) {
    const modelsToTry = ["gemini-3.6-flash"];
    let lastError = null;

    for (const modelName of modelsToTry) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (err) {
            lastError = err;
            console.warn(`⚠️ Model ${modelName} failed (${err.message}). Trying fallback model...`);
        }
    }
    throw lastError;
}

// ==========================================
// 1. CREATE A NEW SNIPPET
// ==========================================
router.post('/', verifyToken, async (req, res) => {
    try {
        const { content } = req.body;
        let aiTags = ["general"]; 

        try {
            const prompt = `Analyze this engineering snippet. Provide exactly 3 highly relevant technical tags (one word each, lowercase). Return ONLY the tags separated by commas, nothing else. Snippet: "${content}"`;
            const responseText = await generateAIResponse(prompt);
            
            aiTags = responseText
                .split(',')
                .map(tag => tag.trim().replace(/[^a-z0-9-]/g, ''))
                .filter(tag => tag !== '');

        } catch (aiError) {
            console.error("🔴 AI Tagging failed. Reason:", aiError.message);
        }

        const newSnippet = new Snippet({
            content,
            author: req.userId, 
            aiTags 
        });

        await newSnippet.save();
        await newSnippet.populate('author', 'username');

        const io = req.app.get('io');
        if (io) {
            io.emit('receive_snippet', newSnippet);
        }

        res.status(201).json({ message: "Snippet posted successfully!", snippet: newSnippet });
    } catch (error) {
        res.status(500).json({ message: "Failed to post snippet", error: error.message });
    }
});

// ==========================================
// 2. GET ALL SNIPPETS
// ==========================================
router.get('/', async (req, res) => {
    try {
        const snippets = await Snippet.find()
            .sort({ createdAt: -1 })
            .populate('author', 'username'); 

        res.json(snippets);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch snippets", error: error.message });
    }
});

// ==========================================
// 3. AI CODE REVIEWER & AUTO-FIXER
// ==========================================
router.post('/analyze', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Code content is required.' });
    }

    if (!apiKey) {
        return res.status(500).json({ error: 'API Key is missing in the backend.' });
    }

    const prompt = `Analyze the following code for quality, bugs, performance bottlenecks, and security risks.
Return ONLY a valid JSON object. Do not include markdown formatting or backticks around the response.

JSON format:
{
  "qualityScore": 85,
  "issuesFound": ["Issue 1 description", "Issue 2 description"],
  "improvedCode": "refactored code string here"
}

Code:
${code}`;

    const responseText = (await generateAIResponse(prompt)).trim();
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Gemini response did not contain valid JSON.');
    }

    const analysisData = JSON.parse(jsonMatch[0]);
    res.json(analysisData);
  } catch (err) {
    console.error('🔴 AI Analysis Error:', err.message);
    res.status(500).json({ error: `AI Error: ${err.message}` });
  }
});

module.exports = router;