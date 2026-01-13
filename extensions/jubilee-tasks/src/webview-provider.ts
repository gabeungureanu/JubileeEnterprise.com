/**
 * Jubilee Tasks - Webview Provider
 * Provides the task grid UI in a VS Code webview panel
 */

import * as vscode from 'vscode';
import { getTaskService } from './task-service';
import { DeveloperTask } from './types';

export class TasksWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'jubileeTasksPanel';
    private _view?: vscode.WebviewView;
    private refreshInterval?: NodeJS.Timeout;
    private currentTaskId?: string;
    private developerInitials?: string;
    private initialsValidated: boolean = false;
    private onInitialsSubmittedCallback?: (initials: string) => Promise<void>;

    constructor(
        private readonly extensionUri: vscode.Uri
    ) {}

    /**
     * Set callback for when initials are submitted via inline UI
     */
    public setOnInitialsSubmitted(callback: (initials: string) => Promise<void>): void {
        this.onInitialsSubmittedCallback = callback;
    }

    /**
     * Mark initials as validated (hides the input UI and updates header)
     */
    public setInitialsValidated(validated: boolean): void {
        this.initialsValidated = validated;
        if (this._view) {
            this._view.webview.postMessage({
                command: 'setInitialsValidated',
                validated: validated,
                initials: this.developerInitials
            });
        }
    }

    public setDeveloperInitials(initials: string | undefined): void {
        this.developerInitials = initials;
        if (this._view) {
            this._view.webview.postMessage({
                command: 'updateInitials',
                initials: initials
            });
        }
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        console.log('Jubilee Tasks: resolveWebviewView called');
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        webviewView.webview.html = this.getHtmlContent();
        console.log('Jubilee Tasks: HTML content set');

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            console.log('Jubilee Tasks: Received message from webview:', message);
            switch (message.command) {
                case 'refresh':
                    await this.refreshTasks();
                    break;
                case 'completeTask':
                    await this.completeTask(message.taskId);
                    break;
                case 'submitInitials':
                    if (this.onInitialsSubmittedCallback && message.initials) {
                        try {
                            await this.onInitialsSubmittedCallback(message.initials);
                            // Callback will call setInitialsValidated on success
                        } catch (err) {
                            this._view?.webview.postMessage({
                                command: 'initialsError',
                                error: err instanceof Error ? err.message : 'Failed to save initials'
                            });
                        }
                    }
                    break;
                case 'completeTaskWithOptions':
                    await this.completeTaskWithOptions(message.taskId, message.durationMs, message.ehhMinutes);
                    break;
            }
        });

        // Initial load - use setTimeout to ensure webview is ready
        setTimeout(() => {
            console.log('Jubilee Tasks: Starting initial refresh');
            this.refreshTasks();
        }, 100);

        // Setup auto-refresh
        const config = vscode.workspace.getConfiguration('jubileeTasks');
        const intervalSeconds = config.get('autoRefreshIntervalSeconds', 30);
        this.refreshInterval = setInterval(() => {
            this.refreshTasks();
        }, intervalSeconds * 1000);

        webviewView.onDidDispose(() => {
            console.log('Jubilee Tasks: Webview disposed');
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
            }
        });
    }

    public setCurrentTask(taskId: string | undefined): void {
        this.currentTaskId = taskId;
        this.refreshTasks();
    }

    public async refreshTasks(): Promise<void> {
        console.log('Jubilee Tasks: refreshTasks called, _view exists:', !!this._view);
        if (!this._view) {
            console.log('Jubilee Tasks: No view, returning');
            return;
        }

        try {
            console.log('Jubilee Tasks: Getting task service');
            const taskService = getTaskService();
            console.log('Jubilee Tasks: Fetching tasks from API');
            const response = await taskService.getTasks({ limit: 50 });
            console.log('Jubilee Tasks: API response:', JSON.stringify(response).substring(0, 200));

            if (response.success) {
                // Group tasks by date (handle empty array)
                const tasks = response.data || [];
                console.log('Jubilee Tasks: Got', tasks.length, 'tasks');
                const groupedTasks = this.groupTasksByDate(tasks);

                console.log('Jubilee Tasks: Posting updateTasks message');
                this._view.webview.postMessage({
                    command: 'updateTasks',
                    tasks: groupedTasks,
                    currentTaskId: this.currentTaskId
                });
            } else {
                // Send error to webview
                console.log('Jubilee Tasks: API error:', response.error);
                this._view.webview.postMessage({
                    command: 'error',
                    error: response.error || 'Failed to load tasks'
                });
            }
        } catch (err) {
            console.error('Jubilee Tasks: Failed to refresh tasks:', err);
            this._view.webview.postMessage({
                command: 'error',
                error: err instanceof Error ? err.message : 'Unknown error'
            });
        }
    }

    private groupTasksByDate(tasks: DeveloperTask[]): Record<string, DeveloperTask[]> {
        const groups: Record<string, DeveloperTask[]> = {};

        for (const task of tasks) {
            const date = new Date(task.start_time);
            const dateKey = date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(task);
        }

        return groups;
    }

    private async completeTask(taskId: string): Promise<void> {
        // This is called from the webview - emit event for extension to handle
        vscode.commands.executeCommand('jubileeTasks.completeCurrentTask');
    }

    private async completeTaskWithOptions(taskId: string, durationMs: number, ehhMinutes: number | null): Promise<void> {
        // Complete a specific task with manual duration and optional EHH override
        const taskService = getTaskService();

        // Ensure minimum 1 minute duration
        const minDurationMs = 60000;
        const finalDurationMs = Math.max(durationMs, minDurationMs);

        try {
            const response = await taskService.completeTask(taskId, {
                active_duration_ms: finalDurationMs,
                ehh_minutes: ehhMinutes || undefined
            });

            if (response.success) {
                vscode.window.showInformationMessage(`Task completed successfully`);
                await this.refreshTasks();
            } else {
                vscode.window.showErrorMessage(`Failed to complete task: ${response.error}`);
            }
        } catch (err) {
            vscode.window.showErrorMessage(`Error completing task: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    private getHtmlContent(): string {
        const nonce = this.getNonce();
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Jubilee Tasks</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-sideBar-background);
            padding: 8px;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--vscode-widget-border);
        }

        .header h2 {
            font-size: 14px;
            font-weight: 600;
        }

        .refresh-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
        }

        .refresh-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .date-group {
            margin-bottom: 16px;
        }

        .date-header {
            font-size: 12px;
            font-weight: 600;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
            padding: 4px 0;
        }

        .date-separator {
            width: 100%;
            height: 1px;
            background-color: #ffffff;
            margin: 4px 0 8px 0;
        }

        .totals-row {
            font-weight: 600;
        }

        .totals-row td {
            padding-top: 8px;
            padding-bottom: 8px;
            border-top: 1px solid #ffffff;
            border-bottom: 1px solid #ffffff;
        }

        .totals-label {
            text-align: right;
            padding-right: 12px;
            font-weight: 600;
        }

        .task-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
        }

        .task-table th {
            text-align: left;
            padding: 4px 6px;
            background: rgba(255, 215, 0, 0.5);
            color: #ffffff;
            font-weight: 700;
            border-bottom: 1px solid var(--vscode-widget-border);
        }

        .task-table td {
            padding: 6px;
            border-bottom: 1px solid var(--vscode-widget-border);
            vertical-align: middle;
        }

        .task-table tr:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .task-table tr.current {
            background: var(--vscode-list-activeSelectionBackground);
        }

        .task-table tbody tr:last-child td {
            border-bottom: 1px solid #ffffff;
        }

        .task-code {
            font-family: var(--vscode-editor-font-family);
            font-weight: 600;
            color: var(--vscode-textLink-foreground);
            white-space: nowrap;
        }

        .dev-initials {
            font-weight: 600;
            text-align: center;
        }

        .task-name {
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .time {
            white-space: nowrap;
            font-family: var(--vscode-editor-font-family);
            font-size: 10px;
            text-align: center;
        }

        .duration {
            font-family: var(--vscode-editor-font-family);
            white-space: nowrap;
            text-align: center;
        }

        .status {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 10px;
            font-weight: 500;
            text-transform: uppercase;
            min-width: 80px;
            text-align: center;
        }

        .status.complete {
            background: #1e6e1e;
            color: white;
        }

        .status.in_progress {
            background: var(--vscode-progressBar-background);
            color: white;
        }

        .status-link {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 10px;
            font-weight: 500;
            text-transform: uppercase;
            min-width: 80px;
            text-align: center;
            text-decoration: none;
            cursor: pointer;
        }

        .status-link.in_progress {
            background: #cc7700;
            color: white;
        }

        .status-link.in_progress:hover {
            background: #ff9900;
            text-decoration: underline;
        }

        /* Complete Task Dialog */
        .task-dialog-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
        }

        .task-dialog-overlay.hidden {
            display: none;
        }

        .task-dialog {
            background: var(--vscode-editor-background);
            border: 2px solid #ffd700;
            border-radius: 8px;
            padding: 20px;
            min-width: 300px;
            max-width: 400px;
        }

        .task-dialog h3 {
            margin: 0 0 15px 0;
            color: #ffd700;
            font-size: 14px;
        }

        .task-dialog-field {
            margin-bottom: 15px;
        }

        .task-dialog-field label {
            display: block;
            font-size: 12px;
            margin-bottom: 5px;
            color: var(--vscode-foreground);
        }

        .task-dialog-field input {
            width: 100%;
            padding: 8px;
            font-size: 14px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            box-sizing: border-box;
        }

        .task-dialog-field input:focus {
            outline: none;
            border-color: #ffd700;
        }

        .task-dialog-buttons {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }

        .task-dialog-btn {
            padding: 8px 16px;
            font-size: 12px;
            font-weight: 600;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }

        .task-dialog-btn.cancel {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .task-dialog-btn.confirm {
            background: #ffd700;
            color: #000;
        }

        .task-dialog-btn.confirm:hover {
            background: #ffec8b;
        }

        .empty-state {
            text-align: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
        }

        .loading {
            text-align: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
        }

        /* Inline Initials Input Styles */
        .initials-overlay {
            position: fixed;
            bottom: 0;
            right: 0;
            left: 0;
            background: rgba(0, 0, 0, 0.85);
            padding: 16px;
            border-top: 2px solid #ffd700;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
        }

        .initials-overlay.hidden {
            display: none;
        }

        .initials-container {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 8px;
        }

        .initials-label {
            font-size: 12px;
            font-weight: 600;
            color: #ffd700;
            margin-right: 8px;
            white-space: nowrap;
        }

        .initials-row {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .initials-input {
            width: 60px;
            padding: 6px 10px;
            font-size: 14px;
            font-weight: 600;
            text-transform: uppercase;
            text-align: center;
            border: 2px solid #ffd700;
            border-radius: 4px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            outline: none;
        }

        .initials-input:focus {
            border-color: #ffec8b;
            box-shadow: 0 0 4px rgba(255, 215, 0, 0.5);
        }

        .initials-input.error {
            border-color: var(--vscode-errorForeground);
        }

        .initials-submit {
            padding: 6px 16px;
            font-size: 12px;
            font-weight: 700;
            background: #ffd700;
            color: #000000;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            text-transform: uppercase;
        }

        .initials-submit:hover {
            background: #ffec8b;
        }

        .initials-submit:disabled {
            background: #666;
            color: #999;
            cursor: not-allowed;
        }

        .initials-error {
            font-size: 11px;
            color: var(--vscode-errorForeground);
            margin-top: 4px;
            text-align: right;
        }

        .initials-hint {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            margin-top: 2px;
        }

        /* Content area padding when overlay is visible */
        body.initials-required {
            padding-bottom: 100px;
        }
    </style>
</head>
<body class="${this.initialsValidated ? '' : 'initials-required'}">
    <div class="header">
        <h2>Developer Tasks <span id="initials-display">${this.developerInitials ? '(' + this.developerInitials + ')' : ''}</span></h2>
        <button id="refresh-btn" class="refresh-btn">Refresh</button>
    </div>
    <div id="content">
        <div class="loading">${this.initialsValidated ? 'Loading tasks...' : 'Enter your initials to begin tracking'}</div>
    </div>

    <!-- Inline Initials Input -->
    <div id="initials-overlay" class="initials-overlay ${this.initialsValidated ? 'hidden' : ''}">
        <div class="initials-container">
            <div class="initials-row">
                <span class="initials-label">Developer Initials</span>
                <input type="text"
                       id="initials-input"
                       class="initials-input"
                       maxlength="2"
                       placeholder="XX"
                       autocomplete="off"
                       spellcheck="false">
                <button id="initials-submit" class="initials-submit">Submit</button>
            </div>
            <div id="initials-error" class="initials-error" style="display: none;"></div>
            <div class="initials-hint">Enter your 2-letter initials (e.g., GU, JD)</div>
        </div>
    </div>

    <!-- Complete Task Dialog -->
    <div id="task-dialog-overlay" class="task-dialog-overlay hidden">
        <div class="task-dialog">
            <h3>Complete Task: <span id="dialog-task-code"></span></h3>
            <div class="task-dialog-field">
                <label for="dialog-duration">Duration (minutes) - minimum 1:</label>
                <input type="number" id="dialog-duration" min="1" value="1" placeholder="1">
            </div>
            <div class="task-dialog-field">
                <label for="dialog-ehh">EHH (minutes) - optional override:</label>
                <input type="number" id="dialog-ehh" min="0" placeholder="Leave blank for auto-estimate">
            </div>
            <div class="task-dialog-buttons">
                <button id="dialog-cancel-btn" class="task-dialog-btn cancel">Cancel</button>
                <button id="dialog-confirm-btn" class="task-dialog-btn confirm">Complete Task</button>
            </div>
        </div>
    </div>

    <script nonce="${nonce}">
        console.log('Jubilee Tasks Webview: Script loaded');
        const vscode = acquireVsCodeApi();
        console.log('Jubilee Tasks Webview: vscode API acquired');

        // Track initials validation state
        let initialsValidated = ${this.initialsValidated};

        function refresh() {
            console.log('Jubilee Tasks Webview: Refresh clicked');
            vscode.postMessage({ command: 'refresh' });
        }

        function completeTask(taskId) {
            vscode.postMessage({ command: 'completeTask', taskId: taskId });
        }

        // Complete Task Dialog handling
        let currentDialogTaskId = null;

        function showCompleteTaskDialog(taskId, taskCode) {
            currentDialogTaskId = taskId;
            document.getElementById('dialog-task-code').textContent = taskCode;
            document.getElementById('dialog-duration').value = '1';
            document.getElementById('dialog-ehh').value = '';
            document.getElementById('task-dialog-overlay').classList.remove('hidden');
            document.getElementById('dialog-duration').focus();
        }

        function hideCompleteTaskDialog() {
            currentDialogTaskId = null;
            document.getElementById('task-dialog-overlay').classList.add('hidden');
        }

        function confirmCompleteTask() {
            if (!currentDialogTaskId) return;

            const durationInput = document.getElementById('dialog-duration');
            const ehhInput = document.getElementById('dialog-ehh');

            // Ensure minimum duration of 1 minute
            let durationMinutes = parseInt(durationInput.value) || 1;
            if (durationMinutes < 1) durationMinutes = 1;

            const durationMs = durationMinutes * 60 * 1000;

            // EHH is optional - if provided, use it; otherwise let the system estimate
            const ehhMinutes = ehhInput.value ? parseInt(ehhInput.value) : null;

            vscode.postMessage({
                command: 'completeTaskWithOptions',
                taskId: currentDialogTaskId,
                durationMs: durationMs,
                ehhMinutes: ehhMinutes
            });

            hideCompleteTaskDialog();
        }

        // Close dialog on Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                hideCompleteTaskDialog();
            }
        });

        // Initials input handling
        function validateInitials(value) {
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

        function submitInitials() {
            const input = document.getElementById('initials-input');
            const errorDiv = document.getElementById('initials-error');
            const submitBtn = document.getElementById('initials-submit');

            const value = input.value.trim().toUpperCase();
            const error = validateInitials(value);

            if (error) {
                input.classList.add('error');
                errorDiv.textContent = error;
                errorDiv.style.display = 'block';
                return;
            }

            // Clear error state
            input.classList.remove('error');
            errorDiv.style.display = 'none';

            // Disable button while submitting
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';

            // Send to extension
            vscode.postMessage({ command: 'submitInitials', initials: value });
        }

        function hideInitialsOverlay() {
            const overlay = document.getElementById('initials-overlay');
            if (overlay) {
                overlay.classList.add('hidden');
            }
            document.body.classList.remove('initials-required');
            initialsValidated = true;
        }

        function showInitialsError(errorMessage) {
            const input = document.getElementById('initials-input');
            const errorDiv = document.getElementById('initials-error');
            const submitBtn = document.getElementById('initials-submit');

            input.classList.add('error');
            errorDiv.textContent = errorMessage;
            errorDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit';
        }

        // Setup all event listeners immediately (document is already loaded in webview)
        (function initEventListeners() {
            console.log('Jubilee Tasks: Setting up event listeners');

            // Refresh button
            const refreshBtn = document.getElementById('refresh-btn');
            if (refreshBtn) {
                console.log('Jubilee Tasks: Found refresh button');
                refreshBtn.addEventListener('click', function() {
                    console.log('Jubilee Tasks: Refresh button clicked');
                    refresh();
                });
            }

            // Initials submit button
            const submitBtn = document.getElementById('initials-submit');
            if (submitBtn) {
                console.log('Jubilee Tasks: Found submit button');
                submitBtn.addEventListener('click', function() {
                    console.log('Jubilee Tasks: Submit button clicked');
                    submitInitials();
                });
            } else {
                console.log('Jubilee Tasks: Submit button NOT found');
            }

            // Dialog cancel button
            const cancelBtn = document.getElementById('dialog-cancel-btn');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', function() {
                    hideCompleteTaskDialog();
                });
            }

            // Dialog confirm button
            const confirmBtn = document.getElementById('dialog-confirm-btn');
            if (confirmBtn) {
                confirmBtn.addEventListener('click', function() {
                    confirmCompleteTask();
                });
            }

            // Event delegation for dynamically created task completion links
            document.addEventListener('click', function(e) {
                const target = e.target;
                if (target && target.dataset && target.dataset.action === 'complete-task') {
                    e.preventDefault();
                    const taskId = target.dataset.taskId;
                    const taskCode = target.dataset.taskCode;
                    if (taskId && taskCode) {
                        showCompleteTaskDialog(taskId, taskCode);
                    }
                }
            });

            // Initials input field
            const input = document.getElementById('initials-input');
            if (input) {
                console.log('Jubilee Tasks: Found initials input');
                // Auto-uppercase as user types
                input.addEventListener('input', function(e) {
                    e.target.value = e.target.value.toUpperCase();
                    // Clear error state on input
                    e.target.classList.remove('error');
                    document.getElementById('initials-error').style.display = 'none';
                });

                // Submit on Enter key
                input.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        console.log('Jubilee Tasks: Enter pressed in input');
                        submitInitials();
                    }
                });

                // Focus the input if overlay is visible
                if (!initialsValidated) {
                    setTimeout(function() { input.focus(); }, 100);
                }
            }

            console.log('Jubilee Tasks: Event listeners setup complete');
        })();

        function formatTime(isoString) {
            const date = new Date(isoString);
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        }

        function renderTasks(groupedTasks, currentTaskId) {
            const content = document.getElementById('content');
            const dates = Object.keys(groupedTasks);

            if (dates.length === 0) {
                content.innerHTML = '<div class="empty-state">No tasks yet. Start working to track your first task!</div>';
                return;
            }

            let html = '';

            for (const date of dates) {
                const tasks = groupedTasks[date];

                // Calculate daily totals (only for completed tasks)
                const completedTasks = tasks.filter(t => t.status === 'complete');
                let totalDurationMs = 0;
                let totalEhhMinutes = 0;
                let earliestStart = null;
                let latestEnd = null;

                for (const task of completedTasks) {
                    totalDurationMs += parseInt(task.active_duration_ms) || 0;
                    totalEhhMinutes += parseInt(task.ehh_minutes) || 0;

                    const startTime = new Date(task.start_time);
                    const endTime = task.end_time ? new Date(task.end_time) : null;

                    if (!earliestStart || startTime < earliestStart) {
                        earliestStart = startTime;
                    }
                    if (endTime && (!latestEnd || endTime > latestEnd)) {
                        latestEnd = endTime;
                    }
                }

                html += '<div class="date-group">';
                html += '<div class="date-header">' + date + '</div>';
                html += '<div class="date-separator"></div>';
                html += '<table class="task-table">';
                html += '<thead><tr>';
                html += '<th>Task ID</th>';
                html += '<th>Dev</th>';
                html += '<th>Task Name</th>';
                html += '<th style="text-align: center;">Start</th>';
                html += '<th style="text-align: center;">End</th>';
                html += '<th style="text-align: center;">Duration</th>';
                html += '<th style="text-align: center;">EHH</th>';
                html += '<th style="text-align: center;">Task Status</th>';
                html += '</tr></thead>';
                html += '<tbody>';

                for (const task of tasks) {
                    const isCurrent = task.id === currentTaskId;
                    const isInProgress = task.status === 'in_progress';

                    html += '<tr class="' + (isCurrent ? 'current' : '') + '">';
                    html += '<td class="task-code">' + task.task_code + '</td>';
                    html += '<td class="dev-initials">' + task.developer_initials + '</td>';
                    html += '<td class="task-name" title="' + escapeHtml(task.task_name) + '">' + escapeHtml(task.task_name) + '</td>';
                    html += '<td class="time">' + formatTime(task.start_time) + '</td>';

                    // Hide End, Duration, EHH for in-progress tasks
                    if (isInProgress) {
                        html += '<td class="time">-</td>';
                        html += '<td class="duration">-</td>';
                        html += '<td class="duration">-</td>';
                    } else {
                        html += '<td class="time">' + (task.end_time ? formatTime(task.end_time) : '-') + '</td>';
                        html += '<td class="duration">' + formatDurationDisplay(task.duration_formatted, task.active_duration_ms) + '</td>';
                        html += '<td class="duration">' + formatEHH(task.ehh_minutes, task.ehh_formatted) + '</td>';
                    }

                    // Make in_progress status a clickable link to close the task
                    if (isInProgress) {
                        html += '<td style="text-align: center;"><a href="#" class="status-link ' + task.status + '" data-action="complete-task" data-task-id="' + task.id + '" data-task-code="' + escapeHtml(task.task_code) + '">' + task.status.replace('_', ' ') + '</a></td>';
                    } else {
                        html += '<td style="text-align: center;"><span class="status ' + task.status + '">' + task.status.replace('_', ' ') + '</span></td>';
                    }
                    html += '</tr>';
                }

                // Daily totals row (only shown if there are completed tasks)
                if (completedTasks.length > 0) {
                    html += '<tfoot><tr class="totals-row">';
                    html += '<td colspan="3" class="totals-label">TOTALS:</td>';
                    html += '<td class="time">' + (earliestStart ? formatTime(earliestStart.toISOString()) : '-') + '</td>';
                    html += '<td class="time">' + (latestEnd ? formatTime(latestEnd.toISOString()) : '-') + '</td>';
                    html += '<td class="duration">' + formatDuration(totalDurationMs) + '</td>';
                    html += '<td class="duration">' + formatMinutesToHHMM(totalEhhMinutes) + '</td>';
                    html += '<td></td>';
                    html += '</tr></tfoot>';
                }

                html += '</table>';
                html += '</div>';
            }

            content.innerHTML = html;
        }

        function formatDuration(ms) {
            if (!ms) return '00:00';
            const hours = Math.floor(ms / 3600000);
            const minutes = Math.floor((ms % 3600000) / 60000);
            return hours.toString().padStart(2, '0') + ':' +
                   minutes.toString().padStart(2, '0');
        }

        function formatDurationDisplay(formatted, ms) {
            // If we have a formatted string from API (HH:MM:SS), strip seconds
            if (formatted && formatted.length >= 5) {
                const parts = formatted.split(':');
                if (parts.length === 3) {
                    return parts[0] + ':' + parts[1];
                }
                return formatted;
            }
            // Otherwise format from milliseconds
            return formatDuration(ms);
        }

        function formatEHH(ehhMinutes, ehhFormatted) {
            // If we have a pre-formatted string, use it (strip seconds if HH:MM:SS)
            if (ehhFormatted && ehhFormatted.length >= 5) {
                const parts = ehhFormatted.split(':');
                if (parts.length === 3) {
                    return parts[0] + ':' + parts[1];
                }
                return ehhFormatted;
            }
            // Otherwise format from minutes
            if (ehhMinutes === null || ehhMinutes === undefined || ehhMinutes === 0) {
                return '-';
            }
            return formatMinutesToHHMM(ehhMinutes);
        }

        function formatMinutesToHHMM(minutes) {
            if (!minutes) return '00:00';
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            return hours.toString().padStart(2, '0') + ':' + mins.toString().padStart(2, '0');
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        window.addEventListener('message', event => {
            console.log('Jubilee Tasks Webview: Message received:', event.data);
            const message = event.data;

            switch (message.command) {
                case 'updateTasks':
                    console.log('Jubilee Tasks Webview: Rendering tasks');
                    renderTasks(message.tasks, message.currentTaskId);
                    break;
                case 'updateInitials':
                    console.log('Jubilee Tasks Webview: Updating initials:', message.initials);
                    const initialsDisplay = document.getElementById('initials-display');
                    if (initialsDisplay) {
                        initialsDisplay.textContent = message.initials ? '(' + message.initials + ')' : '';
                    }
                    break;
                case 'setInitialsValidated':
                    console.log('Jubilee Tasks Webview: Initials validated:', message.validated, 'initials:', message.initials);
                    if (message.validated) {
                        hideInitialsOverlay();
                        // Update header with initials
                        if (message.initials) {
                            const initialsDisplay = document.getElementById('initials-display');
                            if (initialsDisplay) {
                                initialsDisplay.textContent = '(' + message.initials + ')';
                            }
                        }
                    }
                    break;
                case 'initialsError':
                    console.log('Jubilee Tasks Webview: Initials error:', message.error);
                    showInitialsError(message.error);
                    break;
                case 'error':
                    console.log('Jubilee Tasks Webview: Showing error:', message.error);
                    document.getElementById('content').innerHTML =
                        '<div class="empty-state" style="color: var(--vscode-errorForeground);">Error: ' +
                        escapeHtml(message.error) + '</div>';
                    break;
            }
        });

        // Signal that the webview is ready
        console.log('Jubilee Tasks Webview: Initialization complete');
    </script>
</body>
</html>`;
    }

    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
