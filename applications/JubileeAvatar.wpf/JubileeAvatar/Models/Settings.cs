namespace JubileeAvatar.Models
{
    public class AppSettings
    {
        public string Environment { get; set; } = "development";
        public ApiSettings Api { get; set; } = new();
        public AudioSettings Audio { get; set; } = new();
        public AvatarSettings Avatar { get; set; } = new();
        public BackendSettings Backend { get; set; } = new();
    }

    public class ApiSettings
    {
        public string OpenAIApiKey { get; set; } = string.Empty;
        public string ElevenLabsApiKey { get; set; } = string.Empty;
        public string DIDApiKey { get; set; } = string.Empty;
        public string HeyGenApiKey { get; set; } = string.Empty;
    }

    public class AudioSettings
    {
        public string InputDevice { get; set; } = "default";
        public string OutputDevice { get; set; } = "default";
        public string VoiceMeeterInput { get; set; } = "VoiceMeeter Input (VB-Audio VoiceMeeter VAIO)";
        public int SampleRate { get; set; } = 16000;
        public int Channels { get; set; } = 1;
        public double SilenceThreshold { get; set; } = 0.02;
        public int SilenceDurationMs { get; set; } = 1500;
    }

    public class AvatarSettings
    {
        public string Provider { get; set; } = "d-id"; // "d-id" or "heygen"
        public string AvatarId { get; set; } = string.Empty;
        public string VoiceId { get; set; } = "21m00Tcm4TlvDq8ikWAM"; // ElevenLabs Rachel
        public int Width { get; set; } = 512;
        public int Height { get; set; } = 512;
        public double VoiceStability { get; set; } = 0.5;
        public double VoiceSimilarity { get; set; } = 0.75;
    }

    public class BackendSettings
    {
        public string Url { get; set; } = "http://localhost:3950";
        public int TimeoutSeconds { get; set; } = 30;
        public int MaxRetries { get; set; } = 3;
        public bool UseWebSocket { get; set; } = true;
    }

    public class JubileePersona
    {
        public string Name { get; set; } = "Jubilee";
        public string SystemPrompt { get; set; } = @"You are Jubilee, a friendly, warm, and knowledgeable AI assistant for Jubilee Enterprise.
You speak with clarity, enthusiasm, and a professional yet approachable tone.
You are helpful, patient, and always aim to provide accurate and useful information.
Keep your responses concise and conversational, suitable for spoken dialogue.
Avoid using special characters, markdown, or formatting that wouldn't translate well to speech.";
        public string Greeting { get; set; } = "Hello! I'm Jubilee, your AI assistant. How can I help you today?";
        public int MaxResponseTokens { get; set; } = 150;
        public double Temperature { get; set; } = 0.7;
    }
}
