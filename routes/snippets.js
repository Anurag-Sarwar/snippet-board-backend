const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Snippet = require('../models/Snippet');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize the Gemini AI engine using your secret key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// =======================================================
// MINI-MIDDLEWARE: Check if the user has a valid JWT token
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

// ==========================================
// 1. CREATE A NEW SNIPPET (Now with AI)
// ==========================================
router.post('/', verifyToken, async (req, res) => {
    try {
        const { content } = req.body;
        let aiTags = ["general"]; // Fallback tag

        // --- AI TAG GENERATION ---
        try {
            // Call the fast gemini-1.5-flash model
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            
            // Give the AI strict instructions
            const prompt = `Analyze this engineering snippet. Provide exactly 3 highly relevant technical tags (one word each, lowercase). Return ONLY the tags separated by commas, nothing else. Snippet: "${content}"`;
            
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            
            // Clean up the AI string into an array (e.g., "javascript, react, frontend" -> ['javascript', 'react', 'frontend'])
            aiTags = responseText
                .split(',')
                .map(tag => tag.trim().replace(/[^a-z0-9-]/g, ''))
                .filter(tag => tag !== '');

        } catch (aiError) {
            console.error("AI Tagging failed, using fallback:", aiError.message);
        }

        // Save to MongoDB with the new AI tags
        const newSnippet = new Snippet({
            content,
            author: req.userId, 
            aiTags 
        });

        await newSnippet.save();
        
        // Fetch the author's username before sending back to frontend
        await newSnippet.populate('author', 'username');

        // --- WEBSOCKET BROADCAST ---
        const io = req.app.get('io');
        io.emit('receive_snippet', newSnippet); // Shout the new snippet to everyone connected!

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

module.exports = router;