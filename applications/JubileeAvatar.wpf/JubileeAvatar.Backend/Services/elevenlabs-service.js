/**
 * ElevenLabs Service - Text-to-Speech Generation
 */

import fetch from 'node-fetch';

export class ElevenLabsService {
    constructor() {
        this.apiKey = process.env.ELEVENLABS_API_KEY;
        this.voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Rachel
        this.baseUrl = 'https://api.elevenlabs.io/v1';

        this.voiceSettings = {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true
        };
    }

    isConfigured() {
        return !!this.apiKey;
    }

    async synthesize(text) {
        if (!this.apiKey) {
            throw new Error('ElevenLabs API key not configured');
        }

        try {
            const response = await fetch(
                `${this.baseUrl}/text-to-speech/${this.voiceId}/stream`,
                {
                    method: 'POST',
                    headers: {
                        'Accept': 'audio/mpeg',
                        'Content-Type': 'application/json',
                        'xi-api-key': this.apiKey
                    },
                    body: JSON.stringify({
                        text: text,
                        model_id: 'eleven_monolingual_v1',
                        voice_settings: this.voiceSettings
                    })
                }
            );

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        } catch (error) {
            console.error('ElevenLabs synthesis error:', error.message);
            throw error;
        }
    }

    setVoiceId(voiceId) {
        this.voiceId = voiceId;
    }

    setVoiceSettings(settings) {
        this.voiceSettings = { ...this.voiceSettings, ...settings };
    }

    async getVoices() {
        if (!this.apiKey) {
            throw new Error('ElevenLabs API key not configured');
        }

        try {
            const response = await fetch(`${this.baseUrl}/voices`, {
                headers: {
                    'xi-api-key': this.apiKey
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to get voices: ${response.status}`);
            }

            const data = await response.json();
            return data.voices;
        } catch (error) {
            console.error('Error getting voices:', error.message);
            throw error;
        }
    }
}
