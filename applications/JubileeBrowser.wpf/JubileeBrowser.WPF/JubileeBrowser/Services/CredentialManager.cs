using System.IO;
using System.Text.Json;
using JubileeBrowser.Models;

namespace JubileeBrowser.Services;

/// <summary>
/// Manages saved passwords and autofill data with secure storage
/// </summary>
public class CredentialManager
{
    private readonly SecureStorageService _secureStorage;
    private readonly SyncEngine? _syncEngine;
    private readonly string _dataPath;

    private List<SavedCredential> _credentials = new();
    private List<AutofillEntry> _autofillEntries = new();
    private bool _isInitialized;

    public event EventHandler<SavedCredential>? CredentialAdded;
    public event EventHandler<SavedCredential>? CredentialUpdated;
    public event EventHandler<string>? CredentialRemoved;
    public event EventHandler<AutofillEntry>? AutofillAdded;
    public event EventHandler<AutofillEntry>? AutofillUpdated;
    public event EventHandler<string>? AutofillRemoved;

    public CredentialManager(SyncEngine? syncEngine = null)
    {
        _secureStorage = new SecureStorageService();
        _syncEngine = syncEngine;

        _dataPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "JubileeBrowser",
            "Credentials"
        );
        Directory.CreateDirectory(_dataPath);
    }

    /// <summary>
    /// Initialize and load stored data
    /// </summary>
    public async Task InitializeAsync()
    {
        if (_isInitialized) return;

        await LoadCredentialsAsync();
        await LoadAutofillEntriesAsync();
        _isInitialized = true;
    }

    #region Password Management

    /// <summary>
    /// Get all saved credentials (passwords are encrypted)
    /// </summary>
    public IReadOnlyList<SavedCredential> GetCredentials() => _credentials.AsReadOnly();

    /// <summary>
    /// Get credentials for a specific website
    /// </summary>
    public IEnumerable<SavedCredential> GetCredentialsForWebsite(string website)
    {
        var domain = ExtractDomain(website);
        return _credentials.Where(c => ExtractDomain(c.Website) == domain);
    }

    /// <summary>
    /// Save a new credential
    /// </summary>
    public async Task<SavedCredential> SaveCredentialAsync(string website, string username, string password, string? notes = null)
    {
        var credential = new SavedCredential
        {
            Website = website,
            Username = username,
            EncryptedPassword = _secureStorage.EncryptPassword(password),
            Notes = notes,
            CreatedAt = DateTime.UtcNow,
            ModifiedAt = DateTime.UtcNow
        };

        _credentials.Add(credential);
        await SaveCredentialsAsync();

        _syncEngine?.QueueChange("passwords", credential.Id, new
        {
            credential.Id,
            credential.Website,
            credential.Username,
            credential.EncryptedPassword, // Already encrypted
            credential.Notes,
            credential.CreatedAt
        }, isDeleted: false);

        CredentialAdded?.Invoke(this, credential);
        return credential;
    }

    /// <summary>
    /// Update an existing credential
    /// </summary>
    public async Task UpdateCredentialAsync(string id, string? username = null, string? password = null, string? notes = null)
    {
        var credential = _credentials.FirstOrDefault(c => c.Id == id);
        if (credential == null) return;

        if (username != null) credential.Username = username;
        if (password != null) credential.EncryptedPassword = _secureStorage.EncryptPassword(password);
        if (notes != null) credential.Notes = notes;
        credential.ModifiedAt = DateTime.UtcNow;

        await SaveCredentialsAsync();

        _syncEngine?.QueueChange("passwords", id, new
        {
            credential.Id,
            credential.Website,
            credential.Username,
            credential.EncryptedPassword,
            credential.Notes,
            credential.ModifiedAt
        }, isDeleted: false);

        CredentialUpdated?.Invoke(this, credential);
    }

    /// <summary>
    /// Delete a credential
    /// </summary>
    public async Task DeleteCredentialAsync(string id)
    {
        var credential = _credentials.FirstOrDefault(c => c.Id == id);
        if (credential == null) return;

        _credentials.Remove(credential);
        await SaveCredentialsAsync();

        _syncEngine?.QueueChange("passwords", id, null, isDeleted: true);
        CredentialRemoved?.Invoke(this, id);
    }

    /// <summary>
    /// Get decrypted password for a credential
    /// </summary>
    public string GetDecryptedPassword(string credentialId)
    {
        var credential = _credentials.FirstOrDefault(c => c.Id == credentialId);
        if (credential == null) return string.Empty;

        credential.LastUsedAt = DateTime.UtcNow;
        return _secureStorage.DecryptPassword(credential.EncryptedPassword);
    }

    /// <summary>
    /// Record password usage
    /// </summary>
    public async Task RecordPasswordUsageAsync(string credentialId)
    {
        var credential = _credentials.FirstOrDefault(c => c.Id == credentialId);
        if (credential != null)
        {
            credential.LastUsedAt = DateTime.UtcNow;
            await SaveCredentialsAsync();
        }
    }

    private async Task LoadCredentialsAsync()
    {
        try
        {
            var filePath = Path.Combine(_dataPath, "credentials.enc");
            if (File.Exists(filePath))
            {
                var encrypted = await File.ReadAllTextAsync(filePath);
                var json = _secureStorage.Decrypt(encrypted);
                _credentials = JsonSerializer.Deserialize<List<SavedCredential>>(json) ?? new();
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error loading credentials: {ex.Message}");
            _credentials = new();
        }
    }

    private async Task SaveCredentialsAsync()
    {
        var json = JsonSerializer.Serialize(_credentials);
        var encrypted = _secureStorage.Encrypt(json);
        var filePath = Path.Combine(_dataPath, "credentials.enc");
        await File.WriteAllTextAsync(filePath, encrypted);
    }

    #endregion

    #region Autofill Management

    /// <summary>
    /// Get all autofill entries
    /// </summary>
    public IReadOnlyList<AutofillEntry> GetAutofillEntries() => _autofillEntries.AsReadOnly();

    /// <summary>
    /// Get autofill entries by type
    /// </summary>
    public IEnumerable<AutofillEntry> GetAutofillEntriesByType(AutofillEntryType type)
    {
        return _autofillEntries.Where(e => e.Type == type);
    }

    /// <summary>
    /// Save a new autofill entry
    /// </summary>
    public async Task<AutofillEntry> SaveAutofillEntryAsync(AutofillEntry entry)
    {
        entry.CreatedAt = DateTime.UtcNow;
        entry.ModifiedAt = DateTime.UtcNow;

        _autofillEntries.Add(entry);
        await SaveAutofillEntriesAsync();

        _syncEngine?.QueueChange("autofill", entry.Id, entry, isDeleted: false);
        AutofillAdded?.Invoke(this, entry);
        return entry;
    }

    /// <summary>
    /// Update an autofill entry
    /// </summary>
    public async Task UpdateAutofillEntryAsync(AutofillEntry entry)
    {
        var existing = _autofillEntries.FirstOrDefault(e => e.Id == entry.Id);
        if (existing == null) return;

        var index = _autofillEntries.IndexOf(existing);
        entry.ModifiedAt = DateTime.UtcNow;
        _autofillEntries[index] = entry;

        await SaveAutofillEntriesAsync();

        _syncEngine?.QueueChange("autofill", entry.Id, entry, isDeleted: false);
        AutofillUpdated?.Invoke(this, entry);
    }

    /// <summary>
    /// Delete an autofill entry
    /// </summary>
    public async Task DeleteAutofillEntryAsync(string id)
    {
        var entry = _autofillEntries.FirstOrDefault(e => e.Id == id);
        if (entry == null) return;

        _autofillEntries.Remove(entry);
        await SaveAutofillEntriesAsync();

        _syncEngine?.QueueChange("autofill", id, null, isDeleted: true);
        AutofillRemoved?.Invoke(this, id);
    }

    /// <summary>
    /// Get autofill suggestions for form fields
    /// </summary>
    public AutofillSuggestion? GetAutofillSuggestion(string fieldType)
    {
        // Get the most recently used entry that has the requested field
        var entry = _autofillEntries
            .OrderByDescending(e => e.ModifiedAt)
            .FirstOrDefault();

        if (entry == null) return null;

        return fieldType.ToLower() switch
        {
            "name" or "fullname" => new AutofillSuggestion { Value = entry.FullName, Label = "Name" },
            "email" => new AutofillSuggestion { Value = entry.Email, Label = "Email" },
            "phone" or "tel" => new AutofillSuggestion { Value = entry.Phone, Label = "Phone" },
            "address" or "street" => new AutofillSuggestion { Value = entry.Address, Label = "Address" },
            "city" => new AutofillSuggestion { Value = entry.City, Label = "City" },
            "state" or "region" => new AutofillSuggestion { Value = entry.State, Label = "State" },
            "zip" or "postal" => new AutofillSuggestion { Value = entry.ZipCode, Label = "ZIP" },
            "country" => new AutofillSuggestion { Value = entry.Country, Label = "Country" },
            _ => null
        };
    }

    private async Task LoadAutofillEntriesAsync()
    {
        try
        {
            var filePath = Path.Combine(_dataPath, "autofill.json");
            if (File.Exists(filePath))
            {
                var json = await File.ReadAllTextAsync(filePath);
                _autofillEntries = JsonSerializer.Deserialize<List<AutofillEntry>>(json) ?? new();
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error loading autofill: {ex.Message}");
            _autofillEntries = new();
        }
    }

    private async Task SaveAutofillEntriesAsync()
    {
        var json = JsonSerializer.Serialize(_autofillEntries, new JsonSerializerOptions { WriteIndented = true });
        var filePath = Path.Combine(_dataPath, "autofill.json");
        await File.WriteAllTextAsync(filePath, json);
    }

    #endregion

    #region Import/Export

    /// <summary>
    /// Export credentials (encrypted) for backup
    /// </summary>
    public async Task<string> ExportCredentialsAsync()
    {
        var export = new
        {
            Version = 1,
            ExportedAt = DateTime.UtcNow,
            Credentials = _credentials.Select(c => new
            {
                c.Website,
                c.Username,
                c.EncryptedPassword, // Keep encrypted
                c.Notes
            })
        };
        return JsonSerializer.Serialize(export, new JsonSerializerOptions { WriteIndented = true });
    }

    /// <summary>
    /// Import credentials from a browser export (CSV format)
    /// </summary>
    public async Task<int> ImportFromCsvAsync(string csvContent)
    {
        var lines = csvContent.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        if (lines.Length < 2) return 0;

        int imported = 0;
        // Skip header row
        for (int i = 1; i < lines.Length; i++)
        {
            var parts = lines[i].Split(',');
            if (parts.Length >= 3)
            {
                var website = parts[0].Trim().Trim('"');
                var username = parts[1].Trim().Trim('"');
                var password = parts[2].Trim().Trim('"');

                if (!string.IsNullOrEmpty(website) && !string.IsNullOrEmpty(username))
                {
                    await SaveCredentialAsync(website, username, password);
                    imported++;
                }
            }
        }
        return imported;
    }

    #endregion

    private static string ExtractDomain(string url)
    {
        try
        {
            if (!url.Contains("://"))
                url = "https://" + url;
            return new Uri(url).Host.ToLower();
        }
        catch
        {
            return url.ToLower();
        }
    }
}

public class AutofillSuggestion
{
    public string? Value { get; set; }
    public string? Label { get; set; }
}
