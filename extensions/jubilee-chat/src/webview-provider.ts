import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ChatGPTService } from './chatgpt-service';
import { SpeechRecognizer } from './speech-recognizer';

interface FileNode {
    name: string;
    path: string;
    isDirectory: boolean;
    children?: FileNode[];
}

interface CategoryData {
    websites: FileNode[];
    applications: FileNode[];
    mobile: FileNode[];
}

// Folders to hide from the tree view
const HIDDEN_FOLDERS = ['archive', 'launcher', '.archive', '.launcher'];

export class JubileeChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'jubileeChat.chatPanel';

    private _view?: vscode.WebviewView;
    private _lastResponse: string = '';
    private _basePath: string;
    private _websitesPath: string;
    private _applicationsPath: string;
    private _mobilePath: string;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _chatService: ChatGPTService,
        private readonly _speechRecognizer: SpeechRecognizer
    ) {
        // Set the base path
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            let basePath = workspaceFolders[0].uri.fsPath;

            // Check if we need to append JubileeEnterprise.com subdirectory
            // This handles the case when workspace is opened at parent folder
            const logixPath = path.join(basePath, 'logix');
            const subfolderLogixPath = path.join(basePath, 'JubileeEnterprise.com', 'logix');

            if (!fs.existsSync(logixPath) && fs.existsSync(subfolderLogixPath)) {
                basePath = path.join(basePath, 'JubileeEnterprise.com');
            }

            this._basePath = basePath;
        } else {
            this._basePath = 'c:/data/JubileeEnterprise.com';
        }

        this._websitesPath = path.join(this._basePath, 'websites');
        this._applicationsPath = path.join(this._basePath, 'applications');
        this._mobilePath = path.join(this._basePath, 'mobile');
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'sendMessage':
                    await this._handleSendMessage(message.text);
                    break;
                case 'sendToClaudeCode':
                    await this._sendToClaudeCode();
                    break;
                case 'clearChat':
                    this._chatService.clearHistory();
                    this._lastResponse = '';
                    this._postMessage({ type: 'chatCleared' });
                    break;
                case 'startVoiceInput':
                    await this._handleVoiceInput();
                    break;
                case 'getFileTree':
                    this._sendAllCategories();
                    break;
                case 'getChildren':
                    this._sendChildren(message.path);
                    break;
                case 'openFile':
                    this._openFile(message.path);
                    break;
                case 'refreshTree':
                    this._sendAllCategories();
                    break;
                case 'devStart':
                    await this._handleDevStart();
                    break;
                case 'devEnd':
                    await this._handleDevEnd();
                    break;
                case 'fixError':
                    await this._handleFixError();
                    break;
                case 'prodStart':
                    await this._handleProdStart();
                    break;
                case 'prodEnd':
                    await this._handleProdEnd();
                    break;
                case 'setModel':
                    this._chatService.setModel(message.model);
                    break;
            }
        });

        // Send initial file tree
        setTimeout(() => this._sendAllCategories(), 100);
    }

    private _sendAllCategories() {
        const categories: CategoryData = {
            websites: this._getDirectoryContents(this._websitesPath),
            applications: this._getDirectoryContents(this._applicationsPath),
            mobile: this._getDirectoryContents(this._mobilePath)
        };
        this._postMessage({ type: 'allCategories', data: categories });
    }

    private _sendChildren(dirPath: string) {
        const children = this._getDirectoryContents(dirPath);
        this._postMessage({ type: 'children', path: dirPath, data: children });
    }

    private _getDirectoryContents(dirPath: string): FileNode[] {
        if (!fs.existsSync(dirPath)) {
            return [];
        }

        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });

            // Filter out hidden folders
            const filteredEntries = entries.filter(entry => {
                if (entry.isDirectory()) {
                    return !HIDDEN_FOLDERS.includes(entry.name.toLowerCase());
                }
                return true;
            });

            // Sort: directories first, then files, both alphabetically
            filteredEntries.sort((a, b) => {
                if (a.isDirectory() && !b.isDirectory()) return -1;
                if (!a.isDirectory() && b.isDirectory()) return 1;
                return a.name.localeCompare(b.name);
            });

            return filteredEntries.map(entry => ({
                name: entry.name,
                path: path.join(dirPath, entry.name),
                isDirectory: entry.isDirectory()
            }));
        } catch (error) {
            console.error('Error reading directory:', error);
            return [];
        }
    }

    private _openFile(filePath: string) {
        const uri = vscode.Uri.file(filePath);
        vscode.window.showTextDocument(uri);
    }

    // Prefix to add before all user messages
    private readonly MESSAGE_PREFIX = 'Rewrite the following with comprehensive technical details as command instructions in paragraph format in the second person active voice.\n\n';

    private _stripMarkdownCharacters(text: string): string {
        // Remove * and # characters from the response
        return text.replace(/[*#]/g, '');
    }

    private async _handleSendMessage(text: string) {
        if (!text.trim()) {
            return;
        }

        // Show user message immediately (without prefix for display)
        this._postMessage({
            type: 'userMessage',
            text: text
        });

        // Show loading indicator
        this._postMessage({ type: 'loading', show: true });

        try {
            // Add prefix to the message before sending to ChatGPT
            const prefixedMessage = this.MESSAGE_PREFIX + text;
            const response = await this._chatService.sendMessage(prefixedMessage);

            // Strip * and # characters from the response
            const cleanedResponse = this._stripMarkdownCharacters(response);
            this._lastResponse = cleanedResponse;

            this._postMessage({
                type: 'assistantMessage',
                text: cleanedResponse
            });
        } catch (error: any) {
            const errorMessage = error?.message || 'An error occurred while communicating with ChatGPT';
            this._postMessage({
                type: 'error',
                text: errorMessage
            });
        } finally {
            this._postMessage({ type: 'loading', show: false });
        }
    }

    private async _handleVoiceInput() {
        this._postMessage({ type: 'listening', show: true });

        try {
            console.log('JubileeChat: Starting voice input...');
            const transcription = await this._speechRecognizer.startListening();
            console.log('JubileeChat: Voice input result:', transcription);

            this._postMessage({
                type: 'voiceResult',
                text: transcription
            });
        } catch (error: any) {
            console.error('JubileeChat: Voice input error:', error);
            const errorMessage = error?.message || 'Voice recognition failed';
            this._postMessage({
                type: 'voiceError',
                text: errorMessage
            });
        } finally {
            this._postMessage({ type: 'listening', show: false });
        }
    }

    private async _sendToClaudeCode() {
        if (!this._lastResponse) {
            return;
        }

        try {
            // Copy content to clipboard
            await vscode.env.clipboard.writeText(this._lastResponse);

            // Try to focus Claude Code and paste
            try {
                // Focus the Claude Code input
                await vscode.commands.executeCommand('claude-vscode.focus');

                // Small delay to ensure focus is set
                await new Promise(resolve => setTimeout(resolve, 150));

                // Try multiple paste approaches
                try {
                    // First try: Standard paste command
                    await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
                } catch {
                    try {
                        // Second try: Type command (works in some webviews)
                        await vscode.commands.executeCommand('type', { text: this._lastResponse });
                    } catch {
                        // Content is in clipboard - user can manually paste
                    }
                }
            } catch {
                // Content remains in clipboard for manual paste
            }
        } catch {
            // Silent fail
        }
    }

    private async _handleDevStart() {
        const sessionStartPath = path.join(this._basePath, 'logix', 'session_start.md');
        await this._insertFileContentAtCursor(sessionStartPath, 'DEV START');
    }

    private async _handleDevEnd() {
        const sessionEndPath = path.join(this._basePath, 'logix', 'session_end.md');
        await this._insertFileContentAtCursor(sessionEndPath, 'DEV END');
    }

    private async _handleFixError() {
        const fixErrorPath = path.join(this._basePath, 'logix', 'fix_errors.md');
        await this._insertFileContentAtCursor(fixErrorPath, 'FIX ERROR');
    }

    private async _handleProdStart() {
        const prodStartPath = path.join(this._basePath, 'logix', 'prod_start.md');
        await this._insertFileContentAtCursor(prodStartPath, 'PROD START');
    }

    private async _handleProdEnd() {
        const prodEndPath = path.join(this._basePath, 'logix', 'prod_end.md');
        await this._insertFileContentAtCursor(prodEndPath, 'PROD END');
    }

    private async _insertFileContentAtCursor(filePath: string, buttonName: string) {
        try {
            if (!fs.existsSync(filePath)) {
                vscode.window.showErrorMessage(`JubileeChat: ${buttonName} file not found at ${filePath}`);
                return;
            }

            const content = fs.readFileSync(filePath, 'utf-8');

            // Copy content to clipboard
            await vscode.env.clipboard.writeText(content);

            // Try to focus Claude Code and paste
            try {
                // Focus the Claude Code input
                await vscode.commands.executeCommand('claude-vscode.focus');

                // Small delay to ensure focus is set
                await new Promise(resolve => setTimeout(resolve, 150));

                // Try multiple paste approaches
                try {
                    // First try: Standard paste command
                    await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
                } catch {
                    try {
                        // Second try: Type command (works in some webviews)
                        await vscode.commands.executeCommand('type', { text: content });
                    } catch {
                        // Content is in clipboard - user can manually paste
                    }
                }
            } catch {
                // If Claude Code focus fails, insert in active editor as fallback
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    await editor.edit(editBuilder => {
                        editBuilder.insert(editor.selection.active, content);
                    });
                }
                // Otherwise content remains in clipboard
            }
        } catch {
            // Silent fail
        }
    }

    public getLastResponse(): string {
        return this._lastResponse;
    }

    private _postMessage(message: any) {
        if (this._view) {
            this._view.webview.postMessage(message);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Get the profile image URI
        const profileImageUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'resources', 'jubilee-profile.png')
        );

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'unsafe-inline'; img-src ${webview.cspSource} https:;">
    <title>JubileeChat</title>
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
            height: 100vh;
            display: flex;
            flex-direction: row;
            overflow: hidden;
        }

        /* Left panel - File Tree */
        .file-tree-panel {
            width: 200px;
            min-width: 100px;
            max-width: 400px;
            display: flex;
            flex-direction: column;
            border-right: 1px solid var(--vscode-sideBarSectionHeader-border);
            background: var(--vscode-sideBar-background);
        }

        .tree-header {
            padding: 8px 12px;
            background: var(--vscode-sideBarSectionHeader-background);
            border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            color: var(--vscode-sideBarSectionHeader-foreground);
        }

        .tree-header-btn {
            background: transparent;
            border: none;
            color: var(--vscode-icon-foreground);
            cursor: pointer;
            padding: 2px 4px;
            border-radius: 3px;
            font-size: 14px;
            line-height: 1;
        }

        .tree-header-btn:hover {
            background: var(--vscode-toolbar-hoverBackground);
        }

        .file-tree {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
        }

        /* Category sections */
        .category-section {
            border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
        }

        .category-header {
            display: flex;
            align-items: center;
            padding: 6px 8px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            color: var(--vscode-sideBarSectionHeader-foreground);
            background: var(--vscode-sideBarSectionHeader-background);
        }

        .category-header:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .category-chevron {
            margin-right: 4px;
            font-size: 10px;
            transition: transform 0.1s;
        }

        .category-chevron.expanded {
            transform: rotate(90deg);
        }

        .category-content {
            display: none;
            padding: 4px 0;
        }

        .category-content.expanded {
            display: block;
        }

        .tree-item {
            display: flex;
            align-items: center;
            padding: 3px 8px;
            cursor: pointer;
            white-space: nowrap;
            font-size: 13px;
        }

        .tree-item:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .tree-item.selected {
            background: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
        }

        .tree-item-icon {
            margin-right: 6px;
            font-size: 11px;
            width: 13px;
            text-align: center;
        }

        .tree-item-chevron {
            margin-right: 4px;
            font-size: 10px;
            width: 12px;
            text-align: center;
            transition: transform 0.1s;
        }

        .tree-item-chevron.expanded {
            transform: rotate(90deg);
        }

        .tree-item-chevron.hidden {
            visibility: hidden;
        }

        .tree-item-name {
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .tree-children {
            display: none;
        }

        .tree-children.expanded {
            display: block;
        }

        /* Resizer */
        .resizer {
            width: 4px;
            cursor: col-resize;
            background: transparent;
            transition: background 0.2s;
        }

        .resizer:hover,
        .resizer.resizing {
            background: var(--vscode-focusBorder);
        }

        /* Right panel - Chat */
        .chat-panel {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 200px;
            overflow: hidden;
        }

        .header {
            padding: 8px 12px;
            background: var(--vscode-sideBarSectionHeader-background);
            border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .header h2 {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            color: var(--vscode-sideBarSectionHeader-foreground);
        }

        .header-buttons {
            display: flex;
            gap: 4px;
        }

        .header-btn {
            background: transparent;
            border: none;
            color: var(--vscode-icon-foreground);
            cursor: pointer;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
        }

        .header-btn:hover {
            background: var(--vscode-toolbar-hoverBackground);
        }

        .chat-container {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .message {
            padding: 10px 12px;
            border-radius: 8px;
            max-width: 95%;
            word-wrap: break-word;
            white-space: pre-wrap;
            line-height: 1.4;
            font-size: 13px;
        }

        .user-message {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            align-self: flex-end;
            border-bottom-right-radius: 4px;
        }

        .assistant-message {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            align-self: flex-start;
            border-bottom-left-radius: 4px;
        }

        .error-message {
            background: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            color: var(--vscode-errorForeground);
            align-self: center;
        }

        .notification {
            background: var(--vscode-notificationsInfoIcon-foreground);
            opacity: 0.9;
            padding: 8px 12px;
            border-radius: 4px;
            align-self: center;
            font-size: 12px;
        }

        .loading {
            display: none;
            align-self: flex-start;
            padding: 10px 12px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 8px;
        }

        .loading.show {
            display: block;
        }

        .loading-dots {
            display: flex;
            gap: 4px;
        }

        .loading-dots span {
            width: 8px;
            height: 8px;
            background: var(--vscode-foreground);
            border-radius: 50%;
            animation: bounce 1.4s infinite ease-in-out both;
        }

        .loading-dots span:nth-child(1) { animation-delay: -0.32s; }
        .loading-dots span:nth-child(2) { animation-delay: -0.16s; }

        @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
        }

        .input-container {
            padding: 8px;
            background: var(--vscode-sideBar-background);
            border-top: 1px solid var(--vscode-sideBarSectionHeader-border);
        }

        .listening-indicator {
            display: none;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            margin-bottom: 8px;
            background: rgba(0, 122, 204, 0.1);
            border: 1px solid rgba(0, 122, 204, 0.3);
            border-radius: 4px;
            font-size: 12px;
            color: #007acc;
        }

        .listening-indicator.show {
            display: flex;
        }

        .listening-dot {
            width: 8px;
            height: 8px;
            background: #007acc;
            border-radius: 50%;
            animation: pulse 1s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.8); }
        }

        .input-wrapper {
            display: flex;
            gap: 6px;
            margin-bottom: 6px;
        }

        #messageInput {
            flex: 1;
            padding: 6px 10px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-family: inherit;
            font-size: 13px;
            resize: none;
            min-height: 32px;
            max-height: 100px;
        }

        #messageInput:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }

        .btn-group {
            display: flex;
            gap: 4px;
        }

        .send-btn, .mic-btn {
            padding: 6px 10px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .send-btn:hover, .mic-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .send-btn:disabled, .mic-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .mic-btn {
            padding: 6px 8px;
        }

        .mic-btn.listening {
            background: #007acc;
            animation: pulse 1.5s infinite;
        }

        .mic-btn svg {
            width: 14px;
            height: 14px;
        }

        .action-buttons {
            display: flex;
            gap: 6px;
        }

        .action-btn {
            padding: 6px 10px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
        }

        .dev-start-btn {
            background: #28a745;
            color: #ffffff;
        }

        .dev-start-btn:hover {
            background: #218838;
        }

        .dev-end-btn {
            background: #28a745;
            color: #ffffff;
        }

        .dev-end-btn:hover {
            background: #218838;
        }

        .inject-btn {
            flex: 1;
            background: #d4a017;
            color: #000000;
        }

        .inject-btn:hover {
            background: #c4940f;
        }

        .inject-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .model-selector {
            display: flex;
            gap: 4px;
            margin-left: 8px;
        }

        .model-option {
            font-size: 8px;
            padding: 2px 5px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid transparent;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.15s ease;
            display: flex;
            align-items: center;
            gap: 3px;
        }

        .model-option:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .model-option.active {
            background: #007acc;
            color: #ffffff;
            border-color: #007acc;
        }

        .usage-count {
            font-size: 7px;
            background: rgba(255,255,255,0.2);
            padding: 1px 3px;
            border-radius: 6px;
            min-width: 12px;
            text-align: center;
        }

        .model-option.active .usage-count {
            background: rgba(255,255,255,0.3);
        }

        .welcome {
            text-align: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
        }

        .welcome h3 {
            margin-bottom: 8px;
            color: var(--vscode-foreground);
            font-size: 14px;
        }

        .welcome p {
            font-size: 12px;
        }

        .welcome-image {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            margin-bottom: 16px;
            object-fit: cover;
        }

        /* Tree footer */
        .tree-footer {
            padding: 8px;
            background: var(--vscode-sideBarSectionHeader-background);
            border-top: 1px solid var(--vscode-sideBarSectionHeader-border);
            display: flex;
            gap: 4px;
        }

        .prod-btn {
            flex: 1;
            padding: 6px 8px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 10px;
            font-weight: 600;
            background: #6c757d;
            color: #ffffff;
        }

        .prod-btn:hover {
            background: #5a6268;
        }

        .fix-error-btn {
            background: #dc3545;
            color: #ffffff;
        }

        .fix-error-btn:hover {
            background: #c82333;
        }
    </style>
</head>
<body>
    <!-- Left Panel: File Tree -->
    <div class="file-tree-panel" id="fileTreePanel">
        <div class="file-tree" id="fileTree">
            <!-- Category sections -->
            <div class="category-section" id="applicationsSection">
                <div class="category-header" data-category="applications">
                    <span class="category-chevron">▶</span>
                    <span>Applications</span>
                </div>
                <div class="category-content" id="applicationsContent"></div>
            </div>
            <div class="category-section" id="mobileSection">
                <div class="category-header" data-category="mobile">
                    <span class="category-chevron">▶</span>
                    <span>Mobile Apps</span>
                </div>
                <div class="category-content" id="mobileContent"></div>
            </div>
            <div class="category-section" id="websitesSection">
                <div class="category-header" data-category="websites">
                    <span class="category-chevron expanded">▶</span>
                    <span>Websites</span>
                </div>
                <div class="category-content expanded" id="websitesContent"></div>
            </div>
        </div>
        <div class="tree-footer">
            <button class="prod-btn" id="prodStartBtn">PROD START</button>
            <button class="prod-btn" id="prodEndBtn">PROD END</button>
        </div>
    </div>

    <!-- Resizer -->
    <div class="resizer" id="resizer"></div>

    <!-- Right Panel: Chat -->
    <div class="chat-panel">
        <div class="header">
            <div style="display: flex; align-items: center;">
                <h2>Chat</h2>
                <div class="model-selector">
                    <span class="model-option" data-model="gpt-4o-mini" data-limit="0">gpt-4o-mini</span>
                    <span class="model-option active" data-model="gpt-4-turbo" data-limit="3">gpt-4-turbo<span class="usage-count">3</span></span>
                    <span class="model-option" data-model="gpt-4o" data-limit="2">gpt-4o<span class="usage-count">2</span></span>
                </div>
            </div>
            <div class="header-buttons">
                <button class="header-btn" id="clearBtn" title="Clear chat">Clear</button>
            </div>
        </div>

        <div class="chat-container" id="chatContainer">
            <div class="welcome">
                <img src="${profileImageUri}" alt="Jubilee" class="welcome-image" />
                <h3>Welcome to JubileeChat</h3>
                <p>Ask me anything! Click the mic for voice input.</p>
            </div>
        </div>

        <div class="loading" id="loading">
            <div class="loading-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>

        <div class="input-container">
            <div class="listening-indicator" id="listeningIndicator">
                <span class="listening-dot"></span>
                <span id="listeningText">Listening...</span>
            </div>
            <div class="input-wrapper">
                <textarea
                    id="messageInput"
                    placeholder="Type or click mic..."
                    rows="1"
                ></textarea>
                <div class="btn-group">
                    <button class="mic-btn" id="micBtn" title="Voice input">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                            <line x1="12" y1="19" x2="12" y2="23"></line>
                            <line x1="8" y1="23" x2="16" y2="23"></line>
                        </svg>
                    </button>
                    <button class="send-btn" id="sendBtn">Send</button>
                </div>
            </div>
            <div class="action-buttons">
                <button class="action-btn dev-start-btn" id="devStartBtn">DEV START</button>
                <button class="action-btn dev-end-btn" id="devEndBtn">DEV END</button>
                <button class="action-btn fix-error-btn" id="fixErrorBtn">FIX ERROR</button>
                <button class="action-btn inject-btn" id="claudeBtn" disabled>INJECT RESPONSE</button>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        // Restore state
        const state = vscode.getState() || {
            treeWidth: 200,
            expandedPaths: [],
            expandedCategories: ['websites'],
            selectedModel: 'gpt-4-turbo',
            modelUsage: {
                'gpt-4o': 2,
                'gpt-4-turbo': 3
            }
        };

        // Ensure modelUsage exists in state
        if (!state.modelUsage) {
            state.modelUsage = {
                'gpt-4o': 2,
                'gpt-4-turbo': 3
            };
        }

        // Elements
        const fileTreePanel = document.getElementById('fileTreePanel');
        const resizer = document.getElementById('resizer');
        const chatContainer = document.getElementById('chatContainer');
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const micBtn = document.getElementById('micBtn');
        const claudeBtn = document.getElementById('claudeBtn');
        const clearBtn = document.getElementById('clearBtn');
        const loadingEl = document.getElementById('loading');
        const listeningIndicator = document.getElementById('listeningIndicator');
        const listeningText = document.getElementById('listeningText');
        const devStartBtn = document.getElementById('devStartBtn');
        const devEndBtn = document.getElementById('devEndBtn');
        const fixErrorBtn = document.getElementById('fixErrorBtn');
        const prodStartBtn = document.getElementById('prodStartBtn');
        const prodEndBtn = document.getElementById('prodEndBtn');
        const modelOptions = document.querySelectorAll('.model-option');

        // Category elements
        const websitesContent = document.getElementById('websitesContent');
        const applicationsContent = document.getElementById('applicationsContent');
        const mobileContent = document.getElementById('mobileContent');

        let hasResponse = false;
        let isListening = false;
        let expandedPaths = new Set(state.expandedPaths || []);
        let expandedCategories = new Set(state.expandedCategories || ['websites']);

        // Set initial tree width
        fileTreePanel.style.width = state.treeWidth + 'px';

        // Model usage limits
        const MODEL_LIMITS = {
            'gpt-4o': 2,
            'gpt-4-turbo': 3,
            'gpt-4o-mini': Infinity
        };

        // Downgrade path
        const DOWNGRADE_MAP = {
            'gpt-4o': 'gpt-4-turbo',
            'gpt-4-turbo': 'gpt-4o-mini',
            'gpt-4o-mini': 'gpt-4o-mini'
        };

        // Update usage count display
        function updateUsageDisplay() {
            modelOptions.forEach(option => {
                const model = option.dataset.model;
                const countEl = option.querySelector('.usage-count');
                if (countEl && state.modelUsage[model] !== undefined) {
                    countEl.textContent = state.modelUsage[model];
                }
            });
        }

        // Select a model and update UI
        function selectModel(model) {
            modelOptions.forEach(opt => opt.classList.remove('active'));
            const targetOption = document.querySelector('[data-model="' + model + '"]');
            if (targetOption) {
                targetOption.classList.add('active');
            }
            state.selectedModel = model;
            vscode.setState(state);
            vscode.postMessage({ type: 'setModel', model: model });
        }

        // Handle automatic downgrade after usage
        function decrementUsageAndDowngrade() {
            const currentModel = state.selectedModel;

            // gpt-4o-mini has no limit
            if (currentModel === 'gpt-4o-mini') {
                return;
            }

            // Decrement usage
            if (state.modelUsage[currentModel] > 0) {
                state.modelUsage[currentModel]--;
                updateUsageDisplay();
                vscode.setState(state);
            }

            // Check if we need to downgrade
            if (state.modelUsage[currentModel] <= 0) {
                const downgradeModel = DOWNGRADE_MAP[currentModel];
                selectModel(downgradeModel);
            }
        }

        // Initialize model selector
        const savedModel = state.selectedModel || 'gpt-4-turbo';
        updateUsageDisplay();
        modelOptions.forEach(option => {
            const model = option.dataset.model;
            if (model === savedModel) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
            option.addEventListener('click', () => {
                const clickedModel = option.dataset.model;

                // When manually selecting gpt-4-turbo, reset its counter to 3
                if (clickedModel === 'gpt-4-turbo') {
                    state.modelUsage['gpt-4-turbo'] = MODEL_LIMITS['gpt-4-turbo'];
                }
                // When manually selecting gpt-4o, reset its counter to 2
                if (clickedModel === 'gpt-4o') {
                    state.modelUsage['gpt-4o'] = MODEL_LIMITS['gpt-4o'];
                }

                updateUsageDisplay();
                selectModel(clickedModel);
            });
        });
        // Set initial model on load
        vscode.postMessage({ type: 'setModel', model: savedModel });

        // Initialize category states
        document.querySelectorAll('.category-header').forEach(header => {
            const category = header.dataset.category;
            const chevron = header.querySelector('.category-chevron');
            const content = header.nextElementSibling;

            if (expandedCategories.has(category)) {
                chevron.classList.add('expanded');
                content.classList.add('expanded');
            } else {
                chevron.classList.remove('expanded');
                content.classList.remove('expanded');
            }

            header.addEventListener('click', () => {
                toggleCategory(category, chevron, content);
            });
        });

        function toggleCategory(category, chevron, content) {
            if (expandedCategories.has(category)) {
                expandedCategories.delete(category);
                chevron.classList.remove('expanded');
                content.classList.remove('expanded');
            } else {
                expandedCategories.add(category);
                chevron.classList.add('expanded');
                content.classList.add('expanded');
            }
            state.expandedCategories = Array.from(expandedCategories);
            vscode.setState(state);
        }

        // Resizer functionality
        let isResizing = false;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            resizer.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const newWidth = e.clientX;
            if (newWidth >= 100 && newWidth <= 400) {
                fileTreePanel.style.width = newWidth + 'px';
                state.treeWidth = newWidth;
                vscode.setState(state);
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                resizer.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });

        // Request file tree on load
        vscode.postMessage({ type: 'getFileTree' });

        // Render file tree for a specific container
        function renderTree(nodes, container, indent = 0) {
            container.innerHTML = '';
            nodes.forEach(node => {
                const itemDiv = document.createElement('div');

                const item = document.createElement('div');
                item.className = 'tree-item';
                item.style.paddingLeft = (8 + indent * 16) + 'px';

                // Chevron for directories
                const chevron = document.createElement('span');
                chevron.className = 'tree-item-chevron' + (node.isDirectory ? '' : ' hidden');
                chevron.textContent = '▶';
                if (expandedPaths.has(node.path)) {
                    chevron.classList.add('expanded');
                }
                item.appendChild(chevron);

                // Icon
                const icon = document.createElement('span');
                icon.className = 'tree-item-icon';
                icon.textContent = node.isDirectory ? '📁' : getFileIcon(node.name);
                item.appendChild(icon);

                // Name
                const name = document.createElement('span');
                name.className = 'tree-item-name';
                name.textContent = node.name;
                name.title = node.path;
                item.appendChild(name);

                itemDiv.appendChild(item);

                // Children container
                const childrenDiv = document.createElement('div');
                childrenDiv.className = 'tree-children' + (expandedPaths.has(node.path) ? ' expanded' : '');
                childrenDiv.dataset.path = node.path;
                itemDiv.appendChild(childrenDiv);

                // Click handler
                item.addEventListener('click', () => {
                    if (node.isDirectory) {
                        toggleDirectory(node.path, chevron, childrenDiv);
                    } else {
                        vscode.postMessage({ type: 'openFile', path: node.path });
                    }
                });

                container.appendChild(itemDiv);

                // If expanded and has cached children, render them
                if (expandedPaths.has(node.path) && node.children) {
                    renderTree(node.children, childrenDiv, indent + 1);
                }
            });
        }

        function toggleDirectory(path, chevron, childrenDiv) {
            if (expandedPaths.has(path)) {
                expandedPaths.delete(path);
                chevron.classList.remove('expanded');
                childrenDiv.classList.remove('expanded');
            } else {
                expandedPaths.add(path);
                chevron.classList.add('expanded');
                childrenDiv.classList.add('expanded');
                // Request children if not loaded
                if (childrenDiv.children.length === 0) {
                    vscode.postMessage({ type: 'getChildren', path: path });
                }
            }
            state.expandedPaths = Array.from(expandedPaths);
            vscode.setState(state);
        }

        function getFileIcon(filename) {
            const ext = filename.split('.').pop().toLowerCase();
            const icons = {
                'html': '📄',
                'htm': '📄',
                'css': '🎨',
                'scss': '🎨',
                'js': '📜',
                'ts': '📜',
                'json': '{}',
                'md': '📝',
                'png': '🖼️',
                'jpg': '🖼️',
                'jpeg': '🖼️',
                'gif': '🖼️',
                'svg': '🖼️',
                'ico': '🖼️',
                'pdf': '📕',
                'xml': '📄',
                'php': '🐘',
                'cs': '⚙️',
                'csproj': '⚙️',
                'sln': '⚙️',
                'xaml': '📱',
                'swift': '🍎',
                'kt': '🤖',
                'java': '☕',
                'dart': '🎯'
            };
            return icons[ext] || '📄';
        }

        // Chat functionality
        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 100) + 'px';
        });

        messageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        sendBtn.addEventListener('click', sendMessage);
        claudeBtn.addEventListener('click', sendToClaudeCode);
        clearBtn.addEventListener('click', clearChat);
        micBtn.addEventListener('click', startVoiceInput);
        devStartBtn.addEventListener('click', () => vscode.postMessage({ type: 'devStart' }));
        devEndBtn.addEventListener('click', () => vscode.postMessage({ type: 'devEnd' }));
        fixErrorBtn.addEventListener('click', () => vscode.postMessage({ type: 'fixError' }));
        prodStartBtn.addEventListener('click', () => vscode.postMessage({ type: 'prodStart' }));
        prodEndBtn.addEventListener('click', () => vscode.postMessage({ type: 'prodEnd' }));

        function startVoiceInput() {
            if (isListening) return;
            isListening = true;
            micBtn.classList.add('listening');
            micBtn.disabled = true;
            listeningIndicator.classList.add('show');
            listeningText.textContent = 'Listening...';
            vscode.postMessage({ type: 'startVoiceInput' });
        }

        function sendMessage() {
            const text = messageInput.value.trim();
            if (!text) return;
            vscode.postMessage({ type: 'sendMessage', text: text });
            messageInput.value = '';
            messageInput.style.height = 'auto';
        }

        function sendToClaudeCode() {
            vscode.postMessage({ type: 'sendToClaudeCode' });
        }

        function clearChat() {
            vscode.postMessage({ type: 'clearChat' });
        }

        function addMessage(text, type) {
            const welcome = chatContainer.querySelector('.welcome');
            if (welcome) welcome.remove();

            const messageEl = document.createElement('div');
            messageEl.className = 'message ' + type + '-message';
            messageEl.textContent = text;
            chatContainer.appendChild(messageEl);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        function showNotification(text) {
            const notifEl = document.createElement('div');
            notifEl.className = 'notification';
            notifEl.textContent = text;
            chatContainer.appendChild(notifEl);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            setTimeout(() => notifEl.remove(), 3000);
        }

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.type) {
                case 'allCategories':
                    renderTree(message.data.websites, websitesContent);
                    renderTree(message.data.applications, applicationsContent);
                    renderTree(message.data.mobile, mobileContent);
                    break;
                case 'children':
                    const container = document.querySelector('.tree-children[data-path="' + message.path.replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"') + '"]');
                    if (container) {
                        const indent = (parseInt(container.parentElement.querySelector('.tree-item').style.paddingLeft) - 8) / 16 + 1;
                        renderTree(message.data, container, indent);
                    }
                    break;
                case 'userMessage':
                    addMessage(message.text, 'user');
                    break;
                case 'assistantMessage':
                    addMessage(message.text, 'assistant');
                    hasResponse = true;
                    claudeBtn.disabled = false;
                    // Decrement usage and check for downgrade after successful response
                    decrementUsageAndDowngrade();
                    break;
                case 'error':
                    addMessage(message.text, 'error');
                    break;
                case 'loading':
                    loadingEl.classList.toggle('show', message.show);
                    sendBtn.disabled = message.show;
                    break;
                case 'chatCleared':
                    chatContainer.innerHTML = '<div class="welcome"><img src="${profileImageUri}" alt="Jubilee" class="welcome-image" /><h3>Welcome to JubileeChat</h3><p>Ask me anything!</p></div>';
                    hasResponse = false;
                    claudeBtn.disabled = true;
                    break;
                case 'notification':
                    showNotification(message.text);
                    break;
                case 'listening':
                    if (message.show) {
                        isListening = true;
                        micBtn.classList.add('listening');
                        micBtn.disabled = true;
                        listeningIndicator.classList.add('show');
                    } else {
                        isListening = false;
                        micBtn.classList.remove('listening');
                        micBtn.disabled = false;
                        listeningIndicator.classList.remove('show');
                    }
                    break;
                case 'voiceResult':
                    messageInput.value = message.text;
                    messageInput.style.height = 'auto';
                    messageInput.style.height = Math.min(messageInput.scrollHeight, 100) + 'px';
                    messageInput.focus();
                    isListening = false;
                    micBtn.classList.remove('listening');
                    micBtn.disabled = false;
                    listeningIndicator.classList.remove('show');
                    break;
                case 'voiceError':
                    showNotification('Voice: ' + message.text);
                    isListening = false;
                    micBtn.classList.remove('listening');
                    micBtn.disabled = false;
                    listeningIndicator.classList.remove('show');
                    break;
            }
        });
    </script>
</body>
</html>`;
    }
}