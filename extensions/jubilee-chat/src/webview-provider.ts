import * as vscode from 'vscode';
import { ChatGPTService } from './chatgpt-service';

export class JubileeChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'jubileeChat.chatPanel';

    private _view?: vscode.WebviewView;
    private _lastResponse: string = '';

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _chatService: ChatGPTService
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
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
            }
        });
    }

    private async _handleSendMessage(text: string) {
        if (!text.trim()) {
            return;
        }

        // Show user message immediately
        this._postMessage({
            type: 'userMessage',
            text: text
        });

        // Show loading indicator
        this._postMessage({ type: 'loading', show: true });

        try {
            const response = await this._chatService.sendMessage(text);
            this._lastResponse = response;

            this._postMessage({
                type: 'assistantMessage',
                text: response
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

    private async _sendToClaudeCode() {
        if (!this._lastResponse) {
            vscode.window.showInformationMessage('No response available to send to Claude Code');
            return;
        }

        try {
            // Copy to clipboard
            await vscode.env.clipboard.writeText(this._lastResponse);

            // Try to open Claude Code chat and paste
            const terminals = vscode.window.terminals;
            let claudeTerminal = terminals.find(t =>
                t.name.toLowerCase().includes('claude') ||
                t.name.toLowerCase().includes('anthropic')
            );

            if (claudeTerminal) {
                claudeTerminal.show();
                claudeTerminal.sendText(this._lastResponse, false);
                this._postMessage({
                    type: 'notification',
                    text: 'Response sent to Claude Code terminal!'
                });
                return;
            }

            // Try VS Code chat API
            try {
                await vscode.commands.executeCommand('workbench.action.chat.open');
                await new Promise(resolve => setTimeout(resolve, 300));
                await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
                this._postMessage({
                    type: 'notification',
                    text: 'Response sent to Claude Code chat!'
                });
            } catch {
                this._postMessage({
                    type: 'notification',
                    text: 'Response copied to clipboard. Paste it into Claude Code.'
                });
            }
        } catch (error) {
            this._postMessage({
                type: 'error',
                text: 'Failed to send response to Claude Code'
            });
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
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'unsafe-inline';">
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
            flex-direction: column;
        }

        .header {
            padding: 12px;
            background: var(--vscode-sideBarSectionHeader-background);
            border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .header h2 {
            font-size: 13px;
            font-weight: 600;
            color: var(--vscode-sideBarTitle-foreground);
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
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
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
            padding: 12px;
            background: var(--vscode-sideBar-background);
            border-top: 1px solid var(--vscode-sideBarSectionHeader-border);
        }

        .input-wrapper {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
        }

        #messageInput {
            flex: 1;
            padding: 8px 12px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-family: inherit;
            font-size: inherit;
            resize: none;
            min-height: 36px;
            max-height: 120px;
        }

        #messageInput:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }

        .send-btn {
            padding: 8px 16px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
        }

        .send-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .send-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .action-buttons {
            display: flex;
            gap: 8px;
        }

        .claude-btn {
            flex: 1;
            padding: 8px 12px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }

        .claude-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .claude-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .claude-btn svg {
            width: 14px;
            height: 14px;
        }

        .model-badge {
            font-size: 10px;
            padding: 2px 6px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 10px;
        }

        .welcome {
            text-align: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
        }

        .welcome h3 {
            margin-bottom: 8px;
            color: var(--vscode-foreground);
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h2>JubileeChat</h2>
            <span class="model-badge">gpt-4o-mini</span>
        </div>
        <div class="header-buttons">
            <button class="header-btn" id="clearBtn" title="Clear chat">Clear</button>
        </div>
    </div>

    <div class="chat-container" id="chatContainer">
        <div class="welcome">
            <h3>Welcome to JubileeChat</h3>
            <p>Ask me anything! Click "Send to Claude Code" to transfer responses.</p>
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
        <div class="input-wrapper">
            <textarea
                id="messageInput"
                placeholder="Type your message..."
                rows="1"
            ></textarea>
            <button class="send-btn" id="sendBtn">Send</button>
        </div>
        <div class="action-buttons">
            <button class="claude-btn" id="claudeBtn" disabled>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                </svg>
                Send to Claude Code
            </button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const chatContainer = document.getElementById('chatContainer');
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const claudeBtn = document.getElementById('claudeBtn');
        const clearBtn = document.getElementById('clearBtn');
        const loadingEl = document.getElementById('loading');

        let hasResponse = false;

        // Auto-resize textarea
        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });

        // Send message on Enter (Shift+Enter for new line)
        messageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        sendBtn.addEventListener('click', sendMessage);
        claudeBtn.addEventListener('click', sendToClaudeCode);
        clearBtn.addEventListener('click', clearChat);

        function sendMessage() {
            const text = messageInput.value.trim();
            if (!text) return;

            vscode.postMessage({
                type: 'sendMessage',
                text: text
            });

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
            // Remove welcome message if present
            const welcome = chatContainer.querySelector('.welcome');
            if (welcome) {
                welcome.remove();
            }

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

            setTimeout(() => {
                notifEl.remove();
            }, 3000);
        }

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.type) {
                case 'userMessage':
                    addMessage(message.text, 'user');
                    break;
                case 'assistantMessage':
                    addMessage(message.text, 'assistant');
                    hasResponse = true;
                    claudeBtn.disabled = false;
                    break;
                case 'error':
                    addMessage(message.text, 'error');
                    break;
                case 'loading':
                    loadingEl.classList.toggle('show', message.show);
                    sendBtn.disabled = message.show;
                    break;
                case 'chatCleared':
                    chatContainer.innerHTML = '<div class="welcome"><h3>Welcome to JubileeChat</h3><p>Ask me anything! Click "Send to Claude Code" to transfer responses.</p></div>';
                    hasResponse = false;
                    claudeBtn.disabled = true;
                    break;
                case 'notification':
                    showNotification(message.text);
                    break;
            }
        });
    </script>
</body>
</html>`;
    }
}
