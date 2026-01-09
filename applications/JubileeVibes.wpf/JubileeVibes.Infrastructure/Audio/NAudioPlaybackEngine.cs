using System.IO;
using NAudio.Wave;
using NAudio.Wave.SampleProviders;
using JubileeVibes.Core.Enums;
using JubileeVibes.Core.Events;
using JubileeVibes.Core.Interfaces;
using JubileeVibes.Core.Models;

namespace JubileeVibes.Infrastructure.Audio;

public class NAudioPlaybackEngine : IAudioPlaybackService, IDisposable
{
    private IWavePlayer? _wavePlayer;
    private AudioFileReader? _audioFileReader;
    private MediaFoundationReader? _streamReader;
    private VolumeSampleProvider? _volumeProvider;

    private readonly System.Timers.Timer _positionTimer;
    private readonly IQueueService _queueService;

    private Track? _currentTrack;
    private PlayState _currentState = PlayState.Stopped;
    private double _volume = 0.7;
    private bool _isMuted;
    private RepeatMode _repeatMode = RepeatMode.Off;
    private bool _isShuffleEnabled;
    private bool _isDisposed;

    public PlayState CurrentState => _currentState;
    public Track? CurrentTrack => _currentTrack;
    public TimeSpan Position => _audioFileReader?.CurrentTime ?? _streamReader?.CurrentTime ?? TimeSpan.Zero;
    public TimeSpan Duration => _audioFileReader?.TotalTime ?? _streamReader?.TotalTime ?? TimeSpan.Zero;

    public double Volume
    {
        get => _volume;
        set
        {
            _volume = Math.Clamp(value, 0, 1);
            if (_volumeProvider != null)
                _volumeProvider.Volume = _isMuted ? 0 : (float)_volume;
            VolumeChanged?.Invoke(this, _volume);
        }
    }

    public bool IsMuted
    {
        get => _isMuted;
        set
        {
            _isMuted = value;
            if (_volumeProvider != null)
                _volumeProvider.Volume = _isMuted ? 0 : (float)_volume;
        }
    }

    public RepeatMode RepeatMode
    {
        get => _repeatMode;
        set => _repeatMode = value;
    }

    public bool IsShuffleEnabled
    {
        get => _isShuffleEnabled;
        set
        {
            _isShuffleEnabled = value;
            if (value)
                _queueService.EnableShuffle();
            else
                _queueService.DisableShuffle();
        }
    }

    public AudioDevice? CurrentDevice { get; private set; }

    public event EventHandler<TrackChangedEventArgs>? TrackChanged;
    public event EventHandler<PlaybackPositionChangedEventArgs>? PositionChanged;
    public event EventHandler<PlayState>? StateChanged;
    public event EventHandler<double>? VolumeChanged;

    public NAudioPlaybackEngine(IQueueService queueService)
    {
        _queueService = queueService;
        _positionTimer = new System.Timers.Timer(250);
        _positionTimer.Elapsed += OnPositionTimerElapsed;
    }

    private void OnPositionTimerElapsed(object? sender, System.Timers.ElapsedEventArgs e)
    {
        PositionChanged?.Invoke(this, new PlaybackPositionChangedEventArgs(Position, Duration));
    }

    public async Task PlayAsync(Track track)
    {
        await StopAsync();

        var previousTrack = _currentTrack;
        _currentTrack = track;

        try
        {
            ISampleProvider? sampleProvider = null;

            if (track.IsLocal && !string.IsNullOrEmpty(track.LocalPath) && File.Exists(track.LocalPath))
            {
                _audioFileReader = new AudioFileReader(track.LocalPath);
                sampleProvider = _audioFileReader.ToSampleProvider();
            }
            else if (!string.IsNullOrEmpty(track.StreamUrl))
            {
                _streamReader = new MediaFoundationReader(track.StreamUrl);
                sampleProvider = _streamReader.ToSampleProvider();
            }
            else
            {
                // No playable source available
                _currentState = PlayState.Error;
                StateChanged?.Invoke(this, _currentState);
                return;
            }

            _volumeProvider = new VolumeSampleProvider(sampleProvider)
            {
                Volume = _isMuted ? 0 : (float)_volume
            };

            _wavePlayer = new WaveOutEvent();
            _wavePlayer.Init(_volumeProvider);
            _wavePlayer.PlaybackStopped += OnPlaybackStopped;
            _wavePlayer.Play();

            _currentState = PlayState.Playing;
            _positionTimer.Start();

            StateChanged?.Invoke(this, _currentState);
            TrackChanged?.Invoke(this, new TrackChangedEventArgs(track, previousTrack));
        }
        catch (Exception)
        {
            _currentState = PlayState.Error;
            StateChanged?.Invoke(this, _currentState);
        }
    }

    public async Task PlayAsync(IEnumerable<Track> tracks, int startIndex = 0)
    {
        _queueService.SetQueue(tracks, startIndex);
        var track = _queueService.GetNext();
        if (track != null)
        {
            await PlayAsync(track);
        }
    }

    public Task PauseAsync()
    {
        if (_wavePlayer?.PlaybackState == PlaybackState.Playing)
        {
            _wavePlayer.Pause();
            _currentState = PlayState.Paused;
            _positionTimer.Stop();
            StateChanged?.Invoke(this, _currentState);
        }
        return Task.CompletedTask;
    }

    public Task ResumeAsync()
    {
        if (_wavePlayer?.PlaybackState == PlaybackState.Paused)
        {
            _wavePlayer.Play();
            _currentState = PlayState.Playing;
            _positionTimer.Start();
            StateChanged?.Invoke(this, _currentState);
        }
        return Task.CompletedTask;
    }

    public Task StopAsync()
    {
        _positionTimer.Stop();
        _wavePlayer?.Stop();
        _wavePlayer?.Dispose();
        _audioFileReader?.Dispose();
        _streamReader?.Dispose();

        _wavePlayer = null;
        _audioFileReader = null;
        _streamReader = null;
        _volumeProvider = null;

        _currentState = PlayState.Stopped;
        StateChanged?.Invoke(this, _currentState);

        return Task.CompletedTask;
    }

    public Task SeekAsync(TimeSpan position)
    {
        if (_audioFileReader != null)
        {
            _audioFileReader.CurrentTime = position;
        }
        else if (_streamReader != null)
        {
            _streamReader.CurrentTime = position;
        }
        return Task.CompletedTask;
    }

    public async Task NextAsync()
    {
        var next = _queueService.GetNext();
        if (next != null)
        {
            await PlayAsync(next);
        }
        else if (RepeatMode == RepeatMode.All)
        {
            _queueService.RestartQueue();
            var first = _queueService.GetNext();
            if (first != null) await PlayAsync(first);
        }
        else
        {
            await StopAsync();
        }
    }

    public async Task PreviousAsync()
    {
        if (Position.TotalSeconds > 3)
        {
            await SeekAsync(TimeSpan.Zero);
        }
        else
        {
            var previous = _queueService.GetPrevious();
            if (previous != null)
            {
                await PlayAsync(previous);
            }
            else
            {
                await SeekAsync(TimeSpan.Zero);
            }
        }
    }

    public async Task TogglePlayPauseAsync()
    {
        switch (_currentState)
        {
            case PlayState.Playing:
                await PauseAsync();
                break;
            case PlayState.Paused:
                await ResumeAsync();
                break;
            case PlayState.Stopped when _currentTrack != null:
                await PlayAsync(_currentTrack);
                break;
        }
    }

    private async void OnPlaybackStopped(object? sender, StoppedEventArgs e)
    {
        if (e.Exception != null)
        {
            _currentState = PlayState.Error;
            StateChanged?.Invoke(this, _currentState);
            return;
        }

        // Check if track ended naturally (position near end)
        var atEnd = Duration > TimeSpan.Zero &&
                    (Duration - Position).TotalSeconds < 1;

        if (atEnd)
        {
            if (RepeatMode == RepeatMode.One && _currentTrack != null)
            {
                await SeekAsync(TimeSpan.Zero);
                await ResumeAsync();
            }
            else
            {
                await NextAsync();
            }
        }
    }

    public IEnumerable<AudioDevice> GetAvailableDevices()
    {
        for (int i = 0; i < WaveOut.DeviceCount; i++)
        {
            var caps = WaveOut.GetCapabilities(i);
            yield return new AudioDevice
            {
                Id = i.ToString(),
                Name = caps.ProductName,
                IsDefault = i == 0
            };
        }
    }

    public Task SetDeviceAsync(AudioDevice device)
    {
        CurrentDevice = device;
        return Task.CompletedTask;
    }

    public void Dispose()
    {
        if (_isDisposed) return;
        _isDisposed = true;

        _positionTimer.Stop();
        _positionTimer.Dispose();
        _wavePlayer?.Stop();
        _wavePlayer?.Dispose();
        _audioFileReader?.Dispose();
        _streamReader?.Dispose();
    }
}
