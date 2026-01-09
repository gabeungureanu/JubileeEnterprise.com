using JubileeVibes.Core.Enums;
using JubileeVibes.Core.Events;
using JubileeVibes.Core.Models;

namespace JubileeVibes.Core.Interfaces;

public interface IAudioPlaybackService
{
    // Current state
    PlayState CurrentState { get; }
    Track? CurrentTrack { get; }
    TimeSpan Position { get; }
    TimeSpan Duration { get; }
    double Volume { get; set; }
    bool IsMuted { get; set; }
    RepeatMode RepeatMode { get; set; }
    bool IsShuffleEnabled { get; set; }

    // Events
    event EventHandler<TrackChangedEventArgs>? TrackChanged;
    event EventHandler<PlaybackPositionChangedEventArgs>? PositionChanged;
    event EventHandler<PlayState>? StateChanged;
    event EventHandler<double>? VolumeChanged;

    // Playback control
    Task PlayAsync(Track track);
    Task PlayAsync(IEnumerable<Track> tracks, int startIndex = 0);
    Task PauseAsync();
    Task ResumeAsync();
    Task StopAsync();
    Task SeekAsync(TimeSpan position);
    Task NextAsync();
    Task PreviousAsync();
    Task TogglePlayPauseAsync();

    // Audio device management
    IEnumerable<AudioDevice> GetAvailableDevices();
    AudioDevice? CurrentDevice { get; }
    Task SetDeviceAsync(AudioDevice device);
}

public class AudioDevice
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsDefault { get; set; }
}
