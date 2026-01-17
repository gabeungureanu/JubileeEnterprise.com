/**
 * Jubilee Avatar Backend Service
 *
 * Handles AI processing pipeline:
 * - Speech-to-Text (OpenAI Whisper)
 * - AI Response Generation (GPT-4)
 * - Text-to-Speech (ElevenLabs)
 * - Avatar Animation (D-ID/HeyGen)
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

import { WhisperService } from './services/whisper-service.js';
import { GPTService } from './services/gpt-service.js';
import { ElevenLabsService } from './services/elevenlabs-service.js';
import { DIDService } from './services/did-service.js';
import { Logger } from './utils/logger.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || 3950;
const logger = new Logger();

// Services
const whisperService = new WhisperService();
const gptService = new GPTService();
const elevenLabsService = new ElevenLabsService();
const didService = new DIDService();

// Session management
const sessions = new Map();
const clients = new Map();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.raw({ type: 'audio/*', limit: '50mb' }));

// Logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
            whisper: whisperService.isConfigured(),
            gpt: gptService.isConfigured(),
            elevenlabs: elevenLabsService.isConfigured(),
            did: didService.isConfigured()
        }
    });
});

// Session management
app.post('/api/session/start', (req, res) => {
    const sessionId = uuidv4();
    sessions.set(sessionId, {
        id: sessionId,
        startTime: Date.now(),
        conversationHistory: [],
        isActive: true
    });

    logger.info(`Session started: ${sessionId}`);
    res.json({ sessionId, status: 'started' });
});

app.post('/api/session/stop', (req, res) => {
    const { sessionId } = req.body;
    if (sessions.has(sessionId)) {
        sessions.get(sessionId).isActive = false;
        logger.info(`Session stopped: ${sessionId}`);
    }
    res.json({ status: 'stopped' });
});

// Audio processing endpoint (HTTP fallback)
app.post('/api/audio/process', async (req, res) => {
    const startTime = Date.now();
    const latencies = { stt: 0, ai: 0, tts: 0, avatar: 0 };

    try {
        const audioBuffer = req.body;

        // 1. Speech-to-Text
        const sttStart = Date.now();
        const transcription = await whisperService.transcribe(audioBuffer);
        latencies.stt = Date.now() - sttStart;

        if (!transcription || transcription.trim() === '') {
            return res.json({ status: 'no_speech' });
        }

        logger.info(`Transcription: ${transcription}`);

        // 2. AI Response
        const aiStart = Date.now();
        const aiResponse = await gptService.generateResponse(transcription);
        latencies.ai = Date.now() - aiStart;

        logger.info(`AI Response: ${aiResponse}`);

        // 3. Text-to-Speech
        const ttsStart = Date.now();
        const audioData = await elevenLabsService.synthesize(aiResponse);
        latencies.tts = Date.now() - ttsStart;

        // 4. Avatar (optional, if enabled)
        let avatarData = null;
        if (process.env.DID_API_KEY) {
            const avatarStart = Date.now();
            avatarData = await didService.animate(aiResponse, audioData);
            latencies.avatar = Date.now() - avatarStart;
        }

        const totalLatency = Date.now() - startTime;
        logger.info(`Total pipeline latency: ${totalLatency}ms`);

        res.json({
            status: 'success',
            transcription,
            response: aiResponse,
            audio: audioData.toString('base64'),
            avatar: avatarData,
            latencies,
            totalLatency
        });
    } catch (error) {
        logger.error(`Processing error: ${error.message}`);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// WebSocket handling
wss.on('connection', (ws) => {
    const clientId = uuidv4();
    clients.set(clientId, ws);
    logger.info(`WebSocket client connected: ${clientId}`);

    ws.on('message', async (data) => {
        try {
            // Check if binary (audio) or text (JSON command)
            if (Buffer.isBuffer(data) || data instanceof ArrayBuffer) {
                await handleAudioMessage(ws, clientId, Buffer.from(data));
            } else {
                const message = JSON.parse(data.toString());
                await handleTextMessage(ws, clientId, message);
            }
        } catch (error) {
            logger.error(`WebSocket message error: ${error.message}`);
            sendToClient(ws, { type: 'error', message: error.message });
        }
    });

    ws.on('close', () => {
        clients.delete(clientId);
        logger.info(`WebSocket client disconnected: ${clientId}`);
    });

    ws.on('error', (error) => {
        logger.error(`WebSocket error: ${error.message}`);
    });

    // Send connection confirmation
    sendToClient(ws, { type: 'connected', clientId });
});

async function handleAudioMessage(ws, clientId, audioBuffer) {
    const startTime = Date.now();
    const latencies = { stt: 0, ai: 0, tts: 0, avatar: 0 };

    try {
        // Skip first byte (message type indicator)
        const actualAudio = audioBuffer.slice(1);

        // Update pipeline status
        sendToClient(ws, { type: 'pipeline_status', stage: 'Transcribing', message: 'Processing speech...' });

        // 1. Speech-to-Text
        const sttStart = Date.now();
        const transcription = await whisperService.transcribe(actualAudio);
        latencies.stt = Date.now() - sttStart;

        if (!transcription || transcription.trim() === '') {
            sendToClient(ws, { type: 'pipeline_status', stage: 'Listening', message: 'No speech detected' });
            return;
        }

        // Send transcription
        sendToClient(ws, {
            type: 'transcription',
            text: transcription,
            confidence: 0.95,
            duration: actualAudio.length / 32000 // Approximate duration
        });

        sendToClient(ws, { type: 'debug', message: `[STT] ${transcription}` });

        // 2. AI Response
        sendToClient(ws, { type: 'pipeline_status', stage: 'GeneratingResponse', message: 'Thinking...' });

        const aiStart = Date.now();
        const aiResponse = await gptService.generateResponse(transcription);
        latencies.ai = Date.now() - aiStart;

        sendToClient(ws, {
            type: 'ai_response',
            response: aiResponse,
            tokens: aiResponse.split(' ').length * 1.3, // Approximate
            processing_time: latencies.ai
        });

        sendToClient(ws, { type: 'debug', message: `[AI] ${aiResponse.substring(0, 50)}...` });

        // 3. Text-to-Speech
        sendToClient(ws, { type: 'pipeline_status', stage: 'GeneratingSpeech', message: 'Generating voice...' });

        const ttsStart = Date.now();
        const audioData = await elevenLabsService.synthesize(aiResponse);
        latencies.tts = Date.now() - ttsStart;

        // Send TTS audio as binary message
        const ttsMessage = Buffer.alloc(audioData.length + 1);
        ttsMessage[0] = 0x01; // TTS audio type
        audioData.copy(ttsMessage, 1);
        ws.send(ttsMessage);

        sendToClient(ws, { type: 'debug', message: `[TTS] Audio generated: ${audioData.length} bytes` });

        // 4. Avatar Animation (if configured)
        if (didService.isConfigured()) {
            sendToClient(ws, { type: 'pipeline_status', stage: 'RenderingAvatar', message: 'Animating avatar...' });

            const avatarStart = Date.now();
            const avatarUrl = await didService.animate(aiResponse, audioData);
            latencies.avatar = Date.now() - avatarStart;

            if (avatarUrl) {
                sendToClient(ws, { type: 'avatar_ready', url: avatarUrl });
            }
        }

        // Send latency update
        const totalLatency = Date.now() - startTime;
        sendToClient(ws, {
            type: 'latency',
            stt: latencies.stt,
            ai: latencies.ai,
            tts: latencies.tts,
            avatar: latencies.avatar,
            total: totalLatency
        });

        // Return to listening state
        sendToClient(ws, { type: 'pipeline_status', stage: 'Listening', message: 'Listening...' });

        logger.info(`Pipeline complete in ${totalLatency}ms`);

    } catch (error) {
        logger.error(`Audio processing error: ${error.message}`);
        sendToClient(ws, { type: 'pipeline_status', stage: 'Error', message: error.message, isError: true });
        sendToClient(ws, { type: 'error', message: error.message });
    }
}

async function handleTextMessage(ws, clientId, message) {
    switch (message.type) {
        case 'ping':
            sendToClient(ws, { type: 'pong', timestamp: Date.now() });
            break;

        case 'config':
            // Update runtime configuration
            if (message.voiceId) {
                elevenLabsService.setVoiceId(message.voiceId);
            }
            if (message.avatarId) {
                didService.setAvatarId(message.avatarId);
            }
            sendToClient(ws, { type: 'config_updated' });
            break;

        case 'clear_history':
            gptService.clearHistory();
            sendToClient(ws, { type: 'history_cleared' });
            break;

        default:
            logger.warn(`Unknown message type: ${message.type}`);
    }
}

function sendToClient(ws, data) {
    if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

// Start server
server.listen(PORT, () => {
    console.log('');
    console.log('═'.repeat(55));
    console.log('   JUBILEE AVATAR - Backend Service');
    console.log('═'.repeat(55));
    console.log(`   Status:     Running`);
    console.log(`   Port:       ${PORT}`);
    console.log(`   WebSocket:  ws://localhost:${PORT}/ws`);
    console.log(`   Health:     http://localhost:${PORT}/health`);
    console.log('─'.repeat(55));
    console.log('   Services:');
    console.log(`   - Whisper:      ${whisperService.isConfigured() ? '✓ Configured' : '✗ Missing API key'}`);
    console.log(`   - GPT-4:        ${gptService.isConfigured() ? '✓ Configured' : '✗ Missing API key'}`);
    console.log(`   - ElevenLabs:   ${elevenLabsService.isConfigured() ? '✓ Configured' : '✗ Missing API key'}`);
    console.log(`   - D-ID Avatar:  ${didService.isConfigured() ? '✓ Configured' : '✗ Missing API key'}`);
    console.log('═'.repeat(55));
    console.log('');
});

export { app, server };
