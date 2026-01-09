using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JubileeVibes.Core.Enums;
using JubileeVibes.Core.Interfaces;
using JubileeVibes.Core.Models;

namespace JubileeVibes.ViewModels.Pages;

public partial class SettingsViewModel : ViewModelBase
{
    private readonly ISettingsService _settingsService;
    private readonly IAudioPlaybackService _playbackService;
    private readonly IDialogService _dialogService;

    [ObservableProperty]
    private string _themeMode = "dark";

    [ObservableProperty]
    private string _accentColor = "#1DB954";

    [ObservableProperty]
    private AudioQuality _streamingQuality = AudioQuality.High;

    [ObservableProperty]
    private AudioQuality _downloadQuality = AudioQuality.VeryHigh;

    [ObservableProperty]
    private bool _crossfadeEnabled;

    [ObservableProperty]
    private int _crossfadeDuration = 5;

    [ObservableProperty]
    private bool _normalizationEnabled = true;

    [ObservableProperty]
    private bool _gaplessPlayback = true;

    [ObservableProperty]
    private string? _selectedAudioDevice;

    [ObservableProperty]
    private ObservableCollection<AudioDevice> _audioDevices = new();

    [ObservableProperty]
    private bool _showLocalFiles = true;

    [ObservableProperty]
    private ObservableCollection<string> _localMusicFolders = new();

    [ObservableProperty]
    private bool _desktopNotifications = true;

    [ObservableProperty]
    private bool _showNowPlaying = true;

    public SettingsViewModel(
        ISettingsService settingsService,
        IAudioPlaybackService playbackService,
        IDialogService dialogService)
    {
        _settingsService = settingsService;
        _playbackService = playbackService;
        _dialogService = dialogService;
    }

    public override async Task InitializeAsync()
    {
        await LoadSettingsAsync();
        LoadAudioDevices();
    }

    private async Task LoadSettingsAsync()
    {
        var settings = _settingsService.Settings;

        ThemeMode = settings.Theme.Mode;
        AccentColor = settings.Theme.AccentColor;
        StreamingQuality = settings.Playback.StreamingQuality;
        DownloadQuality = settings.Playback.DownloadQuality;
        CrossfadeEnabled = settings.Playback.CrossfadeEnabled;
        CrossfadeDuration = settings.Playback.CrossfadeDurationMs / 1000;
        NormalizationEnabled = settings.Playback.NormalizationEnabled;
        GaplessPlayback = settings.Playback.GaplessPlayback;
        SelectedAudioDevice = settings.Audio.SelectedDeviceId;
        ShowLocalFiles = settings.Library.ShowLocalFiles;
        LocalMusicFolders = new ObservableCollection<string>(settings.Library.LocalMusicFolders);
        DesktopNotifications = settings.Notifications.DesktopNotifications;
        ShowNowPlaying = settings.Notifications.ShowNowPlaying;

        await Task.CompletedTask;
    }

    private void LoadAudioDevices()
    {
        var devices = _playbackService.GetAvailableDevices();
        AudioDevices = new ObservableCollection<AudioDevice>(devices);
    }

    [RelayCommand]
    private async Task SaveSettings()
    {
        var settings = _settingsService.Settings;

        settings.Theme.Mode = ThemeMode;
        settings.Theme.AccentColor = AccentColor;
        settings.Playback.StreamingQuality = StreamingQuality;
        settings.Playback.DownloadQuality = DownloadQuality;
        settings.Playback.CrossfadeEnabled = CrossfadeEnabled;
        settings.Playback.CrossfadeDurationMs = CrossfadeDuration * 1000;
        settings.Playback.NormalizationEnabled = NormalizationEnabled;
        settings.Playback.GaplessPlayback = GaplessPlayback;
        settings.Audio.SelectedDeviceId = SelectedAudioDevice;
        settings.Library.ShowLocalFiles = ShowLocalFiles;
        settings.Library.LocalMusicFolders = LocalMusicFolders.ToList();
        settings.Notifications.DesktopNotifications = DesktopNotifications;
        settings.Notifications.ShowNowPlaying = ShowNowPlaying;

        await _settingsService.SaveAsync();
    }

    [RelayCommand]
    private async Task AddMusicFolder()
    {
        var folder = await _dialogService.ShowSaveFolderDialogAsync("Select Music Folder");
        if (!string.IsNullOrEmpty(folder) && !LocalMusicFolders.Contains(folder))
        {
            LocalMusicFolders.Add(folder);
            await SaveSettings();
        }
    }

    [RelayCommand]
    private async Task RemoveMusicFolder(string folder)
    {
        LocalMusicFolders.Remove(folder);
        await SaveSettings();
    }

    [RelayCommand]
    private async Task SetAudioDevice(AudioDevice device)
    {
        SelectedAudioDevice = device.Id;
        await _playbackService.SetDeviceAsync(device);
        await SaveSettings();
    }

    [RelayCommand]
    private async Task ResetToDefaults()
    {
        var confirmed = await _dialogService.ShowConfirmationAsync(
            "Reset Settings",
            "Are you sure you want to reset all settings to defaults?");

        if (confirmed)
        {
            await _settingsService.ResetToDefaultsAsync();
            await LoadSettingsAsync();
        }
    }
}
