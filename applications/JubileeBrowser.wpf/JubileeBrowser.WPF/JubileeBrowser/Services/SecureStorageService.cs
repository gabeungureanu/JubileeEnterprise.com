using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace JubileeBrowser.Services;

/// <summary>
/// Provides secure storage using Windows DPAPI for sensitive data like tokens and passwords
/// </summary>
public class SecureStorageService
{
    private readonly string _storagePath;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = false,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public SecureStorageService()
    {
        _storagePath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "JubileeBrowser",
            "SecureStorage"
        );
        Directory.CreateDirectory(_storagePath);
    }

    /// <summary>
    /// Encrypts a string using DPAPI (Windows Data Protection API)
    /// </summary>
    public string Encrypt(string plainText)
    {
        if (string.IsNullOrEmpty(plainText))
            return string.Empty;

        var plainBytes = Encoding.UTF8.GetBytes(plainText);
        var encryptedBytes = ProtectedData.Protect(plainBytes, null, DataProtectionScope.CurrentUser);
        return Convert.ToBase64String(encryptedBytes);
    }

    /// <summary>
    /// Decrypts a DPAPI-encrypted string
    /// </summary>
    public string Decrypt(string encryptedText)
    {
        if (string.IsNullOrEmpty(encryptedText))
            return string.Empty;

        try
        {
            var encryptedBytes = Convert.FromBase64String(encryptedText);
            var decryptedBytes = ProtectedData.Unprotect(encryptedBytes, null, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(decryptedBytes);
        }
        catch (CryptographicException)
        {
            return string.Empty;
        }
    }

    /// <summary>
    /// Encrypts and stores an object as JSON
    /// </summary>
    public async Task StoreAsync<T>(string key, T value)
    {
        var json = JsonSerializer.Serialize(value, JsonOptions);
        var encrypted = Encrypt(json);
        var filePath = GetFilePath(key);
        await File.WriteAllTextAsync(filePath, encrypted);
    }

    /// <summary>
    /// Retrieves and decrypts a stored object
    /// </summary>
    public async Task<T?> RetrieveAsync<T>(string key)
    {
        var filePath = GetFilePath(key);
        if (!File.Exists(filePath))
            return default;

        try
        {
            var encrypted = await File.ReadAllTextAsync(filePath);
            var json = Decrypt(encrypted);
            if (string.IsNullOrEmpty(json))
                return default;

            return JsonSerializer.Deserialize<T>(json, JsonOptions);
        }
        catch
        {
            return default;
        }
    }

    /// <summary>
    /// Removes a stored value
    /// </summary>
    public void Remove(string key)
    {
        var filePath = GetFilePath(key);
        if (File.Exists(filePath))
            File.Delete(filePath);
    }

    /// <summary>
    /// Checks if a key exists
    /// </summary>
    public bool Exists(string key)
    {
        return File.Exists(GetFilePath(key));
    }

    /// <summary>
    /// Clears all secure storage
    /// </summary>
    public void ClearAll()
    {
        if (Directory.Exists(_storagePath))
        {
            foreach (var file in Directory.GetFiles(_storagePath, "*.enc"))
            {
                try { File.Delete(file); } catch { }
            }
        }
    }

    private string GetFilePath(string key)
    {
        // Sanitize key for file name
        var safeName = Convert.ToBase64String(Encoding.UTF8.GetBytes(key))
            .Replace("/", "_")
            .Replace("+", "-");
        return Path.Combine(_storagePath, $"{safeName}.enc");
    }

    /// <summary>
    /// Encrypts a password for storage
    /// </summary>
    public string EncryptPassword(string password)
    {
        return Encrypt(password);
    }

    /// <summary>
    /// Decrypts a stored password
    /// </summary>
    public string DecryptPassword(string encryptedPassword)
    {
        return Decrypt(encryptedPassword);
    }

    /// <summary>
    /// Creates a hash for passphrase verification
    /// </summary>
    public string HashPassphrase(string passphrase)
    {
        using var sha256 = SHA256.Create();
        var bytes = Encoding.UTF8.GetBytes(passphrase);
        var hash = sha256.ComputeHash(bytes);
        return Convert.ToBase64String(hash);
    }

    /// <summary>
    /// Verifies a passphrase against its hash
    /// </summary>
    public bool VerifyPassphrase(string passphrase, string hash)
    {
        return HashPassphrase(passphrase) == hash;
    }
}
