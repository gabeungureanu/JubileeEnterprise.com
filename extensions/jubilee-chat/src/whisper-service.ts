import OpenAI from 'openai';
import * as fs from 'fs';

export class WhisperService {
    private client: OpenAI | null = null;

    constructor(apiKey: string) {
        if (apiKey) {
            this.client = new OpenAI({ apiKey });
        }
    }

    async transcribeFile(audioFilePath: string): Promise<string> {
        if (!this.client) {
            throw new Error('OpenAI API key not configured');
        }

        if (!fs.existsSync(audioFilePath)) {
            throw new Error('Audio file not found');
        }

        // Call Whisper API
        const transcription = await this.client.audio.transcriptions.create({
            file: fs.createReadStream(audioFilePath),
            model: 'whisper-1',
            language: 'en'
        });

        return transcription.text;
    }
}