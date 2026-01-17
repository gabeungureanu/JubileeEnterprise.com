using System;
using System.IO;
using System.Threading.Tasks;
using Newtonsoft.Json;
using JubileeAvatar.Models;

namespace JubileeAvatar.Services
{
    public class SettingsService : ISettingsService
    {
        private readonly string _settingsPath;
        private readonly string _developmentSettingsPath;

        public AppSettings Settings { get; private set; } = new();
        public JubileePersona Persona { get; private set; } = new();

        public SettingsService()
        {
            var baseDir = AppDomain.CurrentDomain.BaseDirectory;
            _settingsPath = Path.Combine(baseDir, "Config", "settings.json");
            _developmentSettingsPath = Path.Combine(baseDir, "Config", "settings.development.json");

            // Load settings synchronously in constructor for immediate availability
            LoadAsync().Wait();
        }

        public async Task LoadAsync()
        {
            try
            {
                // Load base settings
                if (File.Exists(_settingsPath))
                {
                    var json = await File.ReadAllTextAsync(_settingsPath);
                    Settings = JsonConvert.DeserializeObject<AppSettings>(json) ?? new AppSettings();
                }

                // Override with development settings if in development mode
                if (Settings.Environment == "development" && File.Exists(_developmentSettingsPath))
                {
                    var devJson = await File.ReadAllTextAsync(_developmentSettingsPath);
                    var devSettings = JsonConvert.DeserializeObject<AppSettings>(devJson);
                    if (devSettings != null)
                    {
                        MergeSettings(devSettings);
                    }
                }

                // Load environment variable overrides
                LoadEnvironmentOverrides();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error loading settings: {ex.Message}");
                Settings = new AppSettings();
            }
        }

        private void MergeSettings(AppSettings devSettings)
        {
            // Override API keys if provided in dev settings
            if (!string.IsNullOrEmpty(devSettings.Api.OpenAIApiKey))
                Settings.Api.OpenAIApiKey = devSettings.Api.OpenAIApiKey;
            if (!string.IsNullOrEmpty(devSettings.Api.ElevenLabsApiKey))
                Settings.Api.ElevenLabsApiKey = devSettings.Api.ElevenLabsApiKey;
            if (!string.IsNullOrEmpty(devSettings.Api.DIDApiKey))
                Settings.Api.DIDApiKey = devSettings.Api.DIDApiKey;
            if (!string.IsNullOrEmpty(devSettings.Api.HeyGenApiKey))
                Settings.Api.HeyGenApiKey = devSettings.Api.HeyGenApiKey;

            // Override backend URL if provided
            if (!string.IsNullOrEmpty(devSettings.Backend.Url))
                Settings.Backend.Url = devSettings.Backend.Url;
        }

        private void LoadEnvironmentOverrides()
        {
            // Allow environment variables to override settings
            var openAiKey = Environment.GetEnvironmentVariable("JUBILEE_OPENAI_API_KEY");
            if (!string.IsNullOrEmpty(openAiKey))
                Settings.Api.OpenAIApiKey = openAiKey;

            var elevenLabsKey = Environment.GetEnvironmentVariable("JUBILEE_ELEVENLABS_API_KEY");
            if (!string.IsNullOrEmpty(elevenLabsKey))
                Settings.Api.ElevenLabsApiKey = elevenLabsKey;

            var didKey = Environment.GetEnvironmentVariable("JUBILEE_DID_API_KEY");
            if (!string.IsNullOrEmpty(didKey))
                Settings.Api.DIDApiKey = didKey;

            var heyGenKey = Environment.GetEnvironmentVariable("JUBILEE_HEYGEN_API_KEY");
            if (!string.IsNullOrEmpty(heyGenKey))
                Settings.Api.HeyGenApiKey = heyGenKey;
        }

        public async Task SaveAsync()
        {
            try
            {
                var directory = Path.GetDirectoryName(_settingsPath);
                if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
                {
                    Directory.CreateDirectory(directory);
                }

                var json = JsonConvert.SerializeObject(Settings, Formatting.Indented);
                await File.WriteAllTextAsync(_settingsPath, json);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error saving settings: {ex.Message}");
            }
        }

        public void UpdateApiKey(string provider, string key)
        {
            switch (provider.ToLower())
            {
                case "openai":
                    Settings.Api.OpenAIApiKey = key;
                    break;
                case "elevenlabs":
                    Settings.Api.ElevenLabsApiKey = key;
                    break;
                case "d-id":
                case "did":
                    Settings.Api.DIDApiKey = key;
                    break;
                case "heygen":
                    Settings.Api.HeyGenApiKey = key;
                    break;
            }
        }
    }
}
