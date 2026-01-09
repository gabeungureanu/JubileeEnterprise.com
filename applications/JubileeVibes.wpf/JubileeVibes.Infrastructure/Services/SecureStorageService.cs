using System.IO;
using System.Security.Cryptography;
using System.Text;
using JubileeVibes.Core.Interfaces;

namespace JubileeVibes.Infrastructure.Services;

public class SecureStorageService : ISecureStorageService
{
    private readonly string _storagePath;
    private readonly byte[] _entropy;

    public SecureStorageService()
    {
        var appDataPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "JubileeVibes",
            "secure");

        Directory.CreateDirectory(appDataPath);
        _storagePath = appDataPath;

        // Generate or load entropy for additional protection
        var entropyPath = Path.Combine(appDataPath, ".entropy");
        if (File.Exists(entropyPath))
        {
            _entropy = File.ReadAllBytes(entropyPath);
        }
        else
        {
            _entropy = new byte[32];
            using var rng = RandomNumberGenerator.Create();
            rng.GetBytes(_entropy);
            File.WriteAllBytes(entropyPath, _entropy);
            File.SetAttributes(entropyPath, FileAttributes.Hidden);
        }
    }

    public async Task<string?> GetAsync(string key)
    {
        var filePath = GetFilePath(key);
        if (!File.Exists(filePath))
            return null;

        try
        {
            var encryptedData = await File.ReadAllBytesAsync(filePath);
            var decryptedData = ProtectedData.Unprotect(encryptedData, _entropy, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(decryptedData);
        }
        catch
        {
            return null;
        }
    }

    public async Task SetAsync(string key, string value)
    {
        var filePath = GetFilePath(key);
        var data = Encoding.UTF8.GetBytes(value);
        var encryptedData = ProtectedData.Protect(data, _entropy, DataProtectionScope.CurrentUser);
        await File.WriteAllBytesAsync(filePath, encryptedData);
    }

    public Task RemoveAsync(string key)
    {
        var filePath = GetFilePath(key);
        if (File.Exists(filePath))
        {
            File.Delete(filePath);
        }
        return Task.CompletedTask;
    }

    public Task<bool> ContainsKeyAsync(string key)
    {
        var filePath = GetFilePath(key);
        return Task.FromResult(File.Exists(filePath));
    }

    public Task ClearAllAsync()
    {
        var files = Directory.GetFiles(_storagePath, "*.dat");
        foreach (var file in files)
        {
            File.Delete(file);
        }
        return Task.CompletedTask;
    }

    private string GetFilePath(string key)
    {
        // Hash the key to avoid file system issues with special characters
        using var sha = SHA256.Create();
        var hash = sha.ComputeHash(Encoding.UTF8.GetBytes(key));
        var fileName = Convert.ToHexString(hash)[..16] + ".dat";
        return Path.Combine(_storagePath, fileName);
    }
}
