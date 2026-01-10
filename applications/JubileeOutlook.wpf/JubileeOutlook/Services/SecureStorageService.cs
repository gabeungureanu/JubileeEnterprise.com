using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace JubileeOutlook.Services;

/// <summary>
/// Secure storage service using Windows DPAPI for encryption
/// </summary>
public class SecureStorageService
{
    private readonly string _storagePath;

    public SecureStorageService()
    {
        _storagePath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "JubileeOutlook",
            "SecureStorage"
        );
        Directory.CreateDirectory(_storagePath);
    }

    /// <summary>
    /// Encrypt data using DPAPI
    /// </summary>
    public byte[] Encrypt(byte[] data)
    {
        return ProtectedData.Protect(data, null, DataProtectionScope.CurrentUser);
    }

    /// <summary>
    /// Decrypt data using DPAPI
    /// </summary>
    public byte[] Decrypt(byte[] encryptedData)
    {
        return ProtectedData.Unprotect(encryptedData, null, DataProtectionScope.CurrentUser);
    }

    /// <summary>
    /// Encrypt a password string
    /// </summary>
    public string EncryptPassword(string password)
    {
        var data = Encoding.UTF8.GetBytes(password);
        var encrypted = Encrypt(data);
        return Convert.ToBase64String(encrypted);
    }

    /// <summary>
    /// Decrypt a password string
    /// </summary>
    public string DecryptPassword(string encryptedPassword)
    {
        try
        {
            var encrypted = Convert.FromBase64String(encryptedPassword);
            var decrypted = Decrypt(encrypted);
            return Encoding.UTF8.GetString(decrypted);
        }
        catch
        {
            return string.Empty;
        }
    }

    /// <summary>
    /// Store an object securely
    /// </summary>
    public async Task StoreAsync<T>(string key, T value)
    {
        try
        {
            var json = JsonSerializer.Serialize(value);
            var data = Encoding.UTF8.GetBytes(json);
            var encrypted = Encrypt(data);
            var filePath = GetFilePath(key);
            await File.WriteAllBytesAsync(filePath, encrypted);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error storing {key}: {ex.Message}");
        }
    }

    /// <summary>
    /// Retrieve an object from secure storage
    /// </summary>
    public async Task<T?> RetrieveAsync<T>(string key)
    {
        try
        {
            var filePath = GetFilePath(key);
            if (!File.Exists(filePath))
                return default;

            var encrypted = await File.ReadAllBytesAsync(filePath);
            var decrypted = Decrypt(encrypted);
            var json = Encoding.UTF8.GetString(decrypted);
            return JsonSerializer.Deserialize<T>(json);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error retrieving {key}: {ex.Message}");
            return default;
        }
    }

    /// <summary>
    /// Remove a stored value
    /// </summary>
    public void Remove(string key)
    {
        try
        {
            var filePath = GetFilePath(key);
            if (File.Exists(filePath))
            {
                File.Delete(filePath);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error removing {key}: {ex.Message}");
        }
    }

    /// <summary>
    /// Clear all secure storage
    /// </summary>
    public void ClearAll()
    {
        try
        {
            if (Directory.Exists(_storagePath))
            {
                foreach (var file in Directory.GetFiles(_storagePath))
                {
                    File.Delete(file);
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error clearing storage: {ex.Message}");
        }
    }

    private string GetFilePath(string key)
    {
        // Sanitize key for filename
        var safeKey = string.Join("_", key.Split(Path.GetInvalidFileNameChars()));
        return Path.Combine(_storagePath, $"{safeKey}.dat");
    }
}

/// <summary>
/// Secure token storage using Windows DPAPI
/// </summary>
public class SecureTokenStorage
{
    private readonly string _tokenPath;

    public SecureTokenStorage()
    {
        var appDataPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "JubileeOutlook"
        );
        Directory.CreateDirectory(appDataPath);
        _tokenPath = Path.Combine(appDataPath, "tokens.dat");
    }

    public async Task<Models.TokenSet?> LoadTokensAsync()
    {
        try
        {
            if (!File.Exists(_tokenPath))
                return null;

            var encryptedData = await File.ReadAllBytesAsync(_tokenPath);
            var decryptedData = ProtectedData.Unprotect(
                encryptedData,
                null,
                DataProtectionScope.CurrentUser);

            var json = Encoding.UTF8.GetString(decryptedData);
            return JsonSerializer.Deserialize<Models.TokenSet>(json);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error loading tokens: {ex.Message}");
            return null;
        }
    }

    public async Task SaveTokensAsync(Models.TokenSet tokens)
    {
        try
        {
            var json = JsonSerializer.Serialize(tokens);
            var data = Encoding.UTF8.GetBytes(json);
            var encryptedData = ProtectedData.Protect(
                data,
                null,
                DataProtectionScope.CurrentUser);

            await File.WriteAllBytesAsync(_tokenPath, encryptedData);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error saving tokens: {ex.Message}");
        }
    }

    public Task ClearTokensAsync()
    {
        try
        {
            if (File.Exists(_tokenPath))
            {
                File.Delete(_tokenPath);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error clearing tokens: {ex.Message}");
        }
        return Task.CompletedTask;
    }
}
