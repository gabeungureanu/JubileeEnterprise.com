import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ClaudeService } from './claude-service';
import { JubileeDeveloperViewProvider } from './webview-provider';

let claudeService: ClaudeService;
let viewProvider: JubileeDeveloperViewProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('Jubilee Developer extension is now active');

    // Load environment variables from workspace .env file
    const envPath = findEnvFile();
    if (envPath) {
        loadEnvFile(envPath);
    }

    // Initialize Claude service with API key from environment
    const apiKey = process.env.ANTHROPIC_API_KEY || '';

    if (!apiKey) {
        vscode.window.showWarningMessage('Jubilee Developer: No Anthropic API key found. Please add ANTHROPIC_API_KEY to your .env file.');
    }

    claudeService = new ClaudeService(apiKey);

    // Apply configuration
    const config = vscode.workspace.getConfiguration('jubileeDeveloper');
    claudeService.setModel(config.get('model') || 'claude-sonnet-4-20250514');
    claudeService.setMaxTokens(config.get('maxTokens') || 4096);

    // Create webview provider for the sidebar panel
    viewProvider = new JubileeDeveloperViewProvider(context.extensionUri, claudeService);

    // Register the webview provider
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'jubileeDeveloper.chatPanel',
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
        vscode.commands.registerCommand('jubileeDeveloper.openPanel', () => {
            vscode.commands.executeCommand('workbench.view.extension.jubilee-developer-container');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('jubileeDeveloper.askAboutSelection', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showInformationMessage('No active editor');
                return;
            }

            const selection = editor.document.getText(editor.selection);
            if (!selection) {
                vscode.window.showInformationMessage('No text selected');
                return;
            }

            const question = await vscode.window.showInputBox({
                prompt: 'What would you like to know about this code?',
                placeHolder: 'Enter your question...'
            });

            if (question) {
                viewProvider.sendMessageWithContext(question, {
                    fileName: path.basename(editor.document.fileName),
                    language: editor.document.languageId,
                    content: editor.document.getText(),
                    selection: selection
                });

                // Open the panel
                vscode.commands.executeCommand('workbench.view.extension.jubilee-developer-container');
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('jubileeDeveloper.explainCode', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showInformationMessage('No active editor');
                return;
            }

            const selection = editor.document.getText(editor.selection);
            if (!selection) {
                vscode.window.showInformationMessage('No text selected');
                return;
            }

            viewProvider.sendMessageWithContext('Explain this code in detail. What does it do, and how does it work?', {
                fileName: path.basename(editor.document.fileName),
                language: editor.document.languageId,
                content: editor.document.getText(),
                selection: selection
            });

            vscode.commands.executeCommand('workbench.view.extension.jubilee-developer-container');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('jubileeDeveloper.fixCode', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showInformationMessage('No active editor');
                return;
            }

            const selection = editor.document.getText(editor.selection);
            if (!selection) {
                vscode.window.showInformationMessage('No text selected');
                return;
            }

            viewProvider.sendMessageWithContext('Review this code for bugs, issues, or improvements. Suggest fixes with corrected code.', {
                fileName: path.basename(editor.document.fileName),
                language: editor.document.languageId,
                content: editor.document.getText(),
                selection: selection
            });

            vscode.commands.executeCommand('workbench.view.extension.jubilee-developer-container');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('jubileeDeveloper.insertResponse', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showInformationMessage('No active editor');
                return;
            }

            const lastResponse = claudeService.getLastResponse();
            if (!lastResponse) {
                vscode.window.showInformationMessage('No response available to insert');
                return;
            }

            // Extract code blocks from the response
            const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g;
            const codeBlocks: string[] = [];
            let match;

            while ((match = codeBlockRegex.exec(lastResponse)) !== null) {
                codeBlocks.push(match[1].trim());
            }

            if (codeBlocks.length === 0) {
                // No code blocks, insert the whole response
                await editor.edit(editBuilder => {
                    editBuilder.insert(editor.selection.active, lastResponse);
                });
            } else if (codeBlocks.length === 1) {
                // Single code block, insert it
                await editor.edit(editBuilder => {
                    editBuilder.insert(editor.selection.active, codeBlocks[0]);
                });
            } else {
                // Multiple code blocks, let user choose
                const items = codeBlocks.map((code, index) => ({
                    label: `Code block ${index + 1}`,
                    description: code.substring(0, 50) + '...',
                    code: code
                }));

                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: 'Select code block to insert'
                });

                if (selected) {
                    await editor.edit(editBuilder => {
                        editBuilder.insert(editor.selection.active, selected.code);
                    });
                }
            }
        })
    );

    // Listen for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('jubileeDeveloper')) {
                const config = vscode.workspace.getConfiguration('jubileeDeveloper');
                claudeService.setModel(config.get('model') || 'claude-sonnet-4-20250514');
                claudeService.setMaxTokens(config.get('maxTokens') || 4096);
            }
        })
    );

    // Show welcome message
    vscode.window.showInformationMessage('Jubilee Developer is ready! Press Ctrl+Shift+J to open.');
}

function findEnvFile(): string | null {
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
        console.log('Jubilee Developer: Environment variables loaded from', envPath);
    } catch (error) {
        console.error('Jubilee Developer: Failed to load .env file:', error);
    }
}

export function deactivate() {
    console.log('Jubilee Developer extension is now deactivated');
}
