import OpenAI from 'openai';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export class ChatGPTService {
    private primaryClient: OpenAI | null = null;
    private backupClient: OpenAI | null = null;
    private usePrimary: boolean = true;
    private conversationHistory: ChatMessage[] = [];
    private model: string = 'gpt-4-turbo';

    constructor(primaryKey: string, backupKey: string) {
        if (primaryKey) {
            this.primaryClient = new OpenAI({ apiKey: primaryKey });
        }
        if (backupKey) {
            this.backupClient = new OpenAI({ apiKey: backupKey });
        }

        // Initialize with a system message
        this.conversationHistory.push({
            role: 'system',
            content: 'You are a helpful AI assistant integrated into VS Code. Provide concise, accurate responses focused on software development and programming tasks.'
        });
    }

    async sendMessage(userMessage: string): Promise<string> {
        if (!this.primaryClient && !this.backupClient) {
            throw new Error('No OpenAI API keys configured. Please add OPENAI_API_KEY_PRIMARY and/or OPENAI_API_KEY_BACKUP to your .env file.');
        }

        // Add user message to history
        this.conversationHistory.push({
            role: 'user',
            content: userMessage
        });

        try {
            const response = await this.callAPI();

            // Add assistant response to history
            this.conversationHistory.push({
                role: 'assistant',
                content: response
            });

            return response;
        } catch (error) {
            // Remove the user message if we failed completely
            this.conversationHistory.pop();
            throw error;
        }
    }

    private async callAPI(): Promise<string> {
        // Try primary key first
        if (this.usePrimary && this.primaryClient) {
            try {
                return await this.makeRequest(this.primaryClient);
            } catch (error: any) {
                console.log('Primary API key failed:', error.message);

                // Check if it's a rate limit or quota error
                if (this.isRecoverableError(error)) {
                    console.log('Falling back to backup API key...');
                    this.usePrimary = false;
                } else {
                    throw error;
                }
            }
        }

        // Try backup key
        if (this.backupClient) {
            try {
                return await this.makeRequest(this.backupClient);
            } catch (error: any) {
                console.log('Backup API key failed:', error.message);

                // If backup fails with recoverable error, try primary again next time
                if (this.isRecoverableError(error) && this.primaryClient) {
                    this.usePrimary = true;
                }
                throw error;
            }
        }

        throw new Error('All API keys exhausted. Please check your API key configuration.');
    }

    private async makeRequest(client: OpenAI): Promise<string> {
        const completion = await client.chat.completions.create({
            model: this.model,
            messages: this.conversationHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            max_tokens: 2048,
            temperature: 0.7
        });

        const responseContent = completion.choices[0]?.message?.content;
        if (!responseContent) {
            throw new Error('Empty response from OpenAI API');
        }

        return responseContent;
    }

    private isRecoverableError(error: any): boolean {
        // Rate limit, quota exceeded, or temporary errors
        const recoverableStatuses = [429, 500, 502, 503, 504];
        const status = error?.status || error?.response?.status;

        if (recoverableStatuses.includes(status)) {
            return true;
        }

        // Check error message for quota-related issues
        const message = error?.message?.toLowerCase() || '';
        if (message.includes('quota') || message.includes('rate limit') || message.includes('exceeded')) {
            return true;
        }

        return false;
    }

    clearHistory(): void {
        // Keep only the system message
        this.conversationHistory = [this.conversationHistory[0]];
    }

    getHistory(): ChatMessage[] {
        return [...this.conversationHistory];
    }

    setModel(model: string): void {
        this.model = model;
    }

    getModel(): string {
        return this.model;
    }
}
