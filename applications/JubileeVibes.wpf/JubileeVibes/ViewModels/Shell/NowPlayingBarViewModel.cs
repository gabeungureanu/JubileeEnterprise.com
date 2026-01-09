using System.Windows.Media;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JubileeVibes.Core.Enums;
using JubileeVibes.Core.Events;
using JubileeVibes.Core.Interfaces;
using JubileeVibes.Core.Models;

namespace JubileeVibes.ViewModels.Shell;

public partial class NowPlayingBarViewModel : ViewModelBase
{
    private readonly IAudioPlaybackService _playbackService;
    private readonly IQueueService _queueService;
    private readonly INavigationService _navigationService;
    private readonly ILibraryService _libraryService;

    [ObservableProperty]
    private Track? _currentTrack;

    [ObservableProperty]
    private bool _hasCurrentTrack;

    [ObservableProperty]
    private bool _isPlaying;

    [ObservableProperty]
    private double _positionPercent;

    [ObservableProperty]
    private string _positionFormatted = "0:00";

    [ObservableProperty]
    private string _durationFormatted = "0:00";

    [ObservableProperty]
    private double _volume = 0.7;

    [ObservableProperty]
    private bool _isMuted;

    [ObservableProperty]
    private bool _isShuffleEnabled;

    [ObservableProperty]
    private RepeatMode _repeatMode = RepeatMode.Off;

    [ObservableProperty]
    private Geometry _playPauseIcon;

    [ObservableProperty]
    private string _playPauseTooltip = "Play";

    [ObservableProperty]
    private Geometry _volumeIcon;

    [ObservableProperty]
    private string _volumeTooltip = "Mute";

    [ObservableProperty]
    private Geometry _repeatIcon;

    [ObservableProperty]
    private string _repeatTooltip = "Enable repeat";

    [ObservableProperty]
    private bool _isRepeatEnabled;

    private bool _isSeeking;

    public NowPlayingBarViewModel(
        IAudioPlaybackService playbackService,
        IQueueService queueService,
        INavigationService navigationService,
        ILibraryService libraryService)
    {
        _playbackService = playbackService;
        _queueService = queueService;
        _navigationService = navigationService;
        _libraryService = libraryService;

        // Subscribe to events
        _playbackService.TrackChanged += OnTrackChanged;
        _playbackService.PositionChanged += OnPositionChanged;
        _playbackService.StateChanged += OnStateChanged;
        _playbackService.VolumeChanged += OnVolumeChanged;

        // Initialize icons
        UpdatePlayPauseIcon();
        UpdateVolumeIcon();
        UpdateRepeatIcon();

        // Set initial volume
        Volume = _playbackService.Volume;
    }

    private void OnTrackChanged(object? sender, TrackChangedEventArgs e)
    {
        CurrentTrack = e.CurrentTrack;
        HasCurrentTrack = CurrentTrack != null;
    }

    private void OnPositionChanged(object? sender, PlaybackPositionChangedEventArgs e)
    {
        if (!_isSeeking)
        {
            PositionPercent = e.Progress * 100;
            PositionFormatted = FormatTimeSpan(e.Position);
            DurationFormatted = FormatTimeSpan(e.Duration);
        }
    }

    private void OnStateChanged(object? sender, PlayState state)
    {
        IsPlaying = state == PlayState.Playing;
        UpdatePlayPauseIcon();
    }

    private void OnVolumeChanged(object? sender, double volume)
    {
        if (Math.Abs(Volume - volume) > 0.01)
        {
            Volume = volume;
        }
        UpdateVolumeIcon();
    }

    partial void OnVolumeChanged(double value)
    {
        _playbackService.Volume = value;
        UpdateVolumeIcon();
    }

    partial void OnIsMutedChanged(bool value)
    {
        _playbackService.IsMuted = value;
        UpdateVolumeIcon();
    }

    partial void OnIsShuffleEnabledChanged(bool value)
    {
        _playbackService.IsShuffleEnabled = value;
    }

    partial void OnRepeatModeChanged(RepeatMode value)
    {
        _playbackService.RepeatMode = value;
        IsRepeatEnabled = value != RepeatMode.Off;
        UpdateRepeatIcon();
    }

    private void UpdatePlayPauseIcon()
    {
        // These would be loaded from resources in actual implementation
        PlayPauseTooltip = IsPlaying ? "Pause" : "Play";
    }

    private void UpdateVolumeIcon()
    {
        if (IsMuted || Volume == 0)
        {
            VolumeTooltip = "Unmute";
        }
        else if (Volume < 0.33)
        {
            VolumeTooltip = "Mute";
        }
        else if (Volume < 0.66)
        {
            VolumeTooltip = "Mute";
        }
        else
        {
            VolumeTooltip = "Mute";
        }
    }

    private void UpdateRepeatIcon()
    {
        RepeatTooltip = RepeatMode switch
        {
            RepeatMode.Off => "Enable repeat",
            RepeatMode.All => "Enable repeat one",
            RepeatMode.One => "Disable repeat",
            _ => "Enable repeat"
        };
    }

    private static string FormatTimeSpan(TimeSpan time)
    {
        return time.TotalHours >= 1
            ? time.ToString(@"h\:mm\:ss")
            : time.ToString(@"m\:ss");
    }

    public void SeekToPosition(double percent)
    {
        var duration = _playbackService.Duration;
        var position = TimeSpan.FromSeconds(duration.TotalSeconds * (percent / 100));
        _playbackService.SeekAsync(position);
    }

    [RelayCommand]
    private async Task TogglePlayPause()
    {
        await _playbackService.TogglePlayPauseAsync();
    }

    [RelayCommand]
    private async Task Previous()
    {
        await _playbackService.PreviousAsync();
    }

    [RelayCommand]
    private async Task Next()
    {
        await _playbackService.NextAsync();
    }

    [RelayCommand]
    private void ToggleMute()
    {
        IsMuted = !IsMuted;
    }

    [RelayCommand]
    private void CycleRepeat()
    {
        RepeatMode = RepeatMode switch
        {
            RepeatMode.Off => RepeatMode.All,
            RepeatMode.All => RepeatMode.One,
            RepeatMode.One => RepeatMode.Off,
            _ => RepeatMode.Off
        };
    }

    [RelayCommand]
    private void ShowQueue()
    {
        _navigationService.NavigateTo(NavigationTarget.Queue);
    }

    [RelayCommand]
    private void ShowDevices()
    {
        // Would show device selection dialog
    }

    [RelayCommand]
    private void ToggleFullscreen()
    {
        // Would toggle fullscreen mode
    }

    [RelayCommand]
    private async Task ToggleLike()
    {
        if (CurrentTrack == null) return;

        if (CurrentTrack.IsLiked)
        {
            await _libraryService.UnlikeTrackAsync(CurrentTrack.Id);
            CurrentTrack.IsLiked = false;
        }
        else
        {
            await _libraryService.LikeTrackAsync(CurrentTrack.Id);
            CurrentTrack.IsLiked = true;
        }
    }
}
