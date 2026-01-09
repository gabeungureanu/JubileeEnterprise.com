using System.IO;
using Newtonsoft.Json;
using JubileeVibes.Core.Interfaces;
using JubileeVibes.Core.Models;

namespace JubileeVibes.Infrastructure.Services;

public class SettingsService : ISettingsService
{
    private readonly string _settingsPath;
    private VibesSettings _settings;
    private readonly object _lock = new();

    public VibesSettings Settings
    {
        get
        {
            lock (_lock) { return _settings; }
        }
    }

    public event EventHandler<VibesSettings>? SettingsChanged;

    public SettingsService()
    {
        var appDataPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "JubileeVibes");

        Directory.CreateDirectory(appDataPath);
        _settingsPath = Path.Combine(appDataPath, "settings.json");
        _settings = new VibesSettings();
    }

    public async Task LoadAsync()
    {
        try
        {
            if (File.Exists(_settingsPath))
            {
                var json = await File.ReadAllTextAsync(_settingsPath);
                var loaded = JsonConvert.DeserializeObject<VibesSettings>(json);
                if (loaded != null)
                {
                    lock (_lock)
                    {
                        _settings = loaded;
                    }
                }
            }
        }
        catch (Exception)
        {
            _settings = new VibesSettings();
        }
    }

    public async Task SaveAsync()
    {
        try
        {
            VibesSettings toSave;
            lock (_lock)
            {
                toSave = _settings;
            }

            var json = JsonConvert.SerializeObject(toSave, Formatting.Indented);
            await File.WriteAllTextAsync(_settingsPath, json);
            SettingsChanged?.Invoke(this, toSave);
        }
        catch (Exception)
        {
            // Log error in production
        }
    }

    public Task<T> GetAsync<T>(string key, T defaultValue)
    {
        lock (_lock)
        {
            object? result = key switch
            {
                "Theme" => _settings.Theme,
                "Playback" => _settings.Playback,
                "Audio" => _settings.Audio,
                "Library" => _settings.Library,
                "Window" => _settings.Window,
                "Volume" => _settings.Audio.Volume,
                "MonoAudio" => _settings.Audio.MonoAudio,
                "CrossfadeEnabled" => _settings.Playback.CrossfadeEnabled,
                "NormalizationEnabled" => _settings.Playback.NormalizationEnabled,
                _ => defaultValue
            };

            if (result is T typedResult)
                return Task.FromResult(typedResult);

            return Task.FromResult(defaultValue);
        }
    }

    public async Task SetAsync<T>(string key, T value)
    {
        lock (_lock)
        {
            switch (key)
            {
                case "Theme" when value is ThemeSettings theme:
                    _settings.Theme = theme;
                    break;
                case "Playback" when value is PlaybackSettings playback:
                    _settings.Playback = playback;
                    break;
                case "Audio" when value is AudioSettings audio:
                    _settings.Audio = audio;
                    break;
                case "Library" when value is LibrarySettings library:
                    _settings.Library = library;
                    break;
                case "Window" when value is WindowSettings window:
                    _settings.Window = window;
                    break;
                case "Volume" when value is double volume:
                    _settings.Audio.Volume = volume;
                    break;
                case "MonoAudio" when value is bool mono:
                    _settings.Audio.MonoAudio = mono;
                    break;
            }
        }

        await SaveAsync();
    }

    public async Task ResetToDefaultsAsync()
    {
        lock (_lock)
        {
            _settings = new VibesSettings();
        }

        await SaveAsync();
    }
}
