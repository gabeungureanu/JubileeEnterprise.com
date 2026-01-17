/**
 * Whisper Service - Speech-to-Text using OpenAI Whisper API
 */

import OpenAI from 'openai';
import FormData from 'form-data';
import { Readable } from 'stream';

export class WhisperService {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.openai = this.apiKey ? new OpenAI({ apiKey: this.apiKey }) : null;
        this.language = 'en';
    }

    isConfigured() {
        return !!this.apiKey;
    }

    async transcribe(audioBuffer) {
        if (!this.openai) {
            throw new Error('OpenAI API key not configured');
        }

        try {
            // Convert buffer to a File-like object for the API
            const file = new File([audioBuffer], 'audio.wav', { type: 'audio/wav' });

            const response = await this.openai.audio.transcriptions.create({
                file: file,
                model: 'whisper-1',
                language: this.language,
                response_format: 'text'
            });

            return response.trim();
        } catch (error) {
            console.error('Whisper transcription error:', error.message);
            throw error;
        }
    }

    setLanguage(languageCode) {
        this.language = languageCode;
    }
}
