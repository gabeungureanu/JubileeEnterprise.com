# JubileeChat VS Code Extension

A ChatGPT-powered assistant panel that integrates seamlessly with Claude Code for an enhanced AI workflow.

## Features

- **Persistent Side Panel**: Chat interface docked on the right side of VS Code
- **GPT-4o-mini Model**: Uses the efficient gpt-4o-mini model for fast responses
- **Automatic API Key Fallback**: Primary key failure automatically switches to backup key
- **One-Click Claude Code Transfer**: Send ChatGPT responses directly to Claude Code
- **Conversation History**: Maintains context across messages
- **Clean UI**: Native VS Code theming for seamless integration

## Installation

1. Navigate to the extension directory:
   ```bash
   cd extensions/jubilee-chat
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile the extension:
   ```bash
   npm run compile
   ```

4. Install the extension in VS Code:
   - Press `F5` to launch a development instance, OR
   - Package and install: `npm run package` then install the `.vsix` file

## Configuration

The extension loads API keys from the `.env` file in your workspace root:

```env
OPENAI_API_KEY_PRIMARY=sk-your-primary-key
OPENAI_API_KEY_BACKUP=sk-your-backup-key
```

## Usage

1. Click the JubileeChat icon in the activity bar (right side)
2. Type your message and press Enter or click Send
3. Click "Send to Claude Code" to transfer the response

## Commands

- `JubileeChat: Open Panel` - Opens the chat panel
- `JubileeChat: Send to Claude Code` - Sends last response to Claude Code

## Development

```bash
npm run watch    # Watch mode for development
npm run compile  # One-time compile
npm run package  # Create .vsix package
```
