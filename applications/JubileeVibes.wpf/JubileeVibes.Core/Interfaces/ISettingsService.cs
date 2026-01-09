using JubileeVibes.Core.Models;

namespace JubileeVibes.Core.Interfaces;

public interface ISettingsService
{
    VibesSettings Settings { get; }

    event EventHandler<VibesSettings>? SettingsChanged;

    Task LoadAsync();
    Task SaveAsync();
    Task<T> GetAsync<T>(string key, T defaultValue);
    Task SetAsync<T>(string key, T value);
    Task ResetToDefaultsAsync();
}
