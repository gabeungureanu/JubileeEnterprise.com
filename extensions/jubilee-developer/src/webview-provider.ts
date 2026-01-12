import * as vscode from 'vscode';
import { ClaudeService, FileContext } from './claude-service';
import { SpeechRecognizer } from './speech-recognizer';

export class JubileeDeveloperViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'jubileeDeveloper.chatPanel';

    private _view?: vscode.WebviewView;
    private _pendingContext?: FileContext;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _claudeService: ClaudeService,
        private readonly _speechRecognizer: SpeechRecognizer
    ) {}

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
                case 'clearChat':
                    this._claudeService.clearHistory();
                    this._postMessage({ type: 'chatCleared' });
                    break;
                case 'copyCode':
                    await vscode.env.clipboard.writeText(message.code);
                    vscode.window.showInformationMessage('Code copied to clipboard');
                    break;
                case 'insertCode':
                    await this._insertCodeAtCursor(message.code);
                    break;
                case 'addFileContext':
                    await this._addCurrentFileContext();
                    break;
                case 'startVoiceInput':
                    await this._handleVoiceInput();
                    break;
            }
        });
    }

    private async _handleVoiceInput() {
        this._postMessage({ type: 'listening', show: true });

        try {
            console.log('JubileeDeveloper: Starting voice input...');
            const transcription = await this._speechRecognizer.startListening();
            console.log('JubileeDeveloper: Voice input result:', transcription);

            this._postMessage({
                type: 'voiceResult',
                text: transcription
            });
        } catch (error: any) {
            console.error('JubileeDeveloper: Voice input error:', error);
            const errorMessage = error?.message || 'Voice recognition failed';
            this._postMessage({
                type: 'voiceError',
                text: errorMessage
            });
        } finally {
            this._postMessage({ type: 'listening', show: false });
        }
    }

    public sendMessageWithContext(message: string, context: FileContext): void {
        this._pendingContext = context;

        // Show user message immediately
        this._postMessage({
            type: 'userMessage',
            text: message,
            context: {
                fileName: context.fileName,
                hasSelection: !!context.selection
            }
        });

        // Process the message
        this._handleSendMessage(message);
    }

    private async _handleSendMessage(text: string) {
        if (!text.trim()) {
            return;
        }

        // Get file context if enabled and no pending context
        let fileContext = this._pendingContext;
        this._pendingContext = undefined;

        if (!fileContext) {
            const config = vscode.workspace.getConfiguration('jubileeDeveloper');
            if (config.get('includeFileContext')) {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    const selection = editor.document.getText(editor.selection);
                    fileContext = {
                        fileName: editor.document.fileName.split(/[\\/]/).pop() || '',
                        language: editor.document.languageId,
                        content: editor.document.getText(),
                        selection: selection || undefined
                    };
                }
            }
        }

        // Show user message if not already shown (from context menu)
        if (!this._pendingContext) {
            this._postMessage({
                type: 'userMessage',
                text: text,
                context: fileContext ? {
                    fileName: fileContext.fileName,
                    hasSelection: !!fileContext.selection
                } : undefined
            });
        }

        // Show loading indicator
        this._postMessage({ type: 'loading', show: true });

        try {
            // Use streaming for better UX
            let fullResponse = '';

            this._postMessage({ type: 'assistantMessageStart' });

            await this._claudeService.streamMessage(
                text,
                fileContext,
                (chunk) => {
                    fullResponse += chunk;
                    this._postMessage({
                        type: 'assistantMessageChunk',
                        text: chunk
                    });
                }
            );

            this._postMessage({ type: 'assistantMessageEnd' });

        } catch (error: any) {
            const errorMessage = error?.message || 'An error occurred while communicating with Claude';
            this._postMessage({
                type: 'error',
                text: errorMessage
            });
        } finally {
            this._postMessage({ type: 'loading', show: false });
        }
    }

    private async _insertCodeAtCursor(code: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No active editor to insert code');
            return;
        }

        await editor.edit(editBuilder => {
            if (editor.selection.isEmpty) {
                editBuilder.insert(editor.selection.active, code);
            } else {
                editBuilder.replace(editor.selection, code);
            }
        });

        vscode.window.showInformationMessage('Code inserted');
    }

    private async _addCurrentFileContext(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this._postMessage({
                type: 'notification',
                text: 'No active file to add as context'
            });
            return;
        }

        const fileName = editor.document.fileName.split(/[\\/]/).pop() || '';
        const selection = editor.document.getText(editor.selection);

        this._postMessage({
            type: 'contextAdded',
            fileName: fileName,
            hasSelection: !!selection
        });
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
    <title>Jubilee Developer</title>
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
            padding: 10px 12px;
            background: var(--vscode-sideBarSectionHeader-background);
            border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .header-title {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .header h2 {
            font-size: 13px;
            font-weight: 600;
            color: var(--vscode-sideBarTitle-foreground);
        }

        .model-badge {
            font-size: 10px;
            padding: 2px 6px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 10px;
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
            gap: 16px;
        }

        .message {
            max-width: 100%;
            word-wrap: break-word;
        }

        .message-header {
            font-size: 11px;
            font-weight: 600;
            margin-bottom: 6px;
            color: var(--vscode-descriptionForeground);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .message-content {
            padding: 10px 12px;
            border-radius: 8px;
            line-height: 1.5;
        }

        .user-message .message-content {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .assistant-message .message-content {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
        }

        .context-badge {
            font-size: 10px;
            padding: 2px 6px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 8px;
        }

        .error-message {
            background: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            color: var(--vscode-errorForeground);
            padding: 10px 12px;
            border-radius: 8px;
        }

        /* Code block styling */
        pre {
            background: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 6px;
            padding: 12px;
            margin: 8px 0;
            overflow-x: auto;
            position: relative;
        }

        pre code {
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            line-height: 1.4;
        }

        .code-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 12px;
            background: var(--vscode-editorGroupHeader-tabsBackground);
            border-bottom: 1px solid var(--vscode-widget-border);
            border-radius: 6px 6px 0 0;
            margin-bottom: -1px;
        }

        .code-lang {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        .code-actions {
            display: flex;
            gap: 4px;
        }

        .code-btn {
            background: transparent;
            border: none;
            color: var(--vscode-icon-foreground);
            cursor: pointer;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
        }

        .code-btn:hover {
            background: var(--vscode-toolbar-hoverBackground);
        }

        .loading {
            display: none;
            padding: 10px 12px;
        }

        .loading.show {
            display: block;
        }

        .loading-dots {
            display: flex;
            gap: 4px;
            align-items: center;
        }

        .loading-dots span {
            width: 6px;
            height: 6px;
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

        .context-indicator {
            display: none;
            padding: 6px 10px;
            margin-bottom: 8px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 4px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        .context-indicator.show {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .recording-indicator {
            display: none;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            margin-bottom: 8px;
            background: rgba(220, 53, 69, 0.1);
            border: 1px solid rgba(220, 53, 69, 0.3);
            border-radius: 4px;
            font-size: 12px;
            color: #dc3545;
        }

        .recording-indicator.show {
            display: flex;
        }

        .recording-dot {
            width: 8px;
            height: 8px;
            background: #dc3545;
            border-radius: 50%;
            animation: pulse 1s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        .input-wrapper {
            display: flex;
            gap: 8px;
        }

        #messageInput {
            flex: 1;
            padding: 10px 12px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 6px;
            font-family: inherit;
            font-size: inherit;
            resize: none;
            min-height: 40px;
            max-height: 150px;
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
            padding: 10px 12px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
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
            padding: 10px;
        }

        .mic-btn.recording {
            background: #dc3545;
            animation: pulse 1.5s infinite;
        }

        .mic-btn.transcribing {
            background: var(--vscode-button-secondaryBackground);
            opacity: 0.7;
        }

        .mic-btn svg {
            width: 16px;
            height: 16px;
        }

        .welcome {
            text-align: center;
            padding: 30px 20px;
            color: var(--vscode-descriptionForeground);
        }

        .welcome h3 {
            margin-bottom: 12px;
            color: var(--vscode-foreground);
            font-size: 16px;
        }

        .welcome p {
            margin-bottom: 16px;
            line-height: 1.5;
        }

        .welcome-tips {
            text-align: left;
            font-size: 12px;
            background: var(--vscode-editor-background);
            border-radius: 8px;
            padding: 12px 16px;
        }

        .welcome-tips li {
            margin: 6px 0;
            padding-left: 8px;
        }

        .notification {
            padding: 8px 12px;
            background: var(--vscode-notificationsBackground);
            border: 1px solid var(--vscode-notificationsBorder);
            border-radius: 4px;
            font-size: 12px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-title">
            <h2>Jubilee Developer</h2>
            <span class="model-badge" id="modelBadge">claude-sonnet</span>
        </div>
        <div class="header-buttons">
            <button class="header-btn" id="clearBtn" title="Clear chat">Clear</button>
        </div>
    </div>

    <div class="chat-container" id="chatContainer">
        <div class="welcome">
            <h3>Welcome to Jubilee Developer</h3>
            <p>Your Claude-powered AI assistant for VS Code</p>
            <ul class="welcome-tips">
                <li><strong>Ctrl+Shift+J</strong> - Open this panel</li>
                <li><strong>Right-click</strong> selected code for quick actions</li>
                <li><strong>Ctrl+Shift+I</strong> - Insert last code response</li>
                <li>File context is automatically included</li>
            </ul>
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
        <div class="recording-indicator" id="recordingIndicator">
            <span class="recording-dot"></span>
            <span id="recordingText">Recording...</span>
        </div>
        <div class="context-indicator" id="contextIndicator">
            <span id="contextText"></span>
            <button class="header-btn" id="clearContextBtn">×</button>
        </div>
        <div class="input-wrapper">
            <textarea
                id="messageInput"
                placeholder="Ask me anything about code..."
                rows="1"
            ></textarea>
            <div class="btn-group">
                <button class="mic-btn" id="micBtn" title="Voice input (click to record)">
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
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const chatContainer = document.getElementById('chatContainer');
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const micBtn = document.getElementById('micBtn');
        const clearBtn = document.getElementById('clearBtn');
        const loadingEl = document.getElementById('loading');
        const contextIndicator = document.getElementById('contextIndicator');
        const contextText = document.getElementById('contextText');
        const clearContextBtn = document.getElementById('clearContextBtn');
        const recordingIndicator = document.getElementById('recordingIndicator');
        const recordingText = document.getElementById('recordingText');

        let currentAssistantMessage = null;
        let currentContext = null;
        let isRecording = false;

        // Auto-resize textarea
        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 150) + 'px';
        });

        // Send message on Enter (Shift+Enter for new line)
        messageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        sendBtn.addEventListener('click', sendMessage);
        micBtn.addEventListener('click', startVoiceInput);
        clearBtn.addEventListener('click', clearChat);
        clearContextBtn.addEventListener('click', () => {
            currentContext = null;
            contextIndicator.classList.remove('show');
        });

        function startVoiceInput() {
            if (isRecording) return;

            isRecording = true;
            micBtn.classList.add('recording');
            micBtn.disabled = true;
            recordingIndicator.classList.add('show');
            recordingText.textContent = 'Listening... Speak now';

            vscode.postMessage({ type: 'startVoiceInput' });
        }

        function sendMessage() {
            const text = messageInput.value.trim();
            if (!text) return;

            vscode.postMessage({
                type: 'sendMessage',
                text: text
            });

            // Clear input and context
            messageInput.value = '';
            messageInput.style.height = 'auto';
            currentContext = null;
            contextIndicator.classList.remove('show');
        }

        function clearChat() {
            vscode.postMessage({ type: 'clearChat' });
        }

        function addUserMessage(text, context) {
            removeWelcome();

            const messageEl = document.createElement('div');
            messageEl.className = 'message user-message';

            let headerHtml = '<span>You</span>';
            if (context && context.fileName) {
                headerHtml += ' <span class="context-badge">' + escapeHtml(context.fileName) + '</span>';
            }

            messageEl.innerHTML =
                '<div class="message-header">' + headerHtml + '</div>' +
                '<div class="message-content">' + escapeHtml(text) + '</div>';

            chatContainer.appendChild(messageEl);
            scrollToBottom();
        }

        function startAssistantMessage() {
            removeWelcome();

            const messageEl = document.createElement('div');
            messageEl.className = 'message assistant-message';
            messageEl.innerHTML =
                '<div class="message-header"><span>Jubilee</span></div>' +
                '<div class="message-content" id="streamingContent"></div>';

            chatContainer.appendChild(messageEl);
            currentAssistantMessage = document.getElementById('streamingContent');
            scrollToBottom();
        }

        function appendToAssistantMessage(chunk) {
            if (currentAssistantMessage) {
                currentAssistantMessage.innerHTML = formatMarkdown(
                    currentAssistantMessage.textContent + chunk
                );
                scrollToBottom();
            }
        }

        function endAssistantMessage() {
            if (currentAssistantMessage) {
                // Final markdown formatting
                const rawText = currentAssistantMessage.textContent;
                currentAssistantMessage.innerHTML = formatMarkdown(rawText);
                currentAssistantMessage.id = '';
                currentAssistantMessage = null;
            }
            scrollToBottom();
        }

        function formatMarkdown(text) {
            // Escape HTML first
            let html = escapeHtml(text);

            // Code blocks with language
            html = html.replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g, function(match, lang, code) {
                const langLabel = lang || 'code';
                return '<div class="code-header"><span class="code-lang">' + langLabel + '</span>' +
                    '<div class="code-actions">' +
                    '<button class="code-btn" onclick="copyCode(this)">Copy</button>' +
                    '<button class="code-btn" onclick="insertCode(this)">Insert</button>' +
                    '</div></div>' +
                    '<pre><code data-code="' + encodeURIComponent(code.trim()) + '">' + code.trim() + '</code></pre>';
            });

            // Inline code
            html = html.replace(/\`([^\`]+)\`/g, '<code>$1</code>');

            // Bold
            html = html.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');

            // Line breaks
            html = html.replace(/\\n/g, '<br>');

            return html;
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function removeWelcome() {
            const welcome = chatContainer.querySelector('.welcome');
            if (welcome) {
                welcome.remove();
            }
        }

        function scrollToBottom() {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        function showNotification(text) {
            const notifEl = document.createElement('div');
            notifEl.className = 'notification';
            notifEl.textContent = text;
            chatContainer.appendChild(notifEl);
            scrollToBottom();

            setTimeout(() => {
                notifEl.remove();
            }, 3000);
        }

        // Global functions for code buttons
        window.copyCode = function(btn) {
            const codeEl = btn.closest('.message').querySelector('code[data-code]');
            if (codeEl) {
                const code = decodeURIComponent(codeEl.getAttribute('data-code'));
                vscode.postMessage({ type: 'copyCode', code: code });
            }
        };

        window.insertCode = function(btn) {
            const codeEl = btn.closest('.message').querySelector('code[data-code]');
            if (codeEl) {
                const code = decodeURIComponent(codeEl.getAttribute('data-code'));
                vscode.postMessage({ type: 'insertCode', code: code });
            }
        };

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.type) {
                case 'userMessage':
                    addUserMessage(message.text, message.context);
                    break;
                case 'assistantMessageStart':
                    startAssistantMessage();
                    break;
                case 'assistantMessageChunk':
                    appendToAssistantMessage(message.text);
                    break;
                case 'assistantMessageEnd':
                    endAssistantMessage();
                    break;
                case 'error':
                    const errorEl = document.createElement('div');
                    errorEl.className = 'error-message';
                    errorEl.textContent = message.text;
                    chatContainer.appendChild(errorEl);
                    scrollToBottom();
                    break;
                case 'loading':
                    loadingEl.classList.toggle('show', message.show);
                    sendBtn.disabled = message.show;
                    break;
                case 'chatCleared':
                    chatContainer.innerHTML = '<div class="welcome"><h3>Welcome to Jubilee Developer</h3><p>Your Claude-powered AI assistant for VS Code</p><ul class="welcome-tips"><li><strong>Ctrl+Shift+J</strong> - Open this panel</li><li><strong>Right-click</strong> selected code for quick actions</li><li><strong>Ctrl+Shift+I</strong> - Insert last code response</li><li>File context is automatically included</li></ul></div>';
                    break;
                case 'contextAdded':
                    currentContext = message;
                    contextText.textContent = message.fileName + (message.hasSelection ? ' (selection)' : '');
                    contextIndicator.classList.add('show');
                    break;
                case 'notification':
                    showNotification(message.text);
                    break;
                case 'listening':
                    if (message.show) {
                        isRecording = true;
                        micBtn.classList.add('recording');
                        micBtn.disabled = true;
                        recordingIndicator.classList.add('show');
                    } else {
                        isRecording = false;
                        micBtn.classList.remove('recording');
                        micBtn.disabled = false;
                        recordingIndicator.classList.remove('show');
                    }
                    break;
                case 'voiceResult':
                    messageInput.value = message.text;
                    messageInput.style.height = 'auto';
                    messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
                    messageInput.focus();
                    isRecording = false;
                    micBtn.classList.remove('recording');
                    micBtn.disabled = false;
                    recordingIndicator.classList.remove('show');
                    break;
                case 'voiceError':
                    showNotification('Voice input: ' + message.text);
                    isRecording = false;
                    micBtn.classList.remove('recording');
                    micBtn.disabled = false;
                    recordingIndicator.classList.remove('show');
                    break;
            }
        });
    </script>
</body>
</html>`;
    }
}
