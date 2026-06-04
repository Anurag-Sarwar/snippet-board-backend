const dns = require('dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);



// 1. Core Imports
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http'); // New: Core Node HTTP module
const { Server } = require('socket.io'); // New: WebSocket Server
require('dotenv').config();

// 2. Initialize App & Servers
const app = express();
const server = http.createServer(app); // Wrap Express inside an HTTP server

// 3. Set up WebSockets (Allowing our React frontend to connect)
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173", // Your Vite frontend URL
        methods: ["GET", "POST"]
    }
});

// Make the 'io' variable accessible inside our snippet routes!
app.set('io', io);

// Listen for live connections
io.on('connection', (socket) => {
    console.log(`⚡ A user connected live: ${socket.id}`);
});

// 4. Middleware
app.use(cors());
app.use(express.json());

// 5. Database Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log(" Successfully connected to MongoDB Atlas!"))
    .catch((error) => console.error(" Database connection error:", error));

// 6. Routes
const authRoutes = require('./routes/auth');
const snippetRoutes = require('./routes/snippets');

app.use('/api/auth', authRoutes);
app.use('/api/snippets', snippetRoutes);

// 7. Start the Server (Notice we use server.listen instead of app.listen now!)
const PORT = 5000;
server.listen(PORT, () => {
    console.log(`Server is running live on http://localhost:${PORT}`);
});