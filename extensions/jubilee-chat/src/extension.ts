import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ChatGPTService } from './chatgpt-service';
import { JubileeChatViewProvider } from './webview-provider';

let chatService: ChatGPTService;
let viewProvider: JubileeChatViewProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('JubileeChat extension is now active');

    // Load environment variables from workspace .env file
    const envPath = findEnvFile();
    if (envPath) {
        loadEnvFile(envPath);
    }

    // Initialize ChatGPT service with API keys from environment
    const primaryKey = process.env.OPENAI_API_KEY_PRIMARY || '';
    const backupKey = process.env.OPENAI_API_KEY_BACKUP || '';

    if (!primaryKey && !backupKey) {
        vscode.window.showWarningMessage('JubileeChat: No OpenAI API keys found in .env file');
    }

    chatService = new ChatGPTService(primaryKey, backupKey);

    // Create webview provider for the sidebar panel
    viewProvider = new JubileeChatViewProvider(context.extensionUri, chatService);

    // Register the webview provider
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'jubileeChat.chatPanel',
            viewProvider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        )
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('jubileeChat.openPanel', () => {
            vscode.commands.executeCommand('workbench.view.extension.jubilee-chat-container');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('jubileeChat.sendToClaudeCode', async () => {
            const lastResponse = viewProvider.getLastResponse();
            if (lastResponse) {
                await sendToClaudeCode(lastResponse);
            } else {
                vscode.window.showInformationMessage('No ChatGPT response available to send');
            }
        })
    );

    // Show welcome message
    vscode.window.showInformationMessage('JubileeChat is ready! Open the panel from the activity bar.');
}

function findEnvFile(): string | null {
    // Look for .env in workspace root first
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
        for (const folder of workspaceFolders) {
            const envPath = path.join(folder.uri.fsPath, '.env');
            if (fs.existsSync(envPath)) {
                return envPath;
            }
        }
    }

    // Fallback to known location
    const fallbackPath = 'c:/data/JubileeEnterprise.com/.env';
    if (fs.existsSync(fallbackPath)) {
        return fallbackPath;
    }

    return null;
}

function loadEnvFile(envPath: string): void {
    try {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const lines = envContent.split('\n');

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith('#')) {
                const equalIndex = trimmedLine.indexOf('=');
                if (equalIndex > 0) {
                    const key = trimmedLine.substring(0, equalIndex).trim();
                    const value = trimmedLine.substring(equalIndex + 1).trim();
                    process.env[key] = value;
                }
            }
        }
        console.log('JubileeChat: Environment variables loaded from', envPath);
    } catch (error) {
        console.error('JubileeChat: Failed to load .env file:', error);
    }
}

async function sendToClaudeCode(text: string): Promise<void> {
    try {
        // Method 1: Try to find and use Claude Code terminal
        const terminals = vscode.window.terminals;
        let claudeTerminal = terminals.find(t =>
            t.name.toLowerCase().includes('claude') ||
            t.name.toLowerCase().includes('anthropic')
        );

        if (claudeTerminal) {
            claudeTerminal.show();
            claudeTerminal.sendText(text, false);
            vscode.window.showInformationMessage('Response sent to Claude Code terminal');
            return;
        }

        // Method 2: Copy to clipboard and notify user
        await vscode.env.clipboard.writeText(text);

        // Method 3: Try to use VS Code's chat API if available
        try {
            await vscode.commands.executeCommand('workbench.action.chat.open');
            // Small delay to ensure chat is open
            await new Promise(resolve => setTimeout(resolve, 500));

            // Try to paste into the chat input
            await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
            vscode.window.showInformationMessage('Response copied and pasted to Claude Code chat');
        } catch {
            vscode.window.showInformationMessage('Response copied to clipboard. Paste it into Claude Code.');
        }
    } catch (error) {
        console.error('Failed to send to Claude Code:', error);
        vscode.window.showErrorMessage('Failed to send response to Claude Code');
    }
}

export function deactivate() {
    console.log('JubileeChat extension is now deactivated');
}
