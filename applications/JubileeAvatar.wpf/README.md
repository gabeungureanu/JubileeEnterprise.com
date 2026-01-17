# Jubilee Avatar - AI Live Avatar System

A real-time AI avatar system that enables Jubilee to appear in Zoom, respond intelligently to spoken questions, and deliver real-time answers through a virtual face and voice.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         JUBILEE AVATAR SYSTEM                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌─────────────────────────────────────────┐   │
│  │   WPF UI     │    │           Node.js Backend               │   │
│  │  Control     │───▶│                                         │   │
│  │   Panel      │    │  ┌─────────┐ ┌─────────┐ ┌─────────┐  │   │
│  └──────────────┘    │  │ Whisper │ │  GPT-4  │ │ElevenLabs│  │   │
│         │            │  │  (STT)  │▶│  (AI)   │▶│  (TTS)  │  │   │
│         ▼            │  └─────────┘ └─────────┘ └─────────┘  │   │
│  ┌──────────────┐    │                    │                     │   │
│  │    Audio     │    │                    ▼                     │   │
│  │   Capture    │───▶│              ┌─────────┐                │   │
│  │  (NAudio)    │    │              │  D-ID   │                │   │
│  └──────────────┘    │              │ Avatar  │                │   │
│                      └──────────────┴─────────┴────────────────┘   │
│                                           │                          │
│                                           ▼                          │
│         ┌─────────────────────────────────────────────────┐         │
│         │              OUTPUT ROUTING                      │         │
│         │                                                  │         │
│         │  Audio ──▶ VoiceMeeter ──▶ Zoom Mic Input       │         │
│         │  Video ──▶ OBS Virtual Cam ──▶ Zoom Video       │         │
│         │                                                  │         │
│         └─────────────────────────────────────────────────┘         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

### Required Software
- Windows 10/11
- .NET 8.0 SDK
- Node.js 18+ and npm
- VoiceMeeter Banana (or Potato)
- OBS Studio with Virtual Camera plugin
- Visual Studio 2022 (for WPF development)

### Required API Keys
- **OpenAI API Key** - For Whisper STT and GPT-4
- **ElevenLabs API Key** - For text-to-speech
- **D-ID API Key** - For avatar animation (optional)

## Project Structure

```
JubileeAvatar.wpf/
├── JubileeAvatar/              # WPF Frontend Application
│   ├── Config/                 # Configuration files
│   │   ├── settings.json
│   │   └── settings.development.json
│   ├── Models/                 # Data models
│   ├── Services/               # Service interfaces and implementations
│   ├── ViewModels/             # MVVM ViewModels
│   └── Views/                  # XAML Views
│
├── JubileeAvatar.Backend/      # Node.js Backend Service
│   ├── services/               # API integrations
│   │   ├── whisper-service.js  # OpenAI Whisper STT
│   │   ├── gpt-service.js      # GPT-4 responses
│   │   ├── elevenlabs-service.js # ElevenLabs TTS
│   │   └── did-service.js      # D-ID Avatar
│   ├── utils/                  # Utilities
│   ├── server.js               # Main server
│   └── .env.example            # Environment template
│
└── JubileeAvatar.sln           # Visual Studio solution
```

## Setup Instructions

### 1. Backend Setup

```bash
cd JubileeAvatar.Backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your API keys
# Then start the server
npm start
```

### 2. WPF Application Setup

```bash
cd JubileeAvatar

# Build the project
dotnet build

# Or open JubileeAvatar.sln in Visual Studio
```

### 3. VoiceMeeter Configuration

1. Install VoiceMeeter Banana from https://vb-audio.com/Voicemeeter/banana.htm
2. Configure Hardware Input 1 to your physical microphone
3. Configure Virtual Input (VAIO) for AI voice output
4. Set VoiceMeeter Output (B1) as Zoom's microphone source

### 4. OBS Virtual Camera Setup

1. Install OBS Studio from https://obsproject.com/
2. Create a new Scene for Jubilee Avatar
3. Add a Browser source pointing to the D-ID stream (or Window Capture for local avatar)
4. Start Virtual Camera (Tools → Start Virtual Camera)
5. Set OBS Virtual Camera as Zoom's video source

### 5. Zoom Configuration

1. Open Zoom Settings → Audio
   - Microphone: VoiceMeeter Output (VB-Audio VoiceMeeter VAIO)
   - Speaker: Your preferred output device

2. Open Zoom Settings → Video
   - Camera: OBS Virtual Camera

## Usage

1. Start VoiceMeeter Banana
2. Start OBS Studio and enable Virtual Camera
3. Start the backend server: `npm start` in JubileeAvatar.Backend
4. Launch the WPF application
5. Click "Start Session" to begin
6. Speak into your microphone
7. Watch Jubilee respond in real-time!

## Pipeline Latency

The system is optimized for low latency:
- **STT (Whisper)**: ~500-1000ms
- **AI (GPT-4)**: ~500-1500ms
- **TTS (ElevenLabs)**: ~500-1000ms
- **Avatar (D-ID)**: ~1000-2000ms (optional)

**Target Total Latency**: Under 3 seconds per exchange

## Configuration

### settings.json

```json
{
  "environment": "production",
  "api": {
    "openAIApiKey": "sk-...",
    "elevenLabsApiKey": "...",
    "dIDApiKey": "..."
  },
  "backend": {
    "url": "http://localhost:3950",
    "useWebSocket": true
  },
  "avatar": {
    "provider": "d-id",
    "voiceId": "21m00Tcm4TlvDq8ikWAM"
  }
}
```

### Environment Variables

API keys can also be set via environment variables:
- `JUBILEE_OPENAI_API_KEY`
- `JUBILEE_ELEVENLABS_API_KEY`
- `JUBILEE_DID_API_KEY`

## Troubleshooting

### No Audio Input
- Check that your microphone is selected in Windows Sound settings
- Ensure the Microphone toggle is enabled in the app
- Verify VoiceMeeter is routing audio correctly

### Backend Connection Failed
- Ensure the backend is running on port 3950
- Check firewall settings
- Verify the backend URL in settings

### Avatar Not Rendering
- D-ID API key must be valid
- Check internet connection
- Avatar rendering is optional - the system works without it

### High Latency
- Use wired internet connection
- Close unnecessary applications
- Consider reducing GPT-4 max tokens

## API Reference

### WebSocket Events

**Client → Server:**
- `audio` (binary): Raw audio data
- `config`: Update runtime configuration
- `clear_history`: Clear conversation history

**Server → Client:**
- `transcription`: Speech-to-text result
- `ai_response`: GPT-4 response
- `tts_ready`: Audio synthesis complete
- `avatar_ready`: Avatar video URL
- `pipeline_status`: Current processing stage
- `latency`: Timing metrics

## License

Proprietary - Jubilee Enterprise

## Support

For issues or questions, contact the Jubilee development team.
