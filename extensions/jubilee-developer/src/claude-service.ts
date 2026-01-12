import Anthropic from '@anthropic-ai/sdk';

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface FileContext {
    fileName: string;
    language: string;
    content: string;
    selection?: string;
}

export class ClaudeService {
    private client: Anthropic | null = null;
    private conversationHistory: ChatMessage[] = [];
    private model: string = 'claude-sonnet-4-20250514';
    private maxTokens: number = 4096;

    constructor(apiKey: string) {
        if (apiKey) {
            this.client = new Anthropic({ apiKey });
        }
    }

    setModel(model: string): void {
        this.model = model;
    }

    setMaxTokens(maxTokens: number): void {
        this.maxTokens = maxTokens;
    }

    async sendMessage(userMessage: string, fileContext?: FileContext): Promise<string> {
        if (!this.client) {
            throw new Error('Claude API key not configured. Please add ANTHROPIC_API_KEY to your .env file.');
        }

        // Build the message with optional file context
        let fullMessage = userMessage;

        if (fileContext) {
            const contextParts: string[] = [];

            if (fileContext.fileName) {
                contextParts.push(`File: ${fileContext.fileName}`);
            }
            if (fileContext.language) {
                contextParts.push(`Language: ${fileContext.language}`);
            }
            if (fileContext.selection) {
                contextParts.push(`\nSelected code:\n\`\`\`${fileContext.language}\n${fileContext.selection}\n\`\`\``);
            } else if (fileContext.content) {
                // Include truncated file content if no selection
                const truncatedContent = fileContext.content.length > 5000
                    ? fileContext.content.substring(0, 5000) + '\n... (truncated)'
                    : fileContext.content;
                contextParts.push(`\nFile content:\n\`\`\`${fileContext.language}\n${truncatedContent}\n\`\`\``);
            }

            if (contextParts.length > 0) {
                fullMessage = `${contextParts.join('\n')}\n\nUser request: ${userMessage}`;
            }
        }

        // Add user message to history
        this.conversationHistory.push({
            role: 'user',
            content: fullMessage
        });

        try {
            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: this.maxTokens,
                system: `You are Jubilee Developer, an expert AI programming assistant integrated into VS Code. You help developers write, understand, debug, and improve code.

Key behaviors:
- Provide concise, accurate responses focused on the code and task at hand
- When showing code, use appropriate markdown code blocks with language tags
- Explain your reasoning briefly when making suggestions
- If you need more context, ask specific questions
- Prioritize working solutions over perfect solutions
- Be direct and efficient - developers value their time`,
                messages: this.conversationHistory.map(msg => ({
                    role: msg.role,
                    content: msg.content
                }))
            });

            const assistantMessage = response.content[0].type === 'text'
                ? response.content[0].text
                : '';

            // Add assistant response to history
            this.conversationHistory.push({
                role: 'assistant',
                content: assistantMessage
            });

            return assistantMessage;
        } catch (error: any) {
            // Remove the failed user message from history
            this.conversationHistory.pop();

            if (error?.status === 401) {
                throw new Error('Invalid API key. Please check your ANTHROPIC_API_KEY in the .env file.');
            }
            if (error?.status === 429) {
                throw new Error('Rate limit exceeded. Please wait a moment and try again.');
            }
            if (error?.status === 500 || error?.status === 503) {
                throw new Error('Claude API is temporarily unavailable. Please try again later.');
            }

            throw new Error(error?.message || 'Failed to communicate with Claude API');
        }
    }

    async streamMessage(
        userMessage: string,
        fileContext?: FileContext,
        onChunk?: (chunk: string) => void
    ): Promise<string> {
        if (!this.client) {
            throw new Error('Claude API key not configured. Please add ANTHROPIC_API_KEY to your .env file.');
        }

        // Build the message with optional file context
        let fullMessage = userMessage;

        if (fileContext) {
            const contextParts: string[] = [];

            if (fileContext.fileName) {
                contextParts.push(`File: ${fileContext.fileName}`);
            }
            if (fileContext.language) {
                contextParts.push(`Language: ${fileContext.language}`);
            }
            if (fileContext.selection) {
                contextParts.push(`\nSelected code:\n\`\`\`${fileContext.language}\n${fileContext.selection}\n\`\`\``);
            }

            if (contextParts.length > 0) {
                fullMessage = `${contextParts.join('\n')}\n\nUser request: ${userMessage}`;
            }
        }

        // Add user message to history
        this.conversationHistory.push({
            role: 'user',
            content: fullMessage
        });

        try {
            let fullResponse = '';

            const stream = this.client.messages.stream({
                model: this.model,
                max_tokens: this.maxTokens,
                system: `You are Jubilee Developer, an expert AI programming assistant integrated into VS Code. You help developers write, understand, debug, and improve code.

Key behaviors:
- Provide concise, accurate responses focused on the code and task at hand
- When showing code, use appropriate markdown code blocks with language tags
- Explain your reasoning briefly when making suggestions
- If you need more context, ask specific questions
- Prioritize working solutions over perfect solutions
- Be direct and efficient - developers value their time`,
                messages: this.conversationHistory.map(msg => ({
                    role: msg.role,
                    content: msg.content
                }))
            });

            for await (const event of stream) {
                if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                    const chunk = event.delta.text;
                    fullResponse += chunk;
                    if (onChunk) {
                        onChunk(chunk);
                    }
                }
            }

            // Add assistant response to history
            this.conversationHistory.push({
                role: 'assistant',
                content: fullResponse
            });

            return fullResponse;
        } catch (error: any) {
            // Remove the failed user message from history
            this.conversationHistory.pop();
            throw error;
        }
    }

    clearHistory(): void {
        this.conversationHistory = [];
    }

    getHistory(): ChatMessage[] {
        return [...this.conversationHistory];
    }

    getLastResponse(): string {
        const lastAssistant = this.conversationHistory
            .filter(m => m.role === 'assistant')
            .pop();
        return lastAssistant?.content || '';
    }
}
