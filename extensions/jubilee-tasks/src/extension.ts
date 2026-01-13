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
import { getEHHEstimator } from './ehh-estimator';
import { ActivityMonitor } from './activity-monitor';
import { TasksWebviewProvider } from './webview-provider';
import { DeveloperTask } from './types';

// 4 hours in milliseconds for auto-completion threshold
const AUTO_COMPLETE_THRESHOLD_MS = 4 * 60 * 60 * 1000;
// Check interval for auto-completion (every 5 minutes)
const AUTO_COMPLETE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

// Global state
let initialsManager: InitialsManager;
let projectDetector: ProjectDetector;
let activityMonitor: ActivityMonitor;
let webviewProvider: TasksWebviewProvider;
let currentTask: DeveloperTask | null = null;
let sessionId: string;
let isMonitoring = false;
let autoCompleteTimer: NodeJS.Timeout | null = null;

// Output channel for debugging
let outputChannel: vscode.OutputChannel;

export function log(message: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    if (outputChannel) {
        outputChannel.appendLine(logMessage);
    }
}

export async function activate(context: vscode.ExtensionContext) {
    try {
        // Create output channel first
        outputChannel = vscode.window.createOutputChannel('Jubilee Tasks');
        outputChannel.show(true);
        log('Jubilee Tasks extension activating...');

        // Show activation message to confirm extension is starting
        vscode.window.showInformationMessage('Jubilee Tasks: Extension activating...');

        // Initialize managers
        initialsManager = new InitialsManager(context);
        projectDetector = new ProjectDetector();
        activityMonitor = new ActivityMonitor();
        sessionId = projectDetector.generateSessionId();

        log('Managers initialized, registering webview provider...');

        // Register webview provider FIRST (before any async calls)
        webviewProvider = new TasksWebviewProvider(context.extensionUri);
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(
                TasksWebviewProvider.viewType,
                webviewProvider
            )
        );

        log('Webview provider registered, registering commands...');

        // Set up inline initials submission handler
        webviewProvider.setOnInitialsSubmitted(async (initials: string) => {
            await initialsManager.setInitials(initials);
            webviewProvider.setDeveloperInitials(initials);
            webviewProvider.setInitialsValidated(true);
            webviewProvider.refreshTasks();
            log(`Developer initials set via inline UI: ${initials}`);
        });

        // Register commands
        context.subscriptions.push(
            vscode.commands.registerCommand('jubileeTasks.showPanel', () => {
                vscode.commands.executeCommand('workbench.view.extension.jubilee-tasks');
            }),

            vscode.commands.registerCommand('jubileeTasks.refreshTasks', () => {
                webviewProvider.refreshTasks();
            }),

            vscode.commands.registerCommand('jubileeTasks.setInitials', async () => {
                // Clear cached initials and show inline UI
                await initialsManager.clearInitials();
                webviewProvider.setDeveloperInitials(undefined);
                webviewProvider.setInitialsValidated(false);
            }),

            vscode.commands.registerCommand('jubileeTasks.completeCurrentTask', async () => {
                await completeCurrentTask();
            })
        );

        log('Commands registered, starting activity monitoring...');

        // Start activity monitoring
        activityMonitor.start();
        context.subscriptions.push({
            dispose: () => activityMonitor.stop()
        });

        // Start auto-completion checker (4-hour inactivity threshold)
        startAutoCompleteChecker();
        context.subscriptions.push({
            dispose: () => {
                if (autoCompleteTimer) {
                    clearInterval(autoCompleteTimer);
                    autoCompleteTimer = null;
                }
            }
        });

        // Start terminal monitoring for Claude Code
        startClaudeCodeMonitoring(context);

        log('Jubilee Tasks extension activated successfully!');
        vscode.window.showInformationMessage('Jubilee Tasks: Extension activated!');

        // Do async initialization in background (don't block activation)
        initializeAsync().catch(err => {
            log('Async init error: ' + (err instanceof Error ? err.message : String(err)));
        });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('Jubilee Tasks activation error:', errMsg);
        vscode.window.showErrorMessage(`Jubilee Tasks failed to activate: ${errMsg}`);
        throw error;
    }
}

async function initializeAsync(): Promise<void> {
    // Check for existing initials silently (no pop-up prompt)
    const hasInitials = initialsManager.hasValidInitials();
    let initials: string | null = null;

    if (hasInitials) {
        // Get existing initials without prompting
        initials = await initialsManager.getInitialsSilent();
        log(`Developer initials found: ${initials}`);
    } else {
        log('Developer initials not set - inline UI will prompt user');
    }

    // Update the webview with initials status
    if (initials) {
        webviewProvider.setDeveloperInitials(initials);
        webviewProvider.setInitialsValidated(true);
    } else {
        // Show inline initials input (not validated yet)
        webviewProvider.setInitialsValidated(false);
    }

    // Only proceed with task checking if initials are set
    if (initials) {
        // Check for existing active task for this session
        try {
            await checkExistingTask();
        } catch (err) {
            console.error('Failed to check existing task:', err);
        }

        // Ensure project exists in database
        try {
            await ensureProjectExists();
        } catch (err) {
            console.error('Failed to ensure project exists:', err);
        }
    }
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
 * Start monitoring Claude Code via hook messages file
 */
function startClaudeCodeMonitoring(context: vscode.ExtensionContext) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        log('No workspace folder found, cannot monitor hook messages');
        return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const hookMessagesPath = vscode.Uri.file(`${workspaceRoot}/.claude/hook-messages.json`);

    log(`Setting up file watcher for: ${hookMessagesPath.fsPath}`);

    // Create file watcher for hook messages
    const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(workspaceFolders[0], '.claude/hook-messages.json')
    );

    // Track last processed message to avoid duplicates
    let lastProcessedTimestamp = 0;

    const processHookMessage = async () => {
        try {
            const fs = await import('fs');
            const content = fs.readFileSync(hookMessagesPath.fsPath, 'utf8');
            const message = JSON.parse(content);

            // Skip if we've already processed this message
            if (message.timestamp <= lastProcessedTimestamp) {
                return;
            }
            lastProcessedTimestamp = message.timestamp;

            log(`Received hook message: ${message.event}`);

            if (message.event === 'UserPromptSubmit') {
                // User submitted a new prompt - create a task
                log(`User prompt submitted: ${message.prompt?.substring(0, 100)}...`);
                activityMonitor.onActivity();

                // Create task if we have a prompt and no current task
                if (message.prompt && !currentTask) {
                    await createTask(message.prompt);
                } else if (message.prompt && currentTask) {
                    // Update activity on existing task
                    activityMonitor.onActivity();
                }
            } else if (message.event === 'Stop') {
                // Claude finished responding - could complete task or just update activity
                log('Claude response completed');
                activityMonitor.onActivity();
            }
        } catch (err) {
            // File might not exist yet or be in the process of being written
            if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
                log(`Error processing hook message: ${err}`);
            }
        }
    };

    // Watch for changes to the hook messages file
    watcher.onDidChange(processHookMessage);
    watcher.onDidCreate(processHookMessage);

    context.subscriptions.push(watcher);

    // Also monitor terminal activity as a backup
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTerminal((terminal) => {
            if (terminal) {
                activityMonitor.onActivity();
            }
        })
    );

    isMonitoring = true;
    log('Claude Code hook monitoring started');
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
 * Complete the current task with EHH estimation
 */
async function completeCurrentTask(isAutoComplete: boolean = false): Promise<void> {
    if (!currentTask) {
        console.log('No current task to complete');
        return;
    }

    const taskService = getTaskService();
    const ehhEstimator = getEHHEstimator();
    const activeDuration = activityMonitor.getActiveDuration();

    // Estimate EHH before completing
    log(`Estimating EHH for task ${currentTask.task_code}...`);

    // Update task with duration for EHH estimation
    const taskForEHH = { ...currentTask, active_duration_ms: activeDuration };
    const ehhMinutes = await ehhEstimator.estimateEHH(taskForEHH);

    const response = await taskService.completeTask(currentTask.id, {
        active_duration_ms: activeDuration,
        ehh_minutes: ehhMinutes || undefined
    });

    if (response.success && response.data) {
        const formattedDuration = ActivityMonitor.formatDuration(activeDuration);
        const formattedEHH = ehhMinutes ? `${Math.floor(ehhMinutes / 60)}h ${ehhMinutes % 60}m` : 'N/A';

        const message = isAutoComplete
            ? `Task ${currentTask.task_code} auto-completed due to inactivity (${formattedDuration}, EHH: ${formattedEHH})`
            : `Task ${currentTask.task_code} completed (${formattedDuration}, EHH: ${formattedEHH})`;

        vscode.window.showInformationMessage(message);
        log(`Task completed: ${currentTask.task_code}, duration: ${formattedDuration}, EHH: ${formattedEHH}`);
    } else {
        console.error('Failed to complete task:', response.error);
    }

    currentTask = null;
    activityMonitor.reset();
    webviewProvider.setCurrentTask(undefined);
    webviewProvider.refreshTasks();
}

/**
 * Start the auto-completion checker
 * Checks every 5 minutes if a task has been inactive for 4 hours
 */
function startAutoCompleteChecker(): void {
    autoCompleteTimer = setInterval(async () => {
        if (!currentTask) return;

        const stats = activityMonitor.getStats();
        const now = new Date();
        const timeSinceLastActivity = now.getTime() - stats.lastActivity.getTime();

        // Check if inactive for more than 4 hours
        if (timeSinceLastActivity >= AUTO_COMPLETE_THRESHOLD_MS) {
            log(`Auto-completing task ${currentTask.task_code} due to 4+ hours of inactivity`);
            await completeCurrentTask(true);
        }
    }, AUTO_COMPLETE_CHECK_INTERVAL_MS);
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
