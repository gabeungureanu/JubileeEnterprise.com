/**
 * GPT Service - AI Response Generation using OpenAI GPT-4
 */

import OpenAI from 'openai';

export class GPTService {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.openai = this.apiKey ? new OpenAI({ apiKey: this.apiKey }) : null;

        this.conversationHistory = [];
        this.maxHistoryLength = 10;

        this.systemPrompt = process.env.JUBILEE_SYSTEM_PROMPT ||
            `You are Jubilee, a friendly, warm, and knowledgeable AI assistant for Jubilee Enterprise.
You speak with clarity, enthusiasm, and a professional yet approachable tone.
You are helpful, patient, and always aim to provide accurate and useful information.
Keep your responses concise and conversational, suitable for spoken dialogue.
Avoid using special characters, markdown, or formatting that wouldn't translate well to speech.
Respond naturally as if having a face-to-face conversation.
Keep responses under 3 sentences unless more detail is specifically requested.`;

        this.maxTokens = parseInt(process.env.JUBILEE_MAX_TOKENS) || 150;
        this.temperature = parseFloat(process.env.JUBILEE_TEMPERATURE) || 0.7;
    }

    isConfigured() {
        return !!this.apiKey;
    }

    async generateResponse(userMessage) {
        if (!this.openai) {
            throw new Error('OpenAI API key not configured');
        }

        try {
            // Add user message to history
            this.conversationHistory.push({
                role: 'user',
                content: userMessage
            });

            // Trim history if too long
            if (this.conversationHistory.length > this.maxHistoryLength * 2) {
                this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength * 2);
            }

            // Build messages array
            const messages = [
                { role: 'system', content: this.systemPrompt },
                ...this.conversationHistory
            ];

            const response = await this.openai.chat.completions.create({
                model: 'gpt-4',
                messages: messages,
                max_tokens: this.maxTokens,
                temperature: this.temperature,
                presence_penalty: 0.6,
                frequency_penalty: 0.3
            });

            const assistantMessage = response.choices[0].message.content.trim();

            // Add assistant response to history
            this.conversationHistory.push({
                role: 'assistant',
                content: assistantMessage
            });

            return assistantMessage;
        } catch (error) {
            console.error('GPT response error:', error.message);
            throw error;
        }
    }

    clearHistory() {
        this.conversationHistory = [];
    }

    setSystemPrompt(prompt) {
        this.systemPrompt = prompt;
    }

    setMaxTokens(tokens) {
        this.maxTokens = tokens;
    }

    setTemperature(temp) {
        this.temperature = temp;
    }
}
