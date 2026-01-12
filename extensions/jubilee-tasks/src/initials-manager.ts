/**
 * Jubilee Tasks - Developer Initials Manager
 * Handles caching of developer initials with 1-year expiration
 */

import * as vscode from 'vscode';
import { InitialsData } from './types';

const INITIALS_KEY = 'jubileeTasks.developerInitials';
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export class InitialsManager {
    private context: vscode.ExtensionContext;
    private cachedInitials: string | null = null;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Get the developer's initials, prompting if not set or expired
     */
    async getInitials(): Promise<string | null> {
        // Check memory cache first
        if (this.cachedInitials) {
            return this.cachedInitials;
        }

        // Check persistent storage
        const stored = this.context.globalState.get<InitialsData>(INITIALS_KEY);

        if (stored) {
            // Check if expired (1 year)
            const now = Date.now();
            if (now - stored.timestamp < ONE_YEAR_MS) {
                this.cachedInitials = stored.initials;
                return stored.initials;
            }
        }

        // Need to prompt user
        return this.promptForInitials();
    }

    /**
     * Prompt the user for their initials
     */
    async promptForInitials(): Promise<string | null> {
        const initials = await vscode.window.showInputBox({
            title: 'Developer Initials',
            prompt: 'Enter your 2-character developer initials (e.g., GU, JD)',
            placeHolder: 'XX',
            validateInput: (value) => {
                if (!value) {
                    return 'Initials are required';
                }
                if (value.length !== 2) {
                    return 'Initials must be exactly 2 characters';
                }
                if (!/^[A-Za-z]{2}$/.test(value)) {
                    return 'Initials must contain only letters';
                }
                return null;
            }
        });

        if (initials) {
            await this.setInitials(initials.toUpperCase());
            return this.cachedInitials;
        }

        return null;
    }

    /**
     * Set the developer's initials
     */
    async setInitials(initials: string): Promise<void> {
        const normalized = initials.toUpperCase().trim();

        if (normalized.length !== 2 || !/^[A-Z]{2}$/.test(normalized)) {
            throw new Error('Initials must be exactly 2 letters');
        }

        const data: InitialsData = {
            initials: normalized,
            timestamp: Date.now()
        };

        await this.context.globalState.update(INITIALS_KEY, data);
        this.cachedInitials = normalized;

        vscode.window.showInformationMessage(`Developer initials set to: ${normalized}`);
    }

    /**
     * Force re-prompt for initials (e.g., from command)
     */
    async resetAndPrompt(): Promise<string | null> {
        this.cachedInitials = null;
        await this.context.globalState.update(INITIALS_KEY, undefined);
        return this.promptForInitials();
    }

    /**
     * Check if initials are currently set and valid
     */
    hasValidInitials(): boolean {
        const stored = this.context.globalState.get<InitialsData>(INITIALS_KEY);

        if (!stored) {
            return false;
        }

        const now = Date.now();
        return now - stored.timestamp < ONE_YEAR_MS;
    }

    /**
     * Get expiration date for current initials
     */
    getExpirationDate(): Date | null {
        const stored = this.context.globalState.get<InitialsData>(INITIALS_KEY);

        if (!stored) {
            return null;
        }

        return new Date(stored.timestamp + ONE_YEAR_MS);
    }
}
