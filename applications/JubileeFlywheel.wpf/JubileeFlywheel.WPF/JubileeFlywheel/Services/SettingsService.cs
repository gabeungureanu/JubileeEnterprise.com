using System.IO;
using Newtonsoft.Json;
using JubileeFlywheel.Models;

namespace JubileeFlywheel.Services
{
    public class SettingsService : ISettingsService
    {
        private readonly string _settingsPath;
        private readonly object _lock = new();

        public AppSettings Settings { get; private set; } = new();

        public SettingsService()
        {
            var appDataPath = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            var appFolder = Path.Combine(appDataPath, "JubileeFlywheel");
            Directory.CreateDirectory(appFolder);
            _settingsPath = Path.Combine(appFolder, "settings.json");
        }

        public async Task LoadAsync()
        {
            try
            {
                if (File.Exists(_settingsPath))
                {
                    var json = await File.ReadAllTextAsync(_settingsPath);
                    var settings = JsonConvert.DeserializeObject<AppSettings>(json);
                    if (settings != null)
                    {
                        Settings = settings;
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error loading settings: {ex.Message}");
                Settings = new AppSettings();
            }
        }

        public async Task SaveAsync()
        {
            try
            {
                var json = JsonConvert.SerializeObject(Settings, Formatting.Indented);
                lock (_lock)
                {
                    File.WriteAllText(_settingsPath, json);
                }
                await Task.CompletedTask;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error saving settings: {ex.Message}");
            }
        }

        public void AddApiEndpoint(ApiEndpoint endpoint)
        {
            Settings.ApiEndpoints.Add(endpoint);
            _ = SaveAsync();
        }

        public void UpdateApiEndpoint(ApiEndpoint endpoint)
        {
            var index = Settings.ApiEndpoints.FindIndex(e => e.Id == endpoint.Id);
            if (index >= 0)
            {
                Settings.ApiEndpoints[index] = endpoint;
                _ = SaveAsync();
            }
        }

        public void RemoveApiEndpoint(string endpointId)
        {
            Settings.ApiEndpoints.RemoveAll(e => e.Id == endpointId);
            _ = SaveAsync();
        }

        public void AddDashboard(Dashboard dashboard)
        {
            Settings.Dashboards.Add(dashboard);
            _ = SaveAsync();
        }

        public void UpdateDashboard(Dashboard dashboard)
        {
            dashboard.UpdatedAt = DateTime.UtcNow;
            var index = Settings.Dashboards.FindIndex(d => d.Id == dashboard.Id);
            if (index >= 0)
            {
                Settings.Dashboards[index] = dashboard;
                _ = SaveAsync();
            }
        }

        public void RemoveDashboard(string dashboardId)
        {
            Settings.Dashboards.RemoveAll(d => d.Id == dashboardId);
            _ = SaveAsync();
        }
    }
}
