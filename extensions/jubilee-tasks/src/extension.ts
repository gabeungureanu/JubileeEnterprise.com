/**
 * Jubilee Tasks - VS Code Extension
 * Automated developer task tracking for Jubilee Enterprise
 *
 * This extension monitors Claude Code terminal interactions to automatically
 * create and track developer tasks with time tracking.
 */

import * as vscode from 'vscode';
import { InitialsManager } from './initials-manager';
import { ProjectDetector } from './project-detector';
import { getTaskService, resetTaskService } from './task-service';
import { getTaskGenerator } from './task-generator';
import { ActivityMonitor } from './activity-monitor';
import { TasksWebviewProvider } from './webview-provider';
import { DeveloperTask } from './types';

// Global state
let initialsManager: InitialsManager;
let projectDetector: ProjectDetector;
let activityMonitor: ActivityMonitor;
let webviewProvider: TasksWebviewProvider;
let currentTask: DeveloperTask | null = null;
let sessionId: string;
let isMonitoring = false;

export async function activate(context: vscode.ExtensionContext) {
    console.log('Jubilee Tasks extension activating...');

    // Initialize managers
    initialsManager = new InitialsManager(context);
    projectDetector = new ProjectDetector();
    activityMonitor = new ActivityMonitor();
    sessionId = projectDetector.generateSessionId();

    // Check for existing initials or prompt
    const initials = await initialsManager.getInitials();
    if (!initials) {
        vscode.window.showWarningMessage(
            'Jubilee Tasks: Developer initials not set. Task tracking is disabled.'
        );
    }

    // Register webview provider
    webviewProvider = new TasksWebviewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            TasksWebviewProvider.viewType,
            webviewProvider
        )
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('jubileeTasks.showPanel', () => {
            vscode.commands.executeCommand('workbench.view.extension.jubilee-tasks');
        }),

        vscode.commands.registerCommand('jubileeTasks.refreshTasks', () => {
            webviewProvider.refreshTasks();
        }),

        vscode.commands.registerCommand('jubileeTasks.setInitials', async () => {
            await initialsManager.resetAndPrompt();
        }),

        vscode.commands.registerCommand('jubileeTasks.completeCurrentTask', async () => {
            await completeCurrentTask();
        })
    );

    // Start activity monitoring
    activityMonitor.start();
    context.subscriptions.push({
        dispose: () => activityMonitor.stop()
    });

    // Start terminal monitoring for Claude Code
    startClaudeCodeMonitoring(context);

    // Check for existing active task for this session
    await checkExistingTask();

    // Ensure project exists in database
    await ensureProjectExists();

    console.log('Jubilee Tasks extension activated');
    vscode.window.showInformationMessage('Jubilee Tasks: Extension activated');
}

export function deactivate() {
    console.log('Jubilee Tasks extension deactivating...');

    // Complete any active task
    if (currentTask) {
        completeCurrentTask();
    }

    activityMonitor.stop();
    isMonitoring = false;
}

/**
 * Start monitoring Claude Code terminal for user messages
 */
function startClaudeCodeMonitoring(context: vscode.ExtensionContext) {
    // Monitor terminal creation
    context.subscriptions.push(
        vscode.window.onDidOpenTerminal((terminal) => {
            if (isClaudeCodeTerminal(terminal)) {
                console.log('Claude Code terminal detected:', terminal.name);
                monitorTerminal(terminal);
            }
        })
    );

    // Check existing terminals
    for (const terminal of vscode.window.terminals) {
        if (isClaudeCodeTerminal(terminal)) {
            console.log('Existing Claude Code terminal found:', terminal.name);
            monitorTerminal(terminal);
        }
    }

    // Monitor active terminal changes
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTerminal((terminal) => {
            if (terminal && isClaudeCodeTerminal(terminal)) {
                activityMonitor.onActivity();
            }
        })
    );

    isMonitoring = true;
}

/**
 * Check if a terminal is Claude Code
 */
function isClaudeCodeTerminal(terminal: vscode.Terminal): boolean {
    const name = terminal.name.toLowerCase();
    return name.includes('claude') ||
           name.includes('code') ||
           name === 'task' ||
           name === 'terminal';
}

/**
 * Monitor a Claude Code terminal for user input
 */
function monitorTerminal(terminal: vscode.Terminal) {
    // VS Code doesn't provide direct terminal input/output access
    // We'll use a workaround by monitoring terminal write events via shell integration
    // For now, we trigger task creation on terminal focus and typing activity

    // The best approach is to hook into Claude Code's hooks system or
    // monitor file changes and terminal activity patterns

    // Alternative: Use VS Code's proposed terminal data API (if available)
    // or integrate with Claude Code's hook system

    console.log(`Monitoring terminal: ${terminal.name}`);
}

/**
 * Create a new task from user prompt
 */
async function createTask(userPrompt: string): Promise<void> {
    const initials = await initialsManager.getInitials();
    if (!initials) {
        console.log('Cannot create task: no initials set');
        return;
    }

    // Complete any existing task first
    if (currentTask) {
        await completeCurrentTask();
    }

    const taskService = getTaskService();
    const taskGenerator = getTaskGenerator();
    const projectInfo = projectDetector.detectProject();

    // Generate task title
    const taskName = await taskGenerator.generateTaskTitle(userPrompt);

    // Create task via API
    const response = await taskService.createTask({
        project_name: projectInfo.name,
        developer_initials: initials,
        task_name: taskName,
        original_prompt: userPrompt,
        session_id: sessionId,
        machine_name: projectDetector.getMachineName(),
        workspace_path: projectDetector.getWorkspacePath() || undefined
    });

    if (response.success && response.data) {
        currentTask = response.data;
        activityMonitor.startTask();

        vscode.window.showInformationMessage(
            `Task ${currentTask.task_code} started: ${taskName}`
        );

        webviewProvider.setCurrentTask(currentTask.id);
        webviewProvider.refreshTasks();

        console.log(`Task created: ${currentTask.task_code}`);
    } else {
        console.error('Failed to create task:', response.error);
        vscode.window.showErrorMessage(
            `Failed to create task: ${response.error}`
        );
    }
}

/**
 * Complete the current task
 */
async function completeCurrentTask(): Promise<void> {
    if (!currentTask) {
        console.log('No current task to complete');
        return;
    }

    const taskService = getTaskService();
    const activeDuration = activityMonitor.getActiveDuration();

    const response = await taskService.completeTask(currentTask.id, {
        active_duration_ms: activeDuration
    });

    if (response.success && response.data) {
        const formattedDuration = ActivityMonitor.formatDuration(activeDuration);
        vscode.window.showInformationMessage(
            `Task ${currentTask.task_code} completed (${formattedDuration})`
        );

        console.log(`Task completed: ${currentTask.task_code}, duration: ${formattedDuration}`);
    } else {
        console.error('Failed to complete task:', response.error);
    }

    currentTask = null;
    activityMonitor.reset();
    webviewProvider.setCurrentTask(undefined);
    webviewProvider.refreshTasks();
}

/**
 * Check for existing active task from this session
 */
async function checkExistingTask(): Promise<void> {
    const taskService = getTaskService();
    const response = await taskService.getActiveTaskForSession(sessionId);

    if (response.success && response.data) {
        currentTask = response.data;
        activityMonitor.startTask();
        webviewProvider.setCurrentTask(currentTask.id);

        console.log(`Resumed existing task: ${currentTask.task_code}`);
    }
}

/**
 * Ensure the current project exists in the database
 */
async function ensureProjectExists(): Promise<void> {
    const taskService = getTaskService();
    const projectInfo = projectDetector.detectProject();

    if (projectInfo.name === 'unknown') {
        return;
    }

    const response = await taskService.createProject({
        project_name: projectInfo.name,
        project_category: projectInfo.category,
        project_type: projectInfo.type,
        folder_path: projectDetector.getWorkspacePath() || undefined
    });

    if (response.success) {
        console.log(`Project ensured: ${projectInfo.name}`);
    }
}

/**
 * Hook for Claude Code integration
 * This function can be called from Claude Code hooks to create tasks
 */
export async function onClaudeCodeMessage(userPrompt: string): Promise<void> {
    await createTask(userPrompt);
}

/**
 * Hook for task completion
 * This function can be called from Claude Code hooks when a task completes
 */
export async function onClaudeCodeComplete(): Promise<void> {
    await completeCurrentTask();
}
