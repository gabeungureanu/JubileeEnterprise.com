using System;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Windows;
using Microsoft.Extensions.Logging;

namespace JubileeMusic.Services;

public class WindowSettingsService : IWindowSettingsService
{
    private const int CurrentVersion = 1;
    private readonly ILogger<WindowSettingsService> _logger;
    private readonly string _settingsFilePath;
    private readonly JsonSerializerOptions _jsonOptions;

    public WindowSettingsService(ILogger<WindowSettingsService> logger)
    {
        _logger = logger;

        var appDataFolder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "JubileeMusic");

        Directory.CreateDirectory(appDataFolder);
        _settingsFilePath = Path.Combine(appDataFolder, "app-state.json");

        _jsonOptions = new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            Converters = { new JsonStringEnumConverter() }
        };

        _logger.LogDebug("Application state file: {Path}", _settingsFilePath);
    }

    public WindowSettings LoadSettings()
    {
        try
        {
            if (File.Exists(_settingsFilePath))
            {
                var json = File.ReadAllText(_settingsFilePath);
                var settings = JsonSerializer.Deserialize<WindowSettings>(json, _jsonOptions);

                if (settings != null)
                {
                    // Handle version migrations if needed
                    settings = MigrateSettings(settings);

                    // Validate that the window position is within screen bounds
                    settings = ValidateSettings(settings);

                    _logger.LogInformation(
                        "Application state loaded: {Width}x{Height} at ({Left},{Top}), State: {State}, View: {View}, CreatorPanel: {CreatorPanelOpen}, ChatGptPanel: {ChatGptPanelOpen} ({ChatGptPanelWidth}px)",
                        settings.Width, settings.Height, settings.Left, settings.Top,
                        settings.WindowState, settings.LastView, settings.IsCreatorPanelOpen,
                        settings.IsChatGptPanelOpen, settings.ChatGptPanelWidth);

                    return settings;
                }
            }
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Failed to parse application state (corrupted or incompatible), using defaults");
            // Backup the corrupted file for debugging
            TryBackupCorruptedFile();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to load application state, using defaults");
        }

        _logger.LogInformation("Using default application state");
        return new WindowSettings();
    }

    public void SaveSettings(WindowSettings settings)
    {
        try
        {
            // Ensure version is current
            settings.Version = CurrentVersion;

            _logger.LogInformation(
                "Saving application state: {Width}x{Height} at ({Left},{Top}), State: {State}, View: {View}, CreatorPanel: {CreatorPanelOpen}, ChatGptPanel: {ChatGptPanelOpen} ({ChatGptPanelWidth}px)",
                settings.Width, settings.Height, settings.Left, settings.Top,
                settings.WindowState, settings.LastView, settings.IsCreatorPanelOpen,
                settings.IsChatGptPanelOpen, settings.ChatGptPanelWidth);

            var json = JsonSerializer.Serialize(settings, _jsonOptions);

            // Write to temp file first, then rename (atomic operation)
            var tempPath = _settingsFilePath + ".tmp";
            File.WriteAllText(tempPath, json);
            File.Move(tempPath, _settingsFilePath, overwrite: true);

            _logger.LogDebug("Application state saved successfully to {Path}", _settingsFilePath);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save application state");
        }
    }

    private WindowSettings MigrateSettings(WindowSettings settings)
    {
        // Handle future version migrations here
        if (settings.Version < CurrentVersion)
        {
            _logger.LogInformation("Migrating settings from version {Old} to {New}",
                settings.Version, CurrentVersion);

            // Add migration logic for each version bump
            // For now, just update the version
            settings.Version = CurrentVersion;
        }

        return settings;
    }

    private WindowSettings ValidateSettings(WindowSettings settings)
    {
        // Get the virtual screen bounds (all monitors combined)
        var virtualLeft = SystemParameters.VirtualScreenLeft;
        var virtualTop = SystemParameters.VirtualScreenTop;
        var virtualWidth = SystemParameters.VirtualScreenWidth;
        var virtualHeight = SystemParameters.VirtualScreenHeight;

        _logger.LogDebug("Virtual screen bounds: ({Left},{Top}) {Width}x{Height}",
            virtualLeft, virtualTop, virtualWidth, virtualHeight);

        // Ensure minimum size
        if (settings.Width < 900) settings.Width = 900;
        if (settings.Height < 600) settings.Height = 600;
        if (settings.RestoreWidth < 900) settings.RestoreWidth = 900;
        if (settings.RestoreHeight < 600) settings.RestoreHeight = 600;

        // Ensure maximum size doesn't exceed virtual screen
        if (settings.Width > virtualWidth) settings.Width = virtualWidth;
        if (settings.Height > virtualHeight) settings.Height = virtualHeight;

        // Ensure window is at least partially visible on screen
        if (!double.IsNaN(settings.Left) && !double.IsNaN(settings.Top))
        {
            // Check if window would be completely off-screen
            var windowRight = settings.Left + settings.Width;
            var windowBottom = settings.Top + settings.Height;

            // If window is completely off-screen, reset to center
            if (settings.Left > virtualLeft + virtualWidth - 100 ||
                windowRight < virtualLeft + 100 ||
                settings.Top > virtualTop + virtualHeight - 100 ||
                windowBottom < virtualTop + 100)
            {
                _logger.LogWarning("Window position was off-screen, resetting to center");
                settings.Left = double.NaN;
                settings.Top = double.NaN;
            }
        }

        // Validate Creator panel width
        if (settings.CreatorPanelWidth < 280) settings.CreatorPanelWidth = 280;
        if (settings.CreatorPanelWidth > 500) settings.CreatorPanelWidth = 500;

        // Validate ChatGPT panel width (min 300, max 50% of screen)
        var maxChatGptWidth = virtualWidth * 0.5;
        if (settings.ChatGptPanelWidth < 300) settings.ChatGptPanelWidth = 300;
        if (settings.ChatGptPanelWidth > maxChatGptWidth) settings.ChatGptPanelWidth = maxChatGptWidth;

        // Validate last view
        var validViews = new[] { "Browser", "Create", "Library", "Settings" };
        if (!Array.Exists(validViews, v => v.Equals(settings.LastView, StringComparison.OrdinalIgnoreCase)))
        {
            settings.LastView = "Browser";
        }

        return settings;
    }

    private void TryBackupCorruptedFile()
    {
        try
        {
            if (File.Exists(_settingsFilePath))
            {
                var backupPath = _settingsFilePath + $".corrupted.{DateTime.Now:yyyyMMdd-HHmmss}";
                File.Move(_settingsFilePath, backupPath);
                _logger.LogInformation("Backed up corrupted state file to {Path}", backupPath);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to backup corrupted state file");
        }
    }
}
