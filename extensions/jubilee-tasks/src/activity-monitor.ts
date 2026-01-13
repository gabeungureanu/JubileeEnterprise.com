/**
 * Jubilee Tasks - Activity Monitor
 * Tracks developer activity with 20-minute inactivity threshold
 */

import * as vscode from 'vscode';
import { ActivityState } from './types';

export class ActivityMonitor {
    private state: ActivityState;
    private inactivityThresholdMs: number;
    private activityCheckIntervalMs: number = 60000; // Check every minute
    private activityCheckTimer: NodeJS.Timeout | null = null;
    private disposables: vscode.Disposable[] = [];

    constructor() {
        const config = vscode.workspace.getConfiguration('jubileeTasks');
        const thresholdMinutes = config.get('inactivityThresholdMinutes', 20);
        this.inactivityThresholdMs = thresholdMinutes * 60 * 1000;

        this.state = {
            lastActivity: new Date(),
            accumulatedInactivity: 0,
            taskStartTime: null
        };
    }

    /**
     * Start monitoring activity
     */
    start(): void {
        // Listen to various VS Code events to detect activity
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(() => this.onActivity()),
            vscode.workspace.onDidOpenTextDocument(() => this.onActivity()),
            vscode.workspace.onDidSaveTextDocument(() => this.onActivity()),
            vscode.window.onDidChangeActiveTextEditor(() => this.onActivity()),
            vscode.window.onDidChangeTextEditorSelection(() => this.onActivity()),
            vscode.window.onDidChangeWindowState((e) => {
                if (e.focused) {
                    this.onActivity();
                }
            }),
            vscode.window.onDidOpenTerminal(() => this.onActivity()),
            vscode.window.onDidChangeActiveTerminal(() => this.onActivity())
        );

        // Start periodic check for inactivity accumulation
        this.activityCheckTimer = setInterval(() => {
            this.checkInactivity();
        }, this.activityCheckIntervalMs);

        console.log('ActivityMonitor started');
    }

    /**
     * Stop monitoring
     */
    stop(): void {
        if (this.activityCheckTimer) {
            clearInterval(this.activityCheckTimer);
            this.activityCheckTimer = null;
        }

        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];

        console.log('ActivityMonitor stopped');
    }

    /**
     * Called when task starts
     */
    startTask(): void {
        this.state.taskStartTime = new Date();
        this.state.lastActivity = new Date();
        this.state.accumulatedInactivity = 0;
    }

    /**
     * Called on any activity event
     */
    onActivity(): void {
        const now = new Date();
        const gap = now.getTime() - this.state.lastActivity.getTime();

        // If gap exceeds threshold, accumulate the inactive time
        if (gap > this.inactivityThresholdMs) {
            this.state.accumulatedInactivity += gap;
            console.log(`Inactivity detected: ${Math.round(gap / 60000)} minutes accumulated`);
        }

        this.state.lastActivity = now;
    }

    /**
     * Periodic check for inactivity
     */
    private checkInactivity(): void {
        // This just ensures we're tracking - actual accumulation happens in onActivity
        const now = new Date();
        const timeSinceLastActivity = now.getTime() - this.state.lastActivity.getTime();

        if (timeSinceLastActivity > this.inactivityThresholdMs) {
            console.log(`Currently inactive for ${Math.round(timeSinceLastActivity / 60000)} minutes`);
        }
    }

    /**
     * Get active duration for current task
     */
    getActiveDuration(): number {
        if (!this.state.taskStartTime) {
            return 0;
        }

        // First, check for any final inactive period
        const now = new Date();
        const finalGap = now.getTime() - this.state.lastActivity.getTime();

        let totalInactivity = this.state.accumulatedInactivity;

        // If currently inactive beyond threshold, add that too
        if (finalGap > this.inactivityThresholdMs) {
            totalInactivity += finalGap;
        }

        // Calculate total time since task start
        const totalTime = now.getTime() - this.state.taskStartTime.getTime();

        // Active time = total time - inactive time
        const activeDuration = Math.max(0, totalTime - totalInactivity);

        return activeDuration;
    }

    /**
     * Get activity statistics
     */
    getStats(): {
        taskStartTime: Date | null;
        lastActivity: Date;
        accumulatedInactivityMs: number;
        activeDurationMs: number;
        isCurrentlyInactive: boolean;
    } {
        const now = new Date();
        const timeSinceLastActivity = now.getTime() - this.state.lastActivity.getTime();

        return {
            taskStartTime: this.state.taskStartTime,
            lastActivity: this.state.lastActivity,
            accumulatedInactivityMs: this.state.accumulatedInactivity,
            activeDurationMs: this.getActiveDuration(),
            isCurrentlyInactive: timeSinceLastActivity > this.inactivityThresholdMs
        };
    }

    /**
     * Reset state (called when task completes)
     */
    reset(): void {
        this.state = {
            lastActivity: new Date(),
            accumulatedInactivity: 0,
            taskStartTime: null
        };
    }

    /**
     * Format duration in HH:MM:SS
     */
    static formatDuration(ms: number): string {
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}
