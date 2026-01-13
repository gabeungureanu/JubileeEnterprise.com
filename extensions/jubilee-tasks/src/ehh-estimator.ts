/**
 * Jubilee Tasks - EHH (Estimated Human Hours) Estimator
 * Uses GPT-4o-mini to estimate how long a human would take to complete a task
 * at 70% efficiency without AI assistance
 */

import { DeveloperTask } from './types';

// Lazy import to prevent blocking extension activation
let OpenAI: any = null;

export class EHHEstimator {
    private openai: any = null;
    private apiKey: string | null = null;
    private initialized: boolean = false;

    constructor() {
        // Try to get API key from environment
        this.apiKey = process.env.OPENAI_API_KEY_PRIMARY ||
                      process.env.OPENAI_API_KEY ||
                      null;
    }

    private async ensureInitialized(): Promise<void> {
        if (this.initialized) return;

        try {
            if (!OpenAI) {
                const module = await import('openai');
                OpenAI = module.default;
            }

            if (this.apiKey && OpenAI) {
                this.openai = new OpenAI({ apiKey: this.apiKey });
            }
        } catch (err) {
            console.error('EHHEstimator: Failed to load OpenAI module:', err);
        }

        this.initialized = true;
    }

    /**
     * Estimate how long a human would take to complete this task at 70% efficiency
     * @param task The completed task with all metadata
     * @returns Estimated human hours in minutes, or null if estimation fails
     */
    async estimateEHH(task: DeveloperTask): Promise<number | null> {
        await this.ensureInitialized();

        // If OpenAI is not configured, use fallback estimation
        if (!this.openai) {
            return this.fallbackEstimate(task);
        }

        try {
            const durationMinutes = Math.round((task.active_duration_ms || 0) / 60000);

            const prompt = this.buildPrompt(task, durationMinutes);

            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert at estimating software development task durations. You will be given information about a task that was completed with AI assistance. Your job is to estimate how long an average human developer would take to complete the SAME task WITHOUT AI assistance, working at approximately 70% efficiency (accounting for breaks, context switching, research time, etc.).

Consider these factors:
- Complexity of the task (simple fix vs. architectural change)
- Amount of code that would need to be written/modified
- Research and documentation reading time
- Testing and debugging time
- Code review and iteration time

Return ONLY a single integer representing the estimated minutes. No explanation, no text, just the number.
For example: 180 (for 3 hours)`
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 20,
                temperature: 0.3
            });

            const content = response.choices[0]?.message?.content?.trim();

            if (content) {
                const minutes = parseInt(content, 10);
                if (!isNaN(minutes) && minutes > 0) {
                    console.log(`EHHEstimator: Task "${task.task_name}" - AI duration: ${durationMinutes}min, EHH: ${minutes}min`);
                    return minutes;
                }
            }

            // Fallback if parsing fails
            return this.fallbackEstimate(task);
        } catch (error) {
            console.error('EHHEstimator: API error:', error);
            return this.fallbackEstimate(task);
        }
    }

    /**
     * Build the prompt for GPT-4o-mini
     */
    private buildPrompt(task: DeveloperTask, durationMinutes: number): string {
        let prompt = `Task completed with AI assistance:

Task Title: ${task.task_name}
Project: ${task.project_name}`;

        if (task.original_prompt) {
            prompt += `\nOriginal Request: ${task.original_prompt}`;
        }

        if (task.project_category) {
            prompt += `\nProject Category: ${task.project_category}`;
        }

        if (task.project_type) {
            prompt += `\nProject Type: ${task.project_type}`;
        }

        prompt += `\nAI-Assisted Duration: ${durationMinutes} minutes`;

        prompt += `\n\nBased on this information, estimate how many minutes an average human developer would need to complete this same task WITHOUT AI assistance, working at 70% efficiency. Return only the number of minutes.`;

        return prompt;
    }

    /**
     * Fallback estimation when OpenAI is not available
     * Uses a multiplier based on task complexity heuristics
     */
    private fallbackEstimate(task: DeveloperTask): number {
        const durationMinutes = Math.round((task.active_duration_ms || 0) / 60000);

        // Base multiplier: AI typically speeds up work 3-5x
        let multiplier = 4;

        const taskName = task.task_name.toLowerCase();
        const prompt = (task.original_prompt || '').toLowerCase();
        const combined = taskName + ' ' + prompt;

        // Adjust multiplier based on task complexity indicators
        if (combined.includes('fix') || combined.includes('bug') || combined.includes('typo')) {
            multiplier = 2.5; // Bug fixes are relatively straightforward
        } else if (combined.includes('implement') || combined.includes('create') || combined.includes('add feature')) {
            multiplier = 5; // New features take longer
        } else if (combined.includes('refactor') || combined.includes('optimize')) {
            multiplier = 4; // Refactoring requires understanding
        } else if (combined.includes('test') || combined.includes('documentation')) {
            multiplier = 3; // Tests/docs are more mechanical
        } else if (combined.includes('design') || combined.includes('architect')) {
            multiplier = 6; // Design work requires more thought
        }

        // Minimum EHH of 15 minutes
        const ehh = Math.max(15, Math.round(durationMinutes * multiplier));

        console.log(`EHHEstimator: Fallback estimate for "${task.task_name}" - AI duration: ${durationMinutes}min, multiplier: ${multiplier}x, EHH: ${ehh}min`);

        return ehh;
    }

    /**
     * Format EHH minutes as HH:MM string
     */
    static formatEHH(minutes: number | null): string {
        if (minutes === null || minutes === undefined) {
            return '-';
        }

        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;

        return hours.toString().padStart(2, '0') + ':' + mins.toString().padStart(2, '0');
    }
}

// Singleton instance
let estimatorInstance: EHHEstimator | null = null;

export function getEHHEstimator(): EHHEstimator {
    if (!estimatorInstance) {
        estimatorInstance = new EHHEstimator();
    }
    return estimatorInstance;
}
