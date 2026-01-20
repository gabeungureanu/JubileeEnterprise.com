using System.Diagnostics;
using System.IO;
using JubileeOutlook.Models.EmailSync;

namespace JubileeOutlook.Services.EmailSync;

/// <summary>
/// Unified email authentication manager that handles OAuth2 and password-based authentication
/// </summary>
public class EmailAuthenticationManager
{
    private readonly OAuth2AuthenticationService _oauth2Service;
    private readonly PasswordAuthenticationService _passwordService;
    private readonly EmailProviderDetectionService _providerDetection;
    private readonly SecureStorageService _secureStorage;

    public EmailAuthenticationManager()
    {
        _secureStorage = new SecureStorageService();
        _oauth2Service = new OAuth2AuthenticationService(_secureStorage);
        _passwordService = new PasswordAuthenticationService(_secureStorage);
        _providerDetection = new EmailProviderDetectionService();
    }

    /// <summary>
    /// Event raised when authentication requires user interaction (password input)
    /// </summary>
    public event EventHandler<PasswordRequiredEventArgs>? PasswordRequired;

    /// <summary>
    /// Event raised during authentication progress
    /// </summary>
    public event EventHandler<AuthenticationProgressEventArgs>? AuthenticationProgress;

    /// <summary>
    /// Authenticate an email account using the best available method
    /// </summary>
    public async Task<EmailAuthenticationResult> AuthenticateAccountAsync(string emailAddress)
    {
        Debug.WriteLine($"[AuthManager] Starting authentication for {emailAddress}");
        RaiseProgress("Detecting email provider...", 10);

        // Step 1: Detect provider
        var detectionResult = await _providerDetection.DetectProviderAsync(emailAddress);
        if (!detectionResult.Success || detectionResult.ProviderConfig == null)
        {
            return new EmailAuthenticationResult
            {
                Success = false,
                ErrorMessage = detectionResult.ErrorMessage ?? "Could not detect email provider"
            };
        }

        var providerConfig = detectionResult.ProviderConfig;
        Debug.WriteLine($"[AuthManager] Provider detected: {providerConfig.ProviderType} ({detectionResult.DetectionMethod})");
        RaiseProgress($"Provider detected: {providerConfig.DisplayName}", 20);

        // Step 2: Determine authentication method
        var authMethod = DetermineAuthMethod(providerConfig);
        Debug.WriteLine($"[AuthManager] Using authentication method: {authMethod}");

        // Step 3: Authenticate based on method
        return authMethod switch
        {
            AuthenticationMethod.OAuth2 => await AuthenticateWithOAuth2Async(emailAddress, providerConfig),
            AuthenticationMethod.AppPassword => await AuthenticateWithAppPasswordAsync(emailAddress, providerConfig),
            AuthenticationMethod.BasicAuth => await AuthenticateWithPasswordAsync(emailAddress, providerConfig),
            _ => new EmailAuthenticationResult
            {
                Success = false,
                ErrorMessage = $"Unsupported authentication method: {authMethod}"
            }
        };
    }

    /// <summary>
    /// Authenticate with OAuth2
    /// </summary>
    private async Task<EmailAuthenticationResult> AuthenticateWithOAuth2Async(
        string emailAddress,
        EmailProviderConfig providerConfig)
    {
        // Check if OAuth is configured for this provider before attempting
        bool oauthConfigured = providerConfig.ProviderType switch
        {
            EmailProviderType.Google => GoogleOAuth2Service.IsConfigured,
            EmailProviderType.Microsoft => MicrosoftOAuth2Service.IsConfigured,
            EmailProviderType.Yahoo => YahooOAuth2Service.IsConfigured,
            _ => false
        };

        if (!oauthConfigured)
        {
            Debug.WriteLine($"[AuthManager] OAuth not configured for {providerConfig.ProviderType}, using App Password");
            RaiseProgress("OAuth not configured, using App Password...", 30);

            // Skip directly to App Password for unconfigured OAuth providers
            return await AuthenticateWithAppPasswordAsync(emailAddress, providerConfig);
        }

        RaiseProgress("Opening browser for authentication...", 30);

        var result = await _oauth2Service.AuthenticateAsync(emailAddress, providerConfig);

        if (result.Success)
        {
            RaiseProgress("Authentication successful!", 100);

            // Create synced account
            var account = CreateSyncedAccount(
                emailAddress,
                providerConfig,
                AuthenticationMethod.OAuth2,
                result.Credentials?.AccountId ?? Guid.NewGuid());

            // Store account info
            await _secureStorage.StoreAsync($"account_{account.Id}", account);

            return new EmailAuthenticationResult
            {
                Success = true,
                Account = account,
                Credentials = result.Credentials,
                ProviderConfig = providerConfig
            };
        }

        // OAuth2 failed - check if it's due to unconfigured credentials or user cancellation
        bool shouldFallback = result.ErrorMessage == "OAUTH_NOT_CONFIGURED" ||
                              providerConfig.FallbackAuthMethod.HasValue;

        if (shouldFallback)
        {
            Debug.WriteLine($"[AuthManager] OAuth2 failed ({result.ErrorMessage}), trying fallback");
            RaiseProgress("OAuth unavailable, requesting App Password...", 40);

            // Default to App Password if no fallback specified
            var fallbackMethod = providerConfig.FallbackAuthMethod ?? AuthenticationMethod.AppPassword;

            return fallbackMethod switch
            {
                AuthenticationMethod.AppPassword =>
                    await AuthenticateWithAppPasswordAsync(emailAddress, providerConfig),
                AuthenticationMethod.BasicAuth =>
                    await AuthenticateWithPasswordAsync(emailAddress, providerConfig),
                _ => new EmailAuthenticationResult
                {
                    Success = false,
                    ErrorMessage = result.ErrorMessage
                }
            };
        }

        return new EmailAuthenticationResult
        {
            Success = false,
            ErrorMessage = result.ErrorMessage
        };
    }

    /// <summary>
    /// Authenticate with App Password (typically for 2FA accounts)
    /// </summary>
    private async Task<EmailAuthenticationResult> AuthenticateWithAppPasswordAsync(
        string emailAddress,
        EmailProviderConfig providerConfig)
    {
        RaiseProgress("App password required...", 40);

        // Request app password from user
        var passwordArgs = new PasswordRequiredEventArgs
        {
            EmailAddress = emailAddress,
            ProviderName = providerConfig.DisplayName,
            IsAppPassword = true,
            HelpText = GetAppPasswordHelpText(providerConfig.ProviderType)
        };

        PasswordRequired?.Invoke(this, passwordArgs);

        // Wait for password to be provided
        if (string.IsNullOrEmpty(passwordArgs.Password))
        {
            return new EmailAuthenticationResult
            {
                Success = false,
                ErrorMessage = "Authentication cancelled - no password provided"
            };
        }

        return await ValidatePasswordAuthAsync(emailAddress, passwordArgs.Password, providerConfig, true);
    }

    /// <summary>
    /// Authenticate with basic username/password
    /// </summary>
    private async Task<EmailAuthenticationResult> AuthenticateWithPasswordAsync(
        string emailAddress,
        EmailProviderConfig providerConfig)
    {
        RaiseProgress("Password authentication required...", 40);

        // Request password from user
        var passwordArgs = new PasswordRequiredEventArgs
        {
            EmailAddress = emailAddress,
            ProviderName = providerConfig.DisplayName,
            IsAppPassword = false,
            HelpText = "Enter your email password"
        };

        PasswordRequired?.Invoke(this, passwordArgs);

        if (string.IsNullOrEmpty(passwordArgs.Password))
        {
            return new EmailAuthenticationResult
            {
                Success = false,
                ErrorMessage = "Authentication cancelled - no password provided"
            };
        }

        return await ValidatePasswordAuthAsync(emailAddress, passwordArgs.Password, providerConfig, false);
    }

    /// <summary>
    /// Authenticate with provided password (public method for UI integration)
    /// </summary>
    public async Task<EmailAuthenticationResult> AuthenticateWithPasswordAsync(
        string emailAddress,
        string password,
        EmailProviderConfig? providerConfig = null)
    {
        // Detect provider if not provided
        if (providerConfig == null)
        {
            var detection = await _providerDetection.DetectProviderAsync(emailAddress);
            if (!detection.Success || detection.ProviderConfig == null)
            {
                return new EmailAuthenticationResult
                {
                    Success = false,
                    ErrorMessage = "Could not detect email provider settings"
                };
            }
            providerConfig = detection.ProviderConfig;
        }

        return await ValidatePasswordAuthAsync(emailAddress, password, providerConfig, false);
    }

    /// <summary>
    /// Validate password-based authentication
    /// </summary>
    private async Task<EmailAuthenticationResult> ValidatePasswordAuthAsync(
        string emailAddress,
        string password,
        EmailProviderConfig providerConfig,
        bool isAppPassword)
    {
        RaiseProgress("Validating credentials...", 60);

        var result = await _passwordService.AuthenticateAsync(emailAddress, password, providerConfig);

        if (result.Success)
        {
            RaiseProgress("Authentication successful!", 100);

            var authMethod = isAppPassword ? AuthenticationMethod.AppPassword : AuthenticationMethod.BasicAuth;
            var account = CreateSyncedAccount(
                emailAddress,
                providerConfig,
                authMethod,
                result.Credentials?.AccountId ?? Guid.NewGuid());

            await _secureStorage.StoreAsync($"account_{account.Id}", account);

            return new EmailAuthenticationResult
            {
                Success = true,
                Account = account,
                Credentials = result.Credentials,
                ProviderConfig = providerConfig
            };
        }

        return new EmailAuthenticationResult
        {
            Success = false,
            ErrorMessage = result.ErrorMessage
        };
    }

    /// <summary>
    /// Determine the best authentication method for a provider
    /// </summary>
    private AuthenticationMethod DetermineAuthMethod(EmailProviderConfig providerConfig)
    {
        // Google and Microsoft strongly prefer OAuth2
        if (providerConfig.ProviderType == EmailProviderType.Google ||
            providerConfig.ProviderType == EmailProviderType.Microsoft)
        {
            return AuthenticationMethod.OAuth2;
        }

        // Apple requires App Password
        if (providerConfig.ProviderType == EmailProviderType.Apple)
        {
            return AuthenticationMethod.AppPassword;
        }

        // Yahoo supports OAuth2
        if (providerConfig.ProviderType == EmailProviderType.Yahoo)
        {
            return AuthenticationMethod.OAuth2;
        }

        // Default to the provider's primary method
        return providerConfig.PrimaryAuthMethod;
    }

    /// <summary>
    /// Get help text for app password generation
    /// </summary>
    private string GetAppPasswordHelpText(EmailProviderType providerType)
    {
        return providerType switch
        {
            EmailProviderType.Google =>
                "To generate an App Password:\n" +
                "1. Go to myaccount.google.com/apppasswords\n" +
                "2. Sign in to your Google account\n" +
                "3. Select 'Mail' and 'Windows Computer'\n" +
                "4. Click 'Generate' and use the 16-character password",

            EmailProviderType.Apple =>
                "To generate an App Password:\n" +
                "1. Go to appleid.apple.com\n" +
                "2. Sign in and go to Security\n" +
                "3. Click 'Generate Password' under App-Specific Passwords\n" +
                "4. Enter a label like 'JubileeOutlook'\n" +
                "5. Use the generated password",

            EmailProviderType.Yahoo =>
                "To generate an App Password:\n" +
                "1. Go to login.yahoo.com/account/security\n" +
                "2. Under 'Other ways to sign in', click 'Generate app password'\n" +
                "3. Select 'Other app' and enter 'JubileeOutlook'\n" +
                "4. Use the generated password",

            _ => "Please generate an app-specific password from your email provider's security settings."
        };
    }

    /// <summary>
    /// Create a synced email account record
    /// </summary>
    private SyncedEmailAccount CreateSyncedAccount(
        string emailAddress,
        EmailProviderConfig providerConfig,
        AuthenticationMethod authMethod,
        Guid credentialsId)
    {
        return new SyncedEmailAccount
        {
            Id = credentialsId,
            EmailAddress = emailAddress,
            DisplayName = emailAddress,
            ProviderType = providerConfig.ProviderType,
            AuthMethod = authMethod,
            ConnectionStatus = AccountConnectionStatus.Connected,
            ImapHost = providerConfig.ImapHost,
            ImapPort = providerConfig.ImapPort,
            SmtpHost = providerConfig.SmtpHost,
            SmtpPort = providerConfig.SmtpPort,
            IsEnabled = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Get all stored synced accounts
    /// </summary>
    public async Task<List<SyncedEmailAccount>> GetStoredAccountsAsync()
    {
        var accounts = new List<SyncedEmailAccount>();

        // List all account files in secure storage
        var storagePath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "JubileeOutlook",
            "SecureStorage"
        );

        if (!Directory.Exists(storagePath)) return accounts;

        var accountFiles = Directory.GetFiles(storagePath, "account_*.dat");
        foreach (var file in accountFiles)
        {
            try
            {
                var fileName = Path.GetFileNameWithoutExtension(file);
                var account = await _secureStorage.RetrieveAsync<SyncedEmailAccount>(fileName);
                if (account != null)
                {
                    accounts.Add(account);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[AuthManager] Failed to load account from {file}: {ex.Message}");
            }
        }

        return accounts;
    }

    /// <summary>
    /// Remove a synced account and its credentials
    /// </summary>
    public async Task RemoveAccountAsync(Guid accountId)
    {
        await _secureStorage.DeleteAsync($"account_{accountId}");
        await _oauth2Service.RemoveCredentialsAsync(accountId);
    }

    /// <summary>
    /// Refresh authentication for an account
    /// </summary>
    public async Task<EmailAuthenticationResult> RefreshAuthenticationAsync(Guid accountId)
    {
        var account = await _secureStorage.RetrieveAsync<SyncedEmailAccount>($"account_{accountId}");
        if (account == null)
        {
            return new EmailAuthenticationResult
            {
                Success = false,
                ErrorMessage = "Account not found"
            };
        }

        if (account.AuthMethod == AuthenticationMethod.OAuth2)
        {
            var result = await _oauth2Service.RefreshTokenAsync(accountId, account.ProviderType);
            return new EmailAuthenticationResult
            {
                Success = result.Success,
                ErrorMessage = result.ErrorMessage,
                Account = account,
                Credentials = result.Credentials
            };
        }

        // For password auth, just verify credentials are still valid
        var providerConfig = _providerDetection.GetProviderConfig(account.ProviderType);
        var isValid = await _passwordService.VerifyCredentialsAsync(accountId, providerConfig);

        return new EmailAuthenticationResult
        {
            Success = isValid,
            ErrorMessage = isValid ? null : "Credentials are no longer valid",
            Account = account
        };
    }

    private void RaiseProgress(string message, int percentage)
    {
        AuthenticationProgress?.Invoke(this, new AuthenticationProgressEventArgs
        {
            Message = message,
            PercentComplete = percentage
        });
    }
}

/// <summary>
/// Result of email authentication
/// </summary>
public class EmailAuthenticationResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public SyncedEmailAccount? Account { get; set; }
    public EmailAccountCredentials? Credentials { get; set; }
    public EmailProviderConfig? ProviderConfig { get; set; }
}

/// <summary>
/// Event args when password is required
/// </summary>
public class PasswordRequiredEventArgs : EventArgs
{
    public string EmailAddress { get; set; } = string.Empty;
    public string ProviderName { get; set; } = string.Empty;
    public bool IsAppPassword { get; set; }
    public string HelpText { get; set; } = string.Empty;
    public string? Password { get; set; }
}

/// <summary>
/// Event args for authentication progress
/// </summary>
public class AuthenticationProgressEventArgs : EventArgs
{
    public string Message { get; set; } = string.Empty;
    public int PercentComplete { get; set; }
}
