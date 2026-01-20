using System.Diagnostics;
using MailKit.Net.Imap;
using MailKit.Net.Smtp;
using MailKit.Security;
using JubileeOutlook.Models.EmailSync;

namespace JubileeOutlook.Services.EmailSync;

/// <summary>
/// Password-based authentication service for IMAP/SMTP with app password support
/// </summary>
public class PasswordAuthenticationService
{
    private readonly SecureStorageService _secureStorage;

    public PasswordAuthenticationService(SecureStorageService secureStorage)
    {
        _secureStorage = secureStorage;
    }

    /// <summary>
    /// Authenticate with IMAP server using username and password
    /// </summary>
    public async Task<PasswordAuthResult> AuthenticateAsync(
        string emailAddress,
        string password,
        EmailProviderConfig providerConfig)
    {
        Debug.WriteLine($"[PasswordAuth] Attempting authentication for {emailAddress} to {providerConfig.ImapHost}");

        // Validate IMAP connection
        var imapResult = await TestImapConnectionAsync(
            providerConfig.ImapHost,
            providerConfig.ImapPort,
            providerConfig.ImapUseSsl,
            emailAddress,
            password);

        if (!imapResult.Success)
        {
            return new PasswordAuthResult
            {
                Success = false,
                ErrorMessage = imapResult.ErrorMessage
            };
        }

        // Validate SMTP connection
        var smtpResult = await TestSmtpConnectionAsync(
            providerConfig.SmtpHost,
            providerConfig.SmtpPort,
            providerConfig.SmtpUseSsl,
            emailAddress,
            password);

        if (!smtpResult.Success)
        {
            return new PasswordAuthResult
            {
                Success = false,
                ErrorMessage = $"SMTP validation failed: {smtpResult.ErrorMessage}"
            };
        }

        // Create and store credentials
        var credentials = new EmailAccountCredentials
        {
            AccountId = Guid.NewGuid(),
            EncryptedPassword = _secureStorage.EncryptPassword(password),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _secureStorage.StoreAsync($"credentials_{credentials.AccountId}", credentials);

        Debug.WriteLine($"[PasswordAuth] Authentication successful for {emailAddress}");

        return new PasswordAuthResult
        {
            Success = true,
            Credentials = credentials,
            UserEmail = emailAddress,
            ServerCapabilities = imapResult.Capabilities
        };
    }

    /// <summary>
    /// Test IMAP connection with provided credentials
    /// </summary>
    public async Task<ConnectionTestResult> TestImapConnectionAsync(
        string host,
        int port,
        bool useSsl,
        string username,
        string password)
    {
        try
        {
            using var client = new ImapClient();
            client.Timeout = 30000; // 30 seconds

            Debug.WriteLine($"[PasswordAuth] Testing IMAP connection to {host}:{port}");

            // Determine SSL mode
            var sslMode = useSsl
                ? SecureSocketOptions.SslOnConnect
                : (port == 993 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls);

            await client.ConnectAsync(host, port, sslMode);
            Debug.WriteLine($"[PasswordAuth] Connected to IMAP server");

            await client.AuthenticateAsync(username, password);
            Debug.WriteLine($"[PasswordAuth] IMAP authentication successful");

            // Get server capabilities
            var capabilities = client.Capabilities.ToString();

            await client.DisconnectAsync(true);

            return new ConnectionTestResult
            {
                Success = true,
                Capabilities = capabilities
            };
        }
        catch (AuthenticationException ex)
        {
            Debug.WriteLine($"[PasswordAuth] IMAP auth failed: {ex.Message}");
            return new ConnectionTestResult
            {
                Success = false,
                ErrorMessage = GetFriendlyAuthError(ex.Message)
            };
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[PasswordAuth] IMAP connection failed: {ex.Message}");
            return new ConnectionTestResult
            {
                Success = false,
                ErrorMessage = GetFriendlyConnectionError(ex)
            };
        }
    }

    /// <summary>
    /// Test SMTP connection with provided credentials
    /// </summary>
    public async Task<ConnectionTestResult> TestSmtpConnectionAsync(
        string host,
        int port,
        bool useSsl,
        string username,
        string password)
    {
        try
        {
            using var client = new SmtpClient();
            client.Timeout = 30000; // 30 seconds

            Debug.WriteLine($"[PasswordAuth] Testing SMTP connection to {host}:{port}");

            // Determine SSL mode
            var sslMode = port == 465
                ? SecureSocketOptions.SslOnConnect
                : SecureSocketOptions.StartTls;

            await client.ConnectAsync(host, port, sslMode);
            Debug.WriteLine($"[PasswordAuth] Connected to SMTP server");

            await client.AuthenticateAsync(username, password);
            Debug.WriteLine($"[PasswordAuth] SMTP authentication successful");

            var capabilities = string.Join(", ", client.Capabilities);

            await client.DisconnectAsync(true);

            return new ConnectionTestResult
            {
                Success = true,
                Capabilities = capabilities
            };
        }
        catch (AuthenticationException ex)
        {
            Debug.WriteLine($"[PasswordAuth] SMTP auth failed: {ex.Message}");
            return new ConnectionTestResult
            {
                Success = false,
                ErrorMessage = GetFriendlyAuthError(ex.Message)
            };
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[PasswordAuth] SMTP connection failed: {ex.Message}");
            return new ConnectionTestResult
            {
                Success = false,
                ErrorMessage = GetFriendlyConnectionError(ex)
            };
        }
    }

    /// <summary>
    /// Verify stored credentials are still valid
    /// </summary>
    public async Task<bool> VerifyCredentialsAsync(Guid accountId, EmailProviderConfig providerConfig)
    {
        var credentials = await _secureStorage.RetrieveAsync<EmailAccountCredentials>($"credentials_{accountId}");
        if (credentials?.EncryptedPassword == null)
        {
            return false;
        }

        var password = _secureStorage.DecryptPassword(credentials.EncryptedPassword);
        if (string.IsNullOrEmpty(password))
        {
            return false;
        }

        // Get email address from stored account info
        var account = await _secureStorage.RetrieveAsync<SyncedEmailAccount>($"account_{accountId}");
        if (account == null)
        {
            return false;
        }

        var result = await TestImapConnectionAsync(
            providerConfig.ImapHost,
            providerConfig.ImapPort,
            providerConfig.ImapUseSsl,
            account.EmailAddress,
            password);

        return result.Success;
    }

    /// <summary>
    /// Get decrypted password for an account
    /// </summary>
    public async Task<string?> GetPasswordAsync(Guid accountId)
    {
        var credentials = await _secureStorage.RetrieveAsync<EmailAccountCredentials>($"credentials_{accountId}");
        if (credentials?.EncryptedPassword == null)
        {
            return null;
        }

        return _secureStorage.DecryptPassword(credentials.EncryptedPassword);
    }

    /// <summary>
    /// Update password for an existing account
    /// </summary>
    public async Task<bool> UpdatePasswordAsync(Guid accountId, string newPassword)
    {
        var credentials = await _secureStorage.RetrieveAsync<EmailAccountCredentials>($"credentials_{accountId}");
        if (credentials == null)
        {
            return false;
        }

        credentials.EncryptedPassword = _secureStorage.EncryptPassword(newPassword);
        credentials.UpdatedAt = DateTime.UtcNow;

        await _secureStorage.StoreAsync($"credentials_{accountId}", credentials);
        return true;
    }

    /// <summary>
    /// Convert technical error messages to user-friendly messages
    /// </summary>
    private string GetFriendlyAuthError(string technicalMessage)
    {
        var lower = technicalMessage.ToLower();

        if (lower.Contains("invalid credentials") || lower.Contains("authentication failed"))
        {
            return "Invalid email or password. Please check your credentials and try again.";
        }

        if (lower.Contains("application-specific password required") ||
            lower.Contains("less secure apps"))
        {
            return "This account requires an App Password. Please generate one from your email provider's security settings.";
        }

        if (lower.Contains("account is locked") || lower.Contains("temporarily blocked"))
        {
            return "Your account has been temporarily blocked due to too many failed login attempts. Please try again later.";
        }

        if (lower.Contains("two-factor") || lower.Contains("2fa") || lower.Contains("mfa"))
        {
            return "This account has two-factor authentication enabled. Please use an App Password instead.";
        }

        return $"Authentication failed: {technicalMessage}";
    }

    /// <summary>
    /// Convert connection errors to user-friendly messages
    /// </summary>
    private string GetFriendlyConnectionError(Exception ex)
    {
        var message = ex.Message.ToLower();

        if (ex is System.Net.Sockets.SocketException)
        {
            return "Could not connect to the mail server. Please check your internet connection and server settings.";
        }

        if (message.Contains("timeout") || message.Contains("timed out"))
        {
            return "Connection timed out. The server may be busy or unreachable.";
        }

        if (message.Contains("ssl") || message.Contains("tls") || message.Contains("certificate"))
        {
            return "Secure connection failed. There may be a security issue with the mail server.";
        }

        if (message.Contains("refused") || message.Contains("unreachable"))
        {
            return "Connection refused. Please verify the server address and port settings.";
        }

        return $"Connection error: {ex.Message}";
    }
}

/// <summary>
/// Result of password-based authentication
/// </summary>
public class PasswordAuthResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public string? UserEmail { get; set; }
    public EmailAccountCredentials? Credentials { get; set; }
    public string? ServerCapabilities { get; set; }
}

/// <summary>
/// Result of connection test
/// </summary>
public class ConnectionTestResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public string? Capabilities { get; set; }
}
