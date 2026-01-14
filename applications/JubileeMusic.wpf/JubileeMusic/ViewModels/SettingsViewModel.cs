using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JubileeMusic.Models;
using JubileeMusic.Services;
using Microsoft.Extensions.Logging;

namespace JubileeMusic.ViewModels;

public partial class SettingsViewModel : BaseViewModel
{
    private readonly ICredentialService _credentialService;
    private readonly ILibraryService _libraryService;
    private readonly ILoggingService _loggingService;
    private readonly ILogger<SettingsViewModel> _logger;

    // Credential settings
    [ObservableProperty]
    private string _email = string.Empty;

    [ObservableProperty]
    private string _password = string.Empty;

    [ObservableProperty]
    private bool _hasStoredCredentials;

    [ObservableProperty]
    private AuthMethod _authMethod = AuthMethod.Interactive;

    [ObservableProperty]
    private string _configFilePath = string.Empty;

    // Library settings
    [ObservableProperty]
    private string _libraryPath = string.Empty;

    [ObservableProperty]
    private int _trackCount;

    [ObservableProperty]
    private string _librarySize = string.Empty;

    // Logging
    [ObservableProperty]
    private string _logFilePath = string.Empty;

    [ObservableProperty]
    private string _recentLogs = string.Empty;

    public SettingsViewModel(
        ICredentialService credentialService,
        ILibraryService libraryService,
        ILoggingService loggingService,
        ILogger<SettingsViewModel> logger)
    {
        _credentialService = credentialService;
        _libraryService = libraryService;
        _loggingService = loggingService;
        _logger = logger;
    }

    [RelayCommand]
    private async Task LoadSettings()
    {
        await ExecuteWithBusyIndicator(async () =>
        {
            // Load credential info
            HasStoredCredentials = await _credentialService.HasStoredCredentialsAsync();

            if (HasStoredCredentials)
            {
                var credentials = await _credentialService.GetCredentialsAsync();
                if (credentials != null)
                {
                    Email = credentials.Email;
                    AuthMethod = credentials.AuthMethod;
                    ConfigFilePath = credentials.ConfigFilePath ?? string.Empty;
                    // Never show password, just indicate it exists
                    Password = "********";
                }
            }

            // Load library info
            LibraryPath = _libraryService.LibraryPath;
            var tracks = await _libraryService.GetAllTracksAsync();
            TrackCount = tracks.Count;

            // Calculate library size
            LibrarySize = CalculateLibrarySize();

            // Load log info
            LogFilePath = _loggingService.GetLogFilePath();
            RecentLogs = await _loggingService.GetRecentLogsAsync(50);

            _logger.LogInformation("Settings loaded");
        }, "Loading settings...");
    }

    [RelayCommand]
    private async Task SaveCredentials()
    {
        if (string.IsNullOrWhiteSpace(Email))
        {
            SetError("Email is required");
            return;
        }

        await ExecuteWithBusyIndicator(async () =>
        {
            var credentials = new SunoCredentials
            {
                Email = Email,
                Password = Password == "********" ? string.Empty : Password, // Don't overwrite if unchanged
                AuthMethod = AuthMethod,
                ConfigFilePath = AuthMethod == AuthMethod.ConfigFile ? ConfigFilePath : null
            };

            // If password is placeholder and we have stored credentials, keep old password
            if (Password == "********" && HasStoredCredentials)
            {
                var existing = await _credentialService.GetCredentialsAsync();
                if (existing != null)
                {
                    credentials.Password = existing.Password;
                }
            }

            if (string.IsNullOrWhiteSpace(credentials.Password) && AuthMethod != AuthMethod.Interactive)
            {
                SetError("Password is required for automatic login");
                return;
            }

            await _credentialService.SaveCredentialsAsync(credentials);
            HasStoredCredentials = true;

            SetStatus("Credentials saved securely");
            _logger.LogInformation("Credentials saved for {Email}", Email);
        }, "Saving credentials...");
    }

    [RelayCommand]
    private async Task ClearCredentials()
    {
        await ExecuteWithBusyIndicator(async () =>
        {
            await _credentialService.DeleteCredentialsAsync();

            Email = string.Empty;
            Password = string.Empty;
            HasStoredCredentials = false;
            AuthMethod = AuthMethod.Interactive;
            ConfigFilePath = string.Empty;

            SetStatus("Credentials cleared");
            _logger.LogInformation("Credentials cleared");
        }, "Clearing credentials...");
    }

    [RelayCommand]
    private async Task LoadFromConfigFile()
    {
        if (string.IsNullOrWhiteSpace(ConfigFilePath))
        {
            SetError("Please specify a config file path");
            return;
        }

        await ExecuteWithBusyIndicator(async () =>
        {
            var credentials = await _credentialService.LoadFromConfigFileAsync(ConfigFilePath);

            if (credentials != null)
            {
                Email = credentials.Email;
                Password = "********";
                AuthMethod = AuthMethod.ConfigFile;
                SetStatus("Credentials loaded from config file");
            }
            else
            {
                SetError("Failed to load credentials from config file");
            }
        }, "Loading from config file...");
    }

    [RelayCommand]
    private void BrowseConfigFile()
    {
        var dialog = new Microsoft.Win32.OpenFileDialog
        {
            Title = "Select Credentials Config File",
            Filter = "JSON files (*.json)|*.json|All files (*.*)|*.*",
            CheckFileExists = true
        };

        if (dialog.ShowDialog() == true)
        {
            ConfigFilePath = dialog.FileName;
        }
    }

    [RelayCommand]
    private void OpenLibraryFolder()
    {
        try
        {
            if (Directory.Exists(LibraryPath))
            {
                System.Diagnostics.Process.Start("explorer.exe", LibraryPath);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to open library folder");
            SetError("Failed to open library folder");
        }
    }

    [RelayCommand]
    private void OpenLogFile()
    {
        try
        {
            if (File.Exists(LogFilePath))
            {
                System.Diagnostics.Process.Start("notepad.exe", LogFilePath);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to open log file");
            SetError("Failed to open log file");
        }
    }

    [RelayCommand]
    private async Task RefreshLogs()
    {
        RecentLogs = await _loggingService.GetRecentLogsAsync(100);
    }

    private string CalculateLibrarySize()
    {
        try
        {
            if (!Directory.Exists(LibraryPath))
            {
                return "0 MB";
            }

            var dirInfo = new DirectoryInfo(LibraryPath);
            var totalBytes = dirInfo.GetFiles("*", SearchOption.AllDirectories).Sum(f => f.Length);

            if (totalBytes < 1024)
                return $"{totalBytes} B";
            if (totalBytes < 1024 * 1024)
                return $"{totalBytes / 1024.0:F1} KB";
            if (totalBytes < 1024 * 1024 * 1024)
                return $"{totalBytes / (1024.0 * 1024):F1} MB";
            return $"{totalBytes / (1024.0 * 1024 * 1024):F2} GB";
        }
        catch
        {
            return "Unknown";
        }
    }
}
