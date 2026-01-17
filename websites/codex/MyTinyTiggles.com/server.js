/**
 * MyTinyTiggles.com Server
 *
 * Static website server for My Tiny Tiggles children's music platform.
 * Serves HTML, CSS, JS, images, and audio content.
 *
 * Port: 3401
 */

'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3401;

// Middleware
app.use(cors());
app.use(morgan('combined'));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    etag: true
}));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'MyTinyTiggles.com',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Fallback to index.html for SPA-like behavior
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(50));
    console.log('  MyTinyTiggles.com Server');
    console.log('='.repeat(50));
    console.log(`  Port: ${PORT}`);
    console.log(`  URL: http://localhost:${PORT}`);
    console.log('='.repeat(50));
    console.log('');
});
