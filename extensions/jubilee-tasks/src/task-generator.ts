/**
 * Jubilee Tasks - Task Title Generator
 * Uses GPT-4o-mini to generate concise task titles from user prompts
 */

import OpenAI from 'openai';

export class TaskGenerator {
    private openai: OpenAI | null = null;
    private apiKey: string | null = null;

    constructor() {
        // Try to get API key from environment
        this.apiKey = process.env.OPENAI_API_KEY_PRIMARY ||
                      process.env.OPENAI_API_KEY ||
                      null;

        if (this.apiKey) {
            this.openai = new OpenAI({ apiKey: this.apiKey });
        }
    }

    /**
     * Set the OpenAI API key
     */
    setApiKey(apiKey: string): void {
        this.apiKey = apiKey;
        this.openai = new OpenAI({ apiKey });
    }

    /**
     * Check if the generator is configured
     */
    isConfigured(): boolean {
        return this.openai !== null;
    }

    /**
     * Generate a task title from a user prompt
     */
    async generateTaskTitle(userPrompt: string): Promise<string> {
        // If OpenAI is not configured, use fallback
        if (!this.openai) {
            return this.generateFallbackTitle(userPrompt);
        }

        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `You are a task title generator. Generate a concise, professional task title (maximum 100 characters) from a developer's prompt. The title should:
- Be in imperative form (e.g., "Add user authentication", "Fix pagination bug")
- Capture the main action being requested
- Be specific but concise
- Not include unnecessary words like "please", "can you", etc.

Return ONLY the title, no explanation or extra text.`
                    },
                    {
                        role: 'user',
                        content: userPrompt
                    }
                ],
                max_tokens: 60,
                temperature: 0.3
            });

            const title = response.choices[0]?.message?.content?.trim();

            if (title) {
                // Ensure max length and clean up
                return this.cleanTitle(title);
            }

            return this.generateFallbackTitle(userPrompt);
        } catch (error) {
            console.error('TaskGenerator error:', error);
            return this.generateFallbackTitle(userPrompt);
        }
    }

    /**
     * Generate a fallback title without AI
     */
    private generateFallbackTitle(userPrompt: string): string {
        // Clean up the prompt
        let title = userPrompt
            .replace(/^(please|can you|could you|i need|i want|help me)\s+/i, '')
            .replace(/[?!.]+$/, '')
            .trim();

        // Capitalize first letter
        if (title.length > 0) {
            title = title.charAt(0).toUpperCase() + title.slice(1);
        }

        return this.cleanTitle(title);
    }

    /**
     * Clean and truncate a title
     */
    private cleanTitle(title: string): string {
        // Remove quotes if wrapped
        title = title.replace(/^["']|["']$/g, '');

        // Truncate to 100 chars with ellipsis if needed
        if (title.length > 100) {
            title = title.substring(0, 97) + '...';
        }

        // Ensure non-empty
        if (!title.trim()) {
            title = 'Development task';
        }

        return title.trim();
    }

    /**
     * Extract keywords from a prompt (for categorization)
     */
    extractKeywords(prompt: string): string[] {
        const keywords: string[] = [];
        const lowered = prompt.toLowerCase();

        // Action keywords
        const actions = ['add', 'create', 'implement', 'fix', 'update', 'remove', 'delete',
                        'refactor', 'optimize', 'debug', 'test', 'deploy', 'configure',
                        'setup', 'integrate', 'migrate', 'upgrade', 'document'];

        for (const action of actions) {
            if (lowered.includes(action)) {
                keywords.push(action);
            }
        }

        // Technical keywords
        const tech = ['api', 'database', 'ui', 'frontend', 'backend', 'authentication',
                     'authorization', 'validation', 'error', 'bug', 'feature', 'component',
                     'service', 'endpoint', 'route', 'model', 'view', 'controller'];

        for (const t of tech) {
            if (lowered.includes(t)) {
                keywords.push(t);
            }
        }

        return [...new Set(keywords)]; // Remove duplicates
    }
}

// Singleton instance
let generatorInstance: TaskGenerator | null = null;

export function getTaskGenerator(): TaskGenerator {
    if (!generatorInstance) {
        generatorInstance = new TaskGenerator();
    }
    return generatorInstance;
}
