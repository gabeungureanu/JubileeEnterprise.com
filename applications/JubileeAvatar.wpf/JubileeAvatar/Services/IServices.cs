using System;
using System.Threading.Tasks;
using JubileeAvatar.Models;

namespace JubileeAvatar.Services
{
    public interface ISettingsService
    {
        AppSettings Settings { get; }
        JubileePersona Persona { get; }
        Task LoadAsync();
        Task SaveAsync();
        void UpdateApiKey(string provider, string key);
    }

    public interface IAudioService
    {
        event EventHandler<byte[]>? OnAudioCaptured;
        void StartCapture();
        void StopCapture();
        void PlayAudio(byte[] audioData);
        void StopPlayback();
        double GetInputLevel();
        double GetOutputLevel();
        void SetMicrophoneEnabled(bool enabled);
        void SetSpeakerEnabled(bool enabled);
        void SetInputDevice(string deviceName);
        void SetOutputDevice(string deviceName);
        string[] GetInputDevices();
        string[] GetOutputDevices();
    }

    public interface ISpeechToTextService
    {
        event EventHandler<TranscriptionEventArgs>? OnTranscriptionComplete;
        Task<string> TranscribeAsync(byte[] audioData);
        void SetLanguage(string languageCode);
    }

    public interface IAIResponseService
    {
        event EventHandler<AIResponseEventArgs>? OnResponseGenerated;
        Task<string> GenerateResponseAsync(string userMessage, string? conversationContext = null);
        void SetPersona(JubileePersona persona);
        void ClearConversationHistory();
    }

    public interface ITextToSpeechService
    {
        event EventHandler<TTSAudioEventArgs>? OnAudioGenerated;
        Task<byte[]> GenerateSpeechAsync(string text);
        void SetVoice(string voiceId);
        void SetVoiceSettings(double stability, double similarity);
        Task<string[]> GetAvailableVoicesAsync();
    }

    public interface IAvatarService
    {
        event EventHandler<AvatarFrameEventArgs>? OnFrameReady;
        Task StartStreamAsync(string avatarId);
        Task StopStreamAsync();
        Task SpeakAsync(string text, byte[] audioData);
        void SetAvatarProvider(string provider);
        Task<string[]> GetAvailableAvatarsAsync();
    }

    public interface IBackendService
    {
        event EventHandler<TranscriptionEventArgs>? OnTranscriptionReceived;
        event EventHandler<AIResponseEventArgs>? OnAIResponseReceived;
        event EventHandler<TTSAudioEventArgs>? OnTTSAudioReady;
        event EventHandler<AvatarFrameEventArgs>? OnAvatarFrameReady;
        event EventHandler<PipelineStatusEventArgs>? OnPipelineStatusChanged;
        event EventHandler<LatencyUpdateEventArgs>? OnLatencyUpdate;
        event EventHandler<string>? OnDebugLog;

        bool IsConnected { get; }
        Task<bool> StartSessionAsync();
        Task StopSessionAsync();
        Task SendAudioAsync(byte[] audioData);
        Task<bool> CheckHealthAsync();
    }

    public interface IConversationLogger
    {
        void Log(ConversationEntry entry);
        Task ExportAsync(string filePath);
        void Clear();
    }
}
