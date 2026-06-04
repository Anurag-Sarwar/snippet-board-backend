const mongoose = require('mongoose');

const SnippetSchema = new mongoose.Schema({
    content: { type: String, required: true }, // The code or text pasted by the user
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Links this snippet to a User ID
    aiTags: [{ type: String }] // An array of strings to hold our future AI tags
}, { timestamps: true });

module.exports = mongoose.model('Snippet', SnippetSchema);