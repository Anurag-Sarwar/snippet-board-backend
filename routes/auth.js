const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Import our User blueprint

// ==========================================
// 1. REGISTER ROUTE (Sign Up)
// URL: http://localhost:5000/api/auth/register
// ==========================================
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check if the user already exists in the database
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists with this email" });
        }

        // SCRAMBLE THE PASSWORD: Turn plain text "password123" into a random string of nonsense
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create the new user object
        const newUser = new User({
            username,
            email,
            password: hashedPassword
        });

        // Save the user to MongoDB
        await newUser.save();

        // Create a JWT Token (The digital wristband)
        const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.status(201).json({ message: "User registered successfully!", token, username });
    } catch (error) {
        res.status(500).json({ message: "Server error during registration", error: error.message });
    }
});

// ==========================================
// 2. LOGIN ROUTE 
// URL: http://localhost:5000/api/auth/login
// ==========================================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if the user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        // Compare the typed password with the scrambled password in the database
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        // If credentials are correct, hand them their JWT Token
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.json({ message: "Login successful!", token, username: user.username });
    } catch (error) {
        res.status(500).json({ message: "Server error during login", error: error.message });
    }
});

module.exports = router;