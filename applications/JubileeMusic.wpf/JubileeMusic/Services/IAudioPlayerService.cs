namespace JubileeMusic.Services;

public interface IAudioPlayerService : IDisposable
{
    bool IsPlaying { get; }
    bool IsPaused { get; }
    TimeSpan CurrentPosition { get; }
    TimeSpan TotalDuration { get; }
    float Volume { get; set; }
    string? CurrentTrackId { get; }

    Task LoadAsync(string filePath, string trackId);
    void Play();
    void Pause();
    void Stop();
    void Seek(TimeSpan position);

    event EventHandler<PlaybackStateChangedEventArgs>? PlaybackStateChanged;
    event EventHandler<TimeSpan>? PositionChanged;
    event EventHandler? PlaybackEnded;
    event EventHandler<string>? ErrorOccurred;
}

public class PlaybackStateChangedEventArgs : EventArgs
{
    public PlaybackState OldState { get; set; }
    public PlaybackState NewState { get; set; }
    public string? TrackId { get; set; }
}

public enum PlaybackState
{
    Stopped,
    Loading,
    Playing,
    Paused
}
