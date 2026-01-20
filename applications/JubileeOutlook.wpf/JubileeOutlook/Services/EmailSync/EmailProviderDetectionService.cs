using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using JubileeOutlook.Models.EmailSync;

namespace JubileeOutlook.Services.EmailSync;

/// <summary>
/// Service to detect email provider from email address and discover server settings
/// </summary>
public class EmailProviderDetectionService
{
    private static readonly Dictionary<string, EmailProviderType> DomainToProvider = new(StringComparer.OrdinalIgnoreCase)
    {
        // Google
        { "gmail.com", EmailProviderType.Google },
        { "googlemail.com", EmailProviderType.Google },

        // Microsoft
        { "outlook.com", EmailProviderType.Microsoft },
        { "hotmail.com", EmailProviderType.Microsoft },
        { "live.com", EmailProviderType.Microsoft },
        { "msn.com", EmailProviderType.Microsoft },
        { "outlook.co.uk", EmailProviderType.Microsoft },
        { "hotmail.co.uk", EmailProviderType.Microsoft },
        { "live.co.uk", EmailProviderType.Microsoft },

        // Yahoo
        { "yahoo.com", EmailProviderType.Yahoo },
        { "yahoo.co.uk", EmailProviderType.Yahoo },
        { "yahoo.co.in", EmailProviderType.Yahoo },
        { "ymail.com", EmailProviderType.Yahoo },
        { "rocketmail.com", EmailProviderType.Yahoo },

        // Apple
        { "icloud.com", EmailProviderType.Apple },
        { "me.com", EmailProviderType.Apple },
        { "mac.com", EmailProviderType.Apple }
    };

    /// <summary>
    /// Detects the email provider from an email address
    /// </summary>
    public async Task<EmailProviderDetectionResult> DetectProviderAsync(string emailAddress)
    {
        if (string.IsNullOrWhiteSpace(emailAddress) || !emailAddress.Contains('@'))
        {
            return new EmailProviderDetectionResult
            {
                Success = false,
                ErrorMessage = "Invalid email address format"
            };
        }

        var domain = emailAddress.Split('@').LastOrDefault()?.ToLower() ?? "";

        // Check known providers first
        if (DomainToProvider.TryGetValue(domain, out var providerType))
        {
            var config = GetProviderConfig(providerType);
            return new EmailProviderDetectionResult
            {
                Success = true,
                ProviderType = providerType,
                ProviderConfig = config,
                DetectionMethod = "Known Domain"
            };
        }

        // Check for Google Workspace (custom domain using Google)
        var mxRecords = await GetMxRecordsAsync(domain);
        if (mxRecords.Any(mx => mx.Contains("google", StringComparison.OrdinalIgnoreCase) ||
                                mx.Contains("googlemail", StringComparison.OrdinalIgnoreCase)))
        {
            return new EmailProviderDetectionResult
            {
                Success = true,
                ProviderType = EmailProviderType.Google,
                ProviderConfig = EmailProviders.Google,
                DetectionMethod = "MX Record (Google Workspace)"
            };
        }

        // Check for Microsoft 365 (custom domain)
        if (mxRecords.Any(mx => mx.Contains("outlook", StringComparison.OrdinalIgnoreCase) ||
                                mx.Contains("microsoft", StringComparison.OrdinalIgnoreCase) ||
                                mx.Contains("protection.outlook", StringComparison.OrdinalIgnoreCase)))
        {
            return new EmailProviderDetectionResult
            {
                Success = true,
                ProviderType = EmailProviderType.Microsoft,
                ProviderConfig = EmailProviders.Microsoft,
                DetectionMethod = "MX Record (Microsoft 365)"
            };
        }

        // Try to auto-discover IMAP settings
        var autoDiscovered = await TryAutoDiscoverAsync(domain);
        if (autoDiscovered != null)
        {
            return new EmailProviderDetectionResult
            {
                Success = true,
                ProviderType = EmailProviderType.GenericIMAP,
                ProviderConfig = autoDiscovered,
                DetectionMethod = "Auto-Discovery"
            };
        }

        // Fall back to generic IMAP with common patterns
        var genericConfig = await TryCommonImapPatternsAsync(domain);
        if (genericConfig != null)
        {
            return new EmailProviderDetectionResult
            {
                Success = true,
                ProviderType = EmailProviderType.GenericIMAP,
                ProviderConfig = genericConfig,
                DetectionMethod = "Common Pattern"
            };
        }

        // Return unknown - user will need to provide settings manually
        return new EmailProviderDetectionResult
        {
            Success = false,
            ProviderType = EmailProviderType.Unknown,
            ErrorMessage = "Could not auto-detect email provider. Please enter server settings manually.",
            DetectionMethod = "Failed"
        };
    }

    /// <summary>
    /// Gets the provider configuration for a known provider type
    /// </summary>
    public EmailProviderConfig GetProviderConfig(EmailProviderType providerType)
    {
        return providerType switch
        {
            EmailProviderType.Google => EmailProviders.Google,
            EmailProviderType.Microsoft => EmailProviders.Microsoft,
            EmailProviderType.Yahoo => EmailProviders.Yahoo,
            EmailProviderType.Apple => EmailProviders.Apple,
            _ => throw new ArgumentException($"No configuration available for provider type: {providerType}")
        };
    }

    /// <summary>
    /// Gets MX records for a domain
    /// </summary>
    private async Task<List<string>> GetMxRecordsAsync(string domain)
    {
        var mxRecords = new List<string>();

        try
        {
            // Use DNS lookup via nslookup or built-in resolver
            var result = await Task.Run(() =>
            {
                try
                {
                    // Try to resolve MX records using DNS
                    var hostEntry = Dns.GetHostEntry(domain);
                    // Note: This doesn't actually get MX records, just validates domain
                    // For production, use a proper DNS library like DnsClient.NET
                    return new List<string>();
                }
                catch
                {
                    return new List<string>();
                }
            });

            // For now, we'll use a simplified approach based on common patterns
            // In production, use DnsClient.NET for proper MX lookups
            var commonMxPatterns = new[]
            {
                $"mail.{domain}",
                $"mx.{domain}",
                $"smtp.{domain}"
            };

            foreach (var pattern in commonMxPatterns)
            {
                try
                {
                    var addresses = await Dns.GetHostAddressesAsync(pattern);
                    if (addresses.Any())
                    {
                        mxRecords.Add(pattern);
                    }
                }
                catch
                {
                    // Host not found - continue
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ProviderDetection] MX lookup failed for {domain}: {ex.Message}");
        }

        return mxRecords;
    }

    /// <summary>
    /// Attempts to auto-discover IMAP settings using common autoconfig methods
    /// </summary>
    private async Task<EmailProviderConfig?> TryAutoDiscoverAsync(string domain)
    {
        // Try Mozilla ISPDB first
        var ispdbConfig = await TryMozillaIspdbAsync(domain);
        if (ispdbConfig != null)
            return ispdbConfig;

        // Try Microsoft Autodiscover
        var autodiscoverConfig = await TryMicrosoftAutodiscoverAsync(domain);
        if (autodiscoverConfig != null)
            return autodiscoverConfig;

        return null;
    }

    /// <summary>
    /// Tries Mozilla ISPDB for server configuration
    /// </summary>
    private async Task<EmailProviderConfig?> TryMozillaIspdbAsync(string domain)
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
            var url = $"https://autoconfig.{domain}/mail/config-v1.1.xml";

            var response = await client.GetAsync(url);
            if (response.IsSuccessStatusCode)
            {
                var xml = await response.Content.ReadAsStringAsync();
                return ParseAutoconfigXml(xml);
            }

            // Try ISPDB
            url = $"https://autoconfig.thunderbird.net/v1.1/{domain}";
            response = await client.GetAsync(url);
            if (response.IsSuccessStatusCode)
            {
                var xml = await response.Content.ReadAsStringAsync();
                return ParseAutoconfigXml(xml);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ProviderDetection] Mozilla ISPDB failed for {domain}: {ex.Message}");
        }

        return null;
    }

    /// <summary>
    /// Parses Mozilla autoconfig XML
    /// </summary>
    private EmailProviderConfig? ParseAutoconfigXml(string xml)
    {
        try
        {
            var doc = System.Xml.Linq.XDocument.Parse(xml);
            var incomingServer = doc.Descendants("incomingServer")
                .FirstOrDefault(s => s.Attribute("type")?.Value == "imap");
            var outgoingServer = doc.Descendants("outgoingServer")
                .FirstOrDefault(s => s.Attribute("type")?.Value == "smtp");

            if (incomingServer == null || outgoingServer == null)
                return null;

            var imapHost = incomingServer.Element("hostname")?.Value ?? "";
            var imapPort = int.TryParse(incomingServer.Element("port")?.Value, out var ip) ? ip : 993;
            var smtpHost = outgoingServer.Element("hostname")?.Value ?? "";
            var smtpPort = int.TryParse(outgoingServer.Element("port")?.Value, out var sp) ? sp : 587;

            return EmailProviders.CreateGenericIMAP(imapHost, imapPort, smtpHost, smtpPort);
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// Tries Microsoft Autodiscover
    /// </summary>
    private async Task<EmailProviderConfig?> TryMicrosoftAutodiscoverAsync(string domain)
    {
        // Microsoft Autodiscover is complex - simplified version here
        // In production, implement full Autodiscover protocol
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
            var url = $"https://autodiscover.{domain}/autodiscover/autodiscover.xml";

            var response = await client.GetAsync(url);
            if (response.IsSuccessStatusCode)
            {
                // Found Microsoft Autodiscover - assume Office 365
                return EmailProviders.Microsoft;
            }
        }
        catch
        {
            // Not a Microsoft domain
        }

        return null;
    }

    /// <summary>
    /// Tries common IMAP server patterns
    /// </summary>
    private async Task<EmailProviderConfig?> TryCommonImapPatternsAsync(string domain)
    {
        var commonPatterns = new[]
        {
            ($"imap.{domain}", 993, $"smtp.{domain}", 587),
            ($"mail.{domain}", 993, $"mail.{domain}", 587),
            ($"imap.{domain}", 993, $"mail.{domain}", 587),
            (domain, 993, domain, 587)
        };

        foreach (var (imapHost, imapPort, smtpHost, smtpPort) in commonPatterns)
        {
            if (await TestImapConnectionAsync(imapHost, imapPort))
            {
                return EmailProviders.CreateGenericIMAP(imapHost, imapPort, smtpHost, smtpPort);
            }
        }

        return null;
    }

    /// <summary>
    /// Tests if an IMAP server is reachable
    /// </summary>
    private async Task<bool> TestImapConnectionAsync(string host, int port)
    {
        try
        {
            using var client = new TcpClient();
            var connectTask = client.ConnectAsync(host, port);
            var completed = await Task.WhenAny(connectTask, Task.Delay(3000));

            if (completed == connectTask && client.Connected)
            {
                return true;
            }
        }
        catch
        {
            // Connection failed
        }

        return false;
    }
}

/// <summary>
/// Result of email provider detection
/// </summary>
public class EmailProviderDetectionResult
{
    public bool Success { get; set; }
    public EmailProviderType ProviderType { get; set; }
    public EmailProviderConfig? ProviderConfig { get; set; }
    public string? ErrorMessage { get; set; }
    public string DetectionMethod { get; set; } = string.Empty;
}
