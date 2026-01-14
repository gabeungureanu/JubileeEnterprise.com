using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using NAudio.Wave;

namespace JubileeMusic.Services;

public class AudioPlayerService : IAudioPlayerService
{
    private readonly ILogger<AudioPlayerService> _logger;
    private IWavePlayer? _wavePlayer;
    private AudioFileReader? _audioFileReader;
    private System.Timers.Timer? _positionTimer;
    private PlaybackState _currentState = PlaybackState.Stopped;
    private bool _disposed;

    public bool IsPlaying => _currentState == PlaybackState.Playing;
    public bool IsPaused => _currentState == PlaybackState.Paused;
    public TimeSpan CurrentPosition => _audioFileReader?.CurrentTime ?? TimeSpan.Zero;
    public TimeSpan TotalDuration => _audioFileReader?.TotalTime ?? TimeSpan.Zero;
    public string? CurrentTrackId { get; private set; }

    private float _volume = 1.0f;
    public float Volume
    {
        get => _volume;
        set
        {
            _volume = Math.Clamp(value, 0f, 1f);
            if (_audioFileReader != null)
            {
                _audioFileReader.Volume = _volume;
            }
        }
    }

    public event EventHandler<PlaybackStateChangedEventArgs>? PlaybackStateChanged;
    public event EventHandler<TimeSpan>? PositionChanged;
    public event EventHandler? PlaybackEnded;
    public event EventHandler<string>? ErrorOccurred;

    public AudioPlayerService(ILogger<AudioPlayerService> logger)
    {
        _logger = logger;

        // Timer for position updates
        _positionTimer = new System.Timers.Timer(250);
        _positionTimer.Elapsed += (s, e) =>
        {
            if (_audioFileReader != null && IsPlaying)
            {
                PositionChanged?.Invoke(this, _audioFileReader.CurrentTime);
            }
        };
    }

    public async Task LoadAsync(string filePath, string trackId)
    {
        if (_disposed) throw new ObjectDisposedException(nameof(AudioPlayerService));

        try
        {
            _logger.LogInformation("Loading audio file: {Path}", filePath);

            // Stop and cleanup existing playback
            Stop();
            CleanupPlayback();

            SetState(PlaybackState.Loading, trackId);

            // Validate file exists
            if (!File.Exists(filePath))
            {
                throw new FileNotFoundException("Audio file not found", filePath);
            }

            // Load the audio file
            await Task.Run(() =>
            {
                _audioFileReader = new AudioFileReader(filePath);
                _audioFileReader.Volume = _volume;
                _wavePlayer = new WaveOutEvent();
                _wavePlayer.Init(_audioFileReader);

                _wavePlayer.PlaybackStopped += OnPlaybackStopped;
            });

            CurrentTrackId = trackId;
            SetState(PlaybackState.Stopped, trackId);

            _logger.LogInformation("Audio loaded: Duration = {Duration}", TotalDuration);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load audio file: {Path}", filePath);
            SetState(PlaybackState.Stopped, null);
            ErrorOccurred?.Invoke(this, $"Failed to load audio: {ex.Message}");
            throw;
        }
    }

    public void Play()
    {
        if (_disposed) throw new ObjectDisposedException(nameof(AudioPlayerService));

        if (_wavePlayer == null || _audioFileReader == null)
        {
            _logger.LogWarning("Cannot play - no audio loaded");
            return;
        }

        try
        {
            _logger.LogInformation("Starting playback");
            _wavePlayer.Play();
            _positionTimer?.Start();
            SetState(PlaybackState.Playing, CurrentTrackId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start playback");
            ErrorOccurred?.Invoke(this, $"Playback failed: {ex.Message}");
        }
    }

    public void Pause()
    {
        if (_disposed) throw new ObjectDisposedException(nameof(AudioPlayerService));

        if (_wavePlayer == null || !IsPlaying)
        {
            return;
        }

        try
        {
            _logger.LogInformation("Pausing playback");
            _wavePlayer.Pause();
            _positionTimer?.Stop();
            SetState(PlaybackState.Paused, CurrentTrackId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to pause playback");
            ErrorOccurred?.Invoke(this, $"Pause failed: {ex.Message}");
        }
    }

    public void Stop()
    {
        if (_disposed) return;

        if (_wavePlayer == null)
        {
            return;
        }

        try
        {
            _logger.LogInformation("Stopping playback");
            _wavePlayer.Stop();
            _positionTimer?.Stop();

            if (_audioFileReader != null)
            {
                _audioFileReader.Position = 0;
            }

            SetState(PlaybackState.Stopped, CurrentTrackId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to stop playback");
        }
    }

    public void Seek(TimeSpan position)
    {
        if (_disposed) throw new ObjectDisposedException(nameof(AudioPlayerService));

        if (_audioFileReader == null)
        {
            return;
        }

        try
        {
            var clampedPosition = TimeSpan.FromSeconds(
                Math.Clamp(position.TotalSeconds, 0, TotalDuration.TotalSeconds)
            );

            _audioFileReader.CurrentTime = clampedPosition;
            _logger.LogDebug("Seeked to {Position}", clampedPosition);
            PositionChanged?.Invoke(this, clampedPosition);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to seek to {Position}", position);
        }
    }

    private void OnPlaybackStopped(object? sender, StoppedEventArgs e)
    {
        if (e.Exception != null)
        {
            _logger.LogError(e.Exception, "Playback stopped with error");
            ErrorOccurred?.Invoke(this, $"Playback error: {e.Exception.Message}");
        }

        _positionTimer?.Stop();

        // Check if playback ended naturally (reached end)
        if (_audioFileReader != null &&
            _audioFileReader.CurrentTime >= _audioFileReader.TotalTime - TimeSpan.FromMilliseconds(100))
        {
            _logger.LogInformation("Playback ended naturally");
            _audioFileReader.Position = 0;
            SetState(PlaybackState.Stopped, CurrentTrackId);
            PlaybackEnded?.Invoke(this, EventArgs.Empty);
        }
    }

    private void SetState(PlaybackState newState, string? trackId)
    {
        var oldState = _currentState;
        _currentState = newState;

        PlaybackStateChanged?.Invoke(this, new PlaybackStateChangedEventArgs
        {
            OldState = oldState,
            NewState = newState,
            TrackId = trackId
        });
    }

    private void CleanupPlayback()
    {
        if (_wavePlayer != null)
        {
            _wavePlayer.PlaybackStopped -= OnPlaybackStopped;
            _wavePlayer.Dispose();
            _wavePlayer = null;
        }

        if (_audioFileReader != null)
        {
            _audioFileReader.Dispose();
            _audioFileReader = null;
        }

        CurrentTrackId = null;
    }

    public void Dispose()
    {
        if (_disposed) return;

        _disposed = true;

        Stop();
        CleanupPlayback();

        _positionTimer?.Stop();
        _positionTimer?.Dispose();
        _positionTimer = null;
    }
}
