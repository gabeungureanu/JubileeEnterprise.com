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

    constructor(
        private readonly extensionUri: vscode.Uri
    ) {}

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
            border-bottom: 1px solid var(--vscode-widget-border);
        }

        .task-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
        }

        .task-table th {
            text-align: left;
            padding: 4px 6px;
            background: var(--vscode-editor-background);
            color: var(--vscode-descriptionForeground);
            font-weight: 500;
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
        }

        .duration {
            font-family: var(--vscode-editor-font-family);
            white-space: nowrap;
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
    </style>
</head>
<body>
    <div class="header">
        <h2>Task Tracker</h2>
        <button class="refresh-btn" onclick="refresh()">Refresh</button>
    </div>
    <div id="content">
        <div class="loading">Loading tasks...</div>
    </div>

    <script nonce="${nonce}">
        console.log('Jubilee Tasks Webview: Script loaded');
        const vscode = acquireVsCodeApi();
        console.log('Jubilee Tasks Webview: vscode API acquired');

        function refresh() {
            console.log('Jubilee Tasks Webview: Refresh clicked');
            vscode.postMessage({ command: 'refresh' });
        }

        function completeTask(taskId) {
            vscode.postMessage({ command: 'completeTask', taskId: taskId });
        }

        function formatTime(isoString) {
            const date = new Date(isoString);
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
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

                html += '<div class="date-group">';
                html += '<div class="date-header">' + date + '</div>';
                html += '<table class="task-table">';
                html += '<thead><tr>';
                html += '<th>Task ID</th>';
                html += '<th>Dev</th>';
                html += '<th>Task Name</th>';
                html += '<th>Start</th>';
                html += '<th>End</th>';
                html += '<th>Duration</th>';
                html += '<th>Status</th>';
                html += '</tr></thead>';
                html += '<tbody>';

                for (const task of tasks) {
                    const isCurrent = task.id === currentTaskId;
                    html += '<tr class="' + (isCurrent ? 'current' : '') + '">';
                    html += '<td class="task-code">' + task.task_code + '</td>';
                    html += '<td class="dev-initials">' + task.developer_initials + '</td>';
                    html += '<td class="task-name" title="' + escapeHtml(task.task_name) + '">' + escapeHtml(task.task_name) + '</td>';
                    html += '<td class="time">' + formatTime(task.start_time) + '</td>';
                    html += '<td class="time">' + (task.end_time ? formatTime(task.end_time) : '-') + '</td>';
                    html += '<td class="duration">' + (task.duration_formatted || formatDuration(task.active_duration_ms)) + '</td>';
                    html += '<td><span class="status ' + task.status + '">' + task.status.replace('_', ' ') + '</span></td>';
                    html += '</tr>';
                }

                html += '</tbody></table>';
                html += '</div>';
            }

            content.innerHTML = html;
        }

        function formatDuration(ms) {
            if (!ms) return '00:00:00';
            const hours = Math.floor(ms / 3600000);
            const minutes = Math.floor((ms % 3600000) / 60000);
            const seconds = Math.floor((ms % 60000) / 1000);
            return hours.toString().padStart(2, '0') + ':' +
                   minutes.toString().padStart(2, '0') + ':' +
                   seconds.toString().padStart(2, '0');
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
