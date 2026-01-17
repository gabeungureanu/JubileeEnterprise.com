using System;
using System.Windows.Media.Imaging;

namespace JubileeAvatar.Models
{
    public class TranscriptionEventArgs : EventArgs
    {
        public string Text { get; set; } = string.Empty;
        public double Confidence { get; set; }
        public double Duration { get; set; }
    }

    public class AIResponseEventArgs : EventArgs
    {
        public string Response { get; set; } = string.Empty;
        public int TokensUsed { get; set; }
        public double ProcessingTime { get; set; }
    }

    public class TTSAudioEventArgs : EventArgs
    {
        public byte[] AudioData { get; set; } = Array.Empty<byte>();
        public double Duration { get; set; }
        public string Format { get; set; } = "mp3";
    }

    public class AvatarFrameEventArgs : EventArgs
    {
        public BitmapSource? Frame { get; set; }
        public int FrameNumber { get; set; }
        public bool IsSpeaking { get; set; }
    }

    public class PipelineStatusEventArgs : EventArgs
    {
        public PipelineStage Stage { get; set; }
        public string Message { get; set; } = string.Empty;
        public bool IsError { get; set; }
    }

    public class LatencyUpdateEventArgs : EventArgs
    {
        public double STTLatency { get; set; }
        public double AILatency { get; set; }
        public double TTSLatency { get; set; }
        public double AvatarLatency { get; set; }
        public double TotalLatency => STTLatency + AILatency + TTSLatency + AvatarLatency;
    }

    public enum PipelineStage
    {
        Idle,
        Listening,
        Transcribing,
        GeneratingResponse,
        GeneratingSpeech,
        RenderingAvatar,
        Complete,
        Error
    }
}
