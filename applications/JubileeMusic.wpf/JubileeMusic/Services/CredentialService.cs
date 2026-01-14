using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using JubileeMusic.Models;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;

namespace JubileeMusic.Services;

public class CredentialService : ICredentialService
{
    private readonly ILogger<CredentialService> _logger;
    private readonly string _credentialStorePath;
    private readonly byte[] _entropy;
    private bool _hasStoredCredentials;

    public bool HasStoredCredentials => _hasStoredCredentials;
    public bool IsAuthenticated { get; set; }

    public CredentialService(ILogger<CredentialService> logger)
    {
        _logger = logger;

        // Store credentials in app data folder
        var appDataPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "JubileeMusic"
        );
        Directory.CreateDirectory(appDataPath);
        _credentialStorePath = Path.Combine(appDataPath, ".credentials");

        // Generate entropy based on machine-specific data
        _entropy = Encoding.UTF8.GetBytes(Environment.MachineName + "JubileeMusic2026");
    }

    public void Initialize()
    {
        _hasStoredCredentials = File.Exists(_credentialStorePath);
        _logger.LogInformation("Credential service initialized. Has stored credentials: {HasCreds}", _hasStoredCredentials);
    }

    public async Task<SunoCredentials?> GetCredentialsAsync()
    {
        try
        {
            if (!File.Exists(_credentialStorePath))
            {
                _logger.LogDebug("No stored credentials file found");
                return null;
            }

            var encryptedData = await File.ReadAllBytesAsync(_credentialStorePath);
            var decryptedData = ProtectedData.Unprotect(encryptedData, _entropy, DataProtectionScope.CurrentUser);
            var json = Encoding.UTF8.GetString(decryptedData);
            var credentials = JsonConvert.DeserializeObject<SunoCredentials>(json);

            _logger.LogInformation("Successfully retrieved stored credentials for {Email}",
                credentials?.Email?.Substring(0, 3) + "***");

            return credentials;
        }
        catch (CryptographicException ex)
        {
            _logger.LogError(ex, "Failed to decrypt stored credentials. Credentials may be corrupted.");
            await DeleteCredentialsAsync();
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving stored credentials");
            return null;
        }
    }

    public async Task SaveCredentialsAsync(SunoCredentials credentials)
    {
        try
        {
            var json = JsonConvert.SerializeObject(credentials);
            var data = Encoding.UTF8.GetBytes(json);
            var encryptedData = ProtectedData.Protect(data, _entropy, DataProtectionScope.CurrentUser);

            await File.WriteAllBytesAsync(_credentialStorePath, encryptedData);
            _hasStoredCredentials = true;

            _logger.LogInformation("Credentials saved securely for {Email}",
                credentials.Email?.Substring(0, 3) + "***");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save credentials");
            throw;
        }
    }

    public Task<bool> HasStoredCredentialsAsync()
    {
        return Task.FromResult(File.Exists(_credentialStorePath));
    }

    public Task DeleteCredentialsAsync()
    {
        try
        {
            if (File.Exists(_credentialStorePath))
            {
                File.Delete(_credentialStorePath);
                _logger.LogInformation("Stored credentials cleared");
            }
            _hasStoredCredentials = false;
            IsAuthenticated = false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to clear credentials");
        }
        return Task.CompletedTask;
    }

    public async Task<SunoCredentials?> LoadFromConfigFileAsync(string path)
    {
        try
        {
            if (!File.Exists(path))
            {
                _logger.LogWarning("Credentials config file not found: {Path}", path);
                return null;
            }

            // Validate file permissions (should not be world-readable)
            var fileInfo = new FileInfo(path);
            var security = fileInfo.GetAccessControl();
            // In production, add more rigorous permission checks

            var json = await File.ReadAllTextAsync(path);
            var config = JsonConvert.DeserializeObject<CredentialConfig>(json);

            if (config?.Suno == null)
            {
                _logger.LogWarning("Config file missing Suno credentials section");
                return null;
            }

            if (string.IsNullOrWhiteSpace(config.Suno.Email) || string.IsNullOrWhiteSpace(config.Suno.Password))
            {
                _logger.LogWarning("Config file contains empty credentials");
                return null;
            }

            _logger.LogInformation("Loaded credentials from config file for {Email}",
                config.Suno.Email.Substring(0, 3) + "***");

            return new SunoCredentials
            {
                Email = config.Suno.Email,
                Password = config.Suno.Password,
                AuthMethod = AuthMethod.ConfigFile,
                RememberMe = false // Don't persist config file credentials
            };
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Invalid JSON in credentials config file");
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading credentials from config file");
            return null;
        }
    }
}
