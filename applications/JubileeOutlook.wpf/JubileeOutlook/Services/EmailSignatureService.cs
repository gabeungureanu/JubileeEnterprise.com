using System.IO;
using System.Text.Json;

namespace JubileeOutlook.Services;

/// <summary>
/// Represents an email signature
/// </summary>
public class EmailSignature
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public bool IsDefault { get; set; }
    public bool IsHtml { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Service for managing email signatures
/// Stores signatures locally in the user's app data folder
/// </summary>
public class EmailSignatureService
{
    private static EmailSignatureService? _instance;
    private static readonly object _lock = new();

    private readonly string _signaturesFilePath;
    private List<EmailSignature> _signatures = new();
    private bool _isLoaded = false;

    public static EmailSignatureService Instance
    {
        get
        {
            if (_instance == null)
            {
                lock (_lock)
                {
                    _instance ??= new EmailSignatureService();
                }
            }
            return _instance;
        }
    }

    private EmailSignatureService()
    {
        var appDataPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "JubileeOutlook"
        );

        if (!Directory.Exists(appDataPath))
        {
            Directory.CreateDirectory(appDataPath);
        }

        _signaturesFilePath = Path.Combine(appDataPath, "signatures.json");
    }

    /// <summary>
    /// Loads signatures from storage
    /// </summary>
    public async Task LoadAsync()
    {
        if (_isLoaded) return;

        try
        {
            if (File.Exists(_signaturesFilePath))
            {
                var json = await File.ReadAllTextAsync(_signaturesFilePath);
                var signatures = JsonSerializer.Deserialize<List<EmailSignature>>(json);
                if (signatures != null)
                {
                    _signatures = signatures;
                }
            }
            else
            {
                // Create default signature if none exist
                _signatures = new List<EmailSignature>
                {
                    CreateDefaultSignature()
                };
                await SaveAsync();
            }

            _isLoaded = true;
            System.Diagnostics.Debug.WriteLine($"[EmailSignatureService] Loaded {_signatures.Count} signature(s)");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[EmailSignatureService] Error loading signatures: {ex.Message}");
            _signatures = new List<EmailSignature> { CreateDefaultSignature() };
            _isLoaded = true;
        }
    }

    private EmailSignature CreateDefaultSignature()
    {
        return new EmailSignature
        {
            Id = Guid.NewGuid().ToString(),
            Name = "Default",
            Content = @"<p style=""color: #666; font-family: Arial, sans-serif; font-size: 12px;"">
Best regards,<br/>
<b style=""color: #000;"">Your Name</b><br/>
<span style=""color: #888;"">Your Title</span><br/>
<span style=""color: #888;"">Your Company</span>
</p>",
            IsDefault = true,
            IsHtml = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Saves signatures to storage
    /// </summary>
    public async Task SaveAsync()
    {
        try
        {
            var options = new JsonSerializerOptions { WriteIndented = true };
            var json = JsonSerializer.Serialize(_signatures, options);
            await File.WriteAllTextAsync(_signaturesFilePath, json);
            System.Diagnostics.Debug.WriteLine($"[EmailSignatureService] Saved {_signatures.Count} signature(s)");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[EmailSignatureService] Error saving signatures: {ex.Message}");
        }
    }

    /// <summary>
    /// Gets all signatures
    /// </summary>
    public List<EmailSignature> GetSignatures()
    {
        return _signatures.ToList();
    }

    /// <summary>
    /// Gets the default signature
    /// </summary>
    public EmailSignature? GetDefaultSignature()
    {
        return _signatures.FirstOrDefault(s => s.IsDefault) ?? _signatures.FirstOrDefault();
    }

    /// <summary>
    /// Gets a signature by ID
    /// </summary>
    public EmailSignature? GetSignature(string id)
    {
        return _signatures.FirstOrDefault(s => s.Id == id);
    }

    /// <summary>
    /// Adds a new signature
    /// </summary>
    public async Task<EmailSignature> AddSignatureAsync(string name, string content, bool isDefault = false, bool isHtml = true)
    {
        var signature = new EmailSignature
        {
            Id = Guid.NewGuid().ToString(),
            Name = name,
            Content = content,
            IsDefault = isDefault,
            IsHtml = isHtml,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        // If this is the default, unset other defaults
        if (isDefault)
        {
            foreach (var sig in _signatures)
            {
                sig.IsDefault = false;
            }
        }

        _signatures.Add(signature);
        await SaveAsync();

        return signature;
    }

    /// <summary>
    /// Updates an existing signature
    /// </summary>
    public async Task UpdateSignatureAsync(string id, string name, string content, bool isDefault = false, bool isHtml = true)
    {
        var signature = _signatures.FirstOrDefault(s => s.Id == id);
        if (signature == null) return;

        signature.Name = name;
        signature.Content = content;
        signature.IsHtml = isHtml;
        signature.UpdatedAt = DateTime.UtcNow;

        // If this is the default, unset other defaults
        if (isDefault)
        {
            foreach (var sig in _signatures)
            {
                sig.IsDefault = sig.Id == id;
            }
        }
        else
        {
            signature.IsDefault = isDefault;
        }

        await SaveAsync();
    }

    /// <summary>
    /// Deletes a signature
    /// </summary>
    public async Task DeleteSignatureAsync(string id)
    {
        var signature = _signatures.FirstOrDefault(s => s.Id == id);
        if (signature == null) return;

        _signatures.Remove(signature);

        // If we deleted the default, make the first one default
        if (signature.IsDefault && _signatures.Count > 0)
        {
            _signatures[0].IsDefault = true;
        }

        await SaveAsync();
    }

    /// <summary>
    /// Sets a signature as the default
    /// </summary>
    public async Task SetDefaultAsync(string id)
    {
        foreach (var sig in _signatures)
        {
            sig.IsDefault = sig.Id == id;
        }
        await SaveAsync();
    }

    /// <summary>
    /// Formats the signature for insertion into email body
    /// </summary>
    public string FormatSignatureForEmail(EmailSignature signature, bool asHtml = true)
    {
        if (signature == null) return string.Empty;

        if (asHtml)
        {
            // Add separator and signature
            return $@"<br/><br/>
<div class=""email-signature"" style=""margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee;"">
{signature.Content}
</div>";
        }
        else
        {
            // Convert HTML to plain text (basic conversion)
            var plainText = signature.Content
                .Replace("<br/>", "\n")
                .Replace("<br>", "\n")
                .Replace("</p>", "\n")
                .Replace("<p>", "")
                .Replace("<b>", "")
                .Replace("</b>", "")
                .Replace("<span>", "")
                .Replace("</span>", "");

            // Remove remaining HTML tags
            plainText = System.Text.RegularExpressions.Regex.Replace(plainText, "<[^>]*>", "");
            plainText = System.Net.WebUtility.HtmlDecode(plainText);

            return $"\n\n--\n{plainText}";
        }
    }
}
