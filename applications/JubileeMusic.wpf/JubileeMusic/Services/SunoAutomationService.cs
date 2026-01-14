using System;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using JubileeMusic.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace JubileeMusic.Services;

public class SunoAutomationService : ISunoAutomationService
{
    private readonly ILogger<SunoAutomationService> _logger;
    private WebView2? _webView;
    private bool _initialized;

    private const string SunoBaseUrl = "https://suno.com";
    private const string SunoCreateUrl = "https://suno.com/create";
    private const int NavigationTimeoutMs = 30000;
    private const int ElementWaitTimeoutMs = 10000;

    public event EventHandler<string>? NavigationStarted;
    public event EventHandler<string>? NavigationCompleted;
    public event EventHandler<GenerationStatusChangedEventArgs>? GenerationStatusChanged;
    public event EventHandler<string>? ErrorOccurred;

    public SunoAutomationService(ILogger<SunoAutomationService> logger)
    {
        _logger = logger;
    }

    public async Task InitializeAsync(WebView2 webView)
    {
        if (_initialized && _webView == webView)
        {
            return;
        }

        _webView = webView;

        // Subscribe to navigation events
        _webView.NavigationStarting += OnNavigationStarting;
        _webView.NavigationCompleted += OnNavigationCompleted;

        _initialized = true;
        _logger.LogInformation("SunoAutomationService initialized");

        await Task.CompletedTask;
    }

    private void OnNavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
    {
        _logger.LogDebug("Navigation starting: {Url}", e.Uri);
        NavigationStarted?.Invoke(this, e.Uri);
    }

    private void OnNavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        var url = _webView?.Source?.ToString() ?? "unknown";
        _logger.LogDebug("Navigation completed: {Url}, Success: {Success}", url, e.IsSuccess);
        NavigationCompleted?.Invoke(this, url);
    }

    public async Task<bool> NavigateToSunoAsync()
    {
        EnsureInitialized();

        try
        {
            _logger.LogInformation("Navigating to Suno.com");
            _webView!.Source = new Uri(SunoBaseUrl);

            await WaitForNavigationAsync();
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to navigate to Suno.com");
            ErrorOccurred?.Invoke(this, $"Navigation failed: {ex.Message}");
            return false;
        }
    }

    public async Task<bool> IsLoggedInAsync()
    {
        EnsureInitialized();

        try
        {
            // Check for user-specific elements that indicate logged-in state
            var script = @"
                (function() {
                    // Look for common logged-in indicators
                    const userMenu = document.querySelector('[data-testid=""user-menu""]') ||
                                    document.querySelector('.user-avatar') ||
                                    document.querySelector('[aria-label=""Account""]') ||
                                    document.querySelector('[aria-label=""Profile""]');

                    const loginButton = document.querySelector('[data-testid=""login-button""]') ||
                                       document.querySelector('button:has-text(""Sign In"")') ||
                                       document.querySelector('a[href*=""login""]');

                    return {
                        hasUserMenu: !!userMenu,
                        hasLoginButton: !!loginButton,
                        isLoggedIn: !!userMenu && !loginButton
                    };
                })();
            ";

            var result = await ExecuteScriptAsync<JsonElement>(script);
            var isLoggedIn = result.TryGetProperty("isLoggedIn", out var prop) && prop.GetBoolean();

            _logger.LogInformation("Login status check: {Status}", isLoggedIn ? "logged in" : "not logged in");
            return isLoggedIn;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to check login status");
            return false;
        }
    }

    public async Task<bool> LoginAsync(string email, string password)
    {
        EnsureInitialized();

        try
        {
            _logger.LogInformation("Attempting login for {Email}", email);

            // Click login/sign in button
            var clickLoginScript = @"
                (function() {
                    const loginBtn = document.querySelector('[data-testid=""login-button""]') ||
                                    document.querySelector('button:contains(""Sign In"")') ||
                                    document.querySelector('a[href*=""login""]') ||
                                    Array.from(document.querySelectorAll('button')).find(b =>
                                        b.textContent.toLowerCase().includes('sign in') ||
                                        b.textContent.toLowerCase().includes('log in'));
                    if (loginBtn) {
                        loginBtn.click();
                        return true;
                    }
                    return false;
                })();
            ";

            await ExecuteScriptAsync<bool>(clickLoginScript);
            await Task.Delay(2000); // Wait for login modal/page

            // Enter email
            var enterEmailScript = $@"
                (function() {{
                    const emailInput = document.querySelector('input[type=""email""]') ||
                                      document.querySelector('input[name=""email""]') ||
                                      document.querySelector('input[placeholder*=""email""]');
                    if (emailInput) {{
                        emailInput.value = '{EscapeJsString(email)}';
                        emailInput.dispatchEvent(new Event('input', {{ bubbles: true }}));
                        return true;
                    }}
                    return false;
                }})();
            ";

            var emailEntered = await ExecuteScriptAsync<bool>(enterEmailScript);
            if (!emailEntered)
            {
                _logger.LogWarning("Could not find email input field");
                ErrorOccurred?.Invoke(this, "Could not find email input field");
                return false;
            }

            await Task.Delay(500);

            // Enter password
            var enterPasswordScript = $@"
                (function() {{
                    const passwordInput = document.querySelector('input[type=""password""]') ||
                                         document.querySelector('input[name=""password""]');
                    if (passwordInput) {{
                        passwordInput.value = '{EscapeJsString(password)}';
                        passwordInput.dispatchEvent(new Event('input', {{ bubbles: true }}));
                        return true;
                    }}
                    return false;
                }})();
            ";

            var passwordEntered = await ExecuteScriptAsync<bool>(enterPasswordScript);
            if (!passwordEntered)
            {
                _logger.LogWarning("Could not find password input field");
                ErrorOccurred?.Invoke(this, "Could not find password input field");
                return false;
            }

            await Task.Delay(500);

            // Click submit button
            var submitScript = @"
                (function() {
                    const submitBtn = document.querySelector('button[type=""submit""]') ||
                                     document.querySelector('form button') ||
                                     Array.from(document.querySelectorAll('button')).find(b =>
                                         b.textContent.toLowerCase().includes('sign in') ||
                                         b.textContent.toLowerCase().includes('log in') ||
                                         b.textContent.toLowerCase().includes('continue'));
                    if (submitBtn) {
                        submitBtn.click();
                        return true;
                    }
                    return false;
                })();
            ";

            await ExecuteScriptAsync<bool>(submitScript);

            // Wait for login to complete
            await Task.Delay(5000);

            var loggedIn = await IsLoggedInAsync();
            _logger.LogInformation("Login result: {Success}", loggedIn);

            return loggedIn;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Login failed");
            ErrorOccurred?.Invoke(this, $"Login failed: {ex.Message}");
            return false;
        }
    }

    public async Task<bool> NavigateToCreatePageAsync()
    {
        EnsureInitialized();

        try
        {
            _logger.LogInformation("Navigating to create page");
            _webView!.Source = new Uri(SunoCreateUrl);

            await WaitForNavigationAsync();
            await Task.Delay(2000); // Wait for page to fully load

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to navigate to create page");
            ErrorOccurred?.Invoke(this, $"Navigation to create page failed: {ex.Message}");
            return false;
        }
    }

    public async Task<bool> EnterLyricsAsync(string lyrics)
    {
        EnsureInitialized();

        try
        {
            _logger.LogInformation("Entering lyrics ({Length} chars)", lyrics.Length);

            var script = $@"
                (function() {{
                    // Look for lyrics textarea - Suno typically uses a textarea for lyrics
                    const lyricsInput = document.querySelector('textarea[placeholder*=""lyrics""]') ||
                                       document.querySelector('textarea[data-testid=""lyrics-input""]') ||
                                       document.querySelector('.lyrics-input textarea') ||
                                       document.querySelector('textarea');

                    if (lyricsInput) {{
                        lyricsInput.value = {JsonSerializer.Serialize(lyrics)};
                        lyricsInput.dispatchEvent(new Event('input', {{ bubbles: true }}));
                        lyricsInput.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        return true;
                    }}
                    return false;
                }})();
            ";

            var success = await ExecuteScriptAsync<bool>(script);

            if (!success)
            {
                _logger.LogWarning("Could not find lyrics input field");
                ErrorOccurred?.Invoke(this, "Could not find lyrics input field");
            }

            return success;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to enter lyrics");
            ErrorOccurred?.Invoke(this, $"Failed to enter lyrics: {ex.Message}");
            return false;
        }
    }

    public async Task<bool> EnterStylePromptAsync(string stylePrompt)
    {
        EnsureInitialized();

        try
        {
            _logger.LogInformation("Entering style prompt");

            var script = $@"
                (function() {{
                    // Look for style/genre input
                    const styleInput = document.querySelector('input[placeholder*=""style""]') ||
                                      document.querySelector('input[placeholder*=""genre""]') ||
                                      document.querySelector('input[data-testid=""style-input""]') ||
                                      document.querySelector('.style-input input') ||
                                      document.querySelector('input[type=""text""]');

                    if (styleInput) {{
                        styleInput.value = {JsonSerializer.Serialize(stylePrompt)};
                        styleInput.dispatchEvent(new Event('input', {{ bubbles: true }}));
                        styleInput.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        return true;
                    }}
                    return false;
                }})();
            ";

            var success = await ExecuteScriptAsync<bool>(script);

            if (!success)
            {
                _logger.LogWarning("Could not find style prompt input field");
            }

            return success;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to enter style prompt");
            ErrorOccurred?.Invoke(this, $"Failed to enter style prompt: {ex.Message}");
            return false;
        }
    }

    public async Task<bool> SetInstrumentalOnlyAsync(bool instrumental)
    {
        EnsureInitialized();

        try
        {
            _logger.LogInformation("Setting instrumental mode: {Instrumental}", instrumental);

            var script = $@"
                (function() {{
                    // Look for instrumental toggle/checkbox
                    const instrumentalToggle = document.querySelector('input[type=""checkbox""][name*=""instrumental""]') ||
                                              document.querySelector('[data-testid=""instrumental-toggle""]') ||
                                              document.querySelector('.instrumental-toggle');

                    if (instrumentalToggle) {{
                        const isChecked = instrumentalToggle.checked || instrumentalToggle.getAttribute('aria-checked') === 'true';
                        if (isChecked !== {instrumental.ToString().ToLower()}) {{
                            instrumentalToggle.click();
                        }}
                        return true;
                    }}
                    return false;
                }})();
            ";

            return await ExecuteScriptAsync<bool>(script);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to set instrumental mode");
            return false;
        }
    }

    public async Task<GenerationResult> SubmitGenerationAsync()
    {
        EnsureInitialized();

        try
        {
            _logger.LogInformation("Submitting generation request");

            // Click the create/generate button
            var submitScript = @"
                (function() {
                    const createBtn = document.querySelector('button[data-testid=""create-button""]') ||
                                     document.querySelector('button[type=""submit""]') ||
                                     Array.from(document.querySelectorAll('button')).find(b =>
                                         b.textContent.toLowerCase().includes('create') ||
                                         b.textContent.toLowerCase().includes('generate'));

                    if (createBtn && !createBtn.disabled) {
                        createBtn.click();
                        return { success: true };
                    }
                    return { success: false, error: 'Create button not found or disabled' };
                })();
            ";

            var submitResult = await ExecuteScriptAsync<JsonElement>(submitScript);
            var success = submitResult.GetProperty("success").GetBoolean();

            if (!success)
            {
                var error = submitResult.TryGetProperty("error", out var errorProp)
                    ? errorProp.GetString()
                    : "Unknown error";

                return new GenerationResult
                {
                    Success = false,
                    ErrorMessage = error
                };
            }

            // Wait for generation to start and get job ID
            await Task.Delay(3000);

            var result = new GenerationResult
            {
                Success = true,
                JobId = Guid.NewGuid().ToString() // Placeholder - actual implementation would extract from page
            };

            _logger.LogInformation("Generation submitted, JobId: {JobId}", result.JobId);
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to submit generation");
            ErrorOccurred?.Invoke(this, $"Generation submission failed: {ex.Message}");

            return new GenerationResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }

    public async Task<GenerationStatus> CheckGenerationStatusAsync(string jobId)
    {
        EnsureInitialized();

        try
        {
            // Check for completion indicators on the page
            var script = @"
                (function() {
                    // Look for status indicators
                    const generating = document.querySelector('.generating') ||
                                      document.querySelector('[data-status=""generating""]');
                    const completed = document.querySelector('.completed') ||
                                     document.querySelector('[data-status=""completed""]') ||
                                     document.querySelector('audio[src]');
                    const failed = document.querySelector('.error') ||
                                  document.querySelector('[data-status=""failed""]');

                    if (failed) return 'failed';
                    if (completed) return 'completed';
                    if (generating) return 'generating';
                    return 'pending';
                })();
            ";

            var statusStr = await ExecuteScriptAsync<string>(script);

            return statusStr?.ToLower() switch
            {
                "completed" => GenerationStatus.Completed,
                "generating" => GenerationStatus.Generating,
                "failed" => GenerationStatus.Failed,
                _ => GenerationStatus.Pending
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to check generation status");
            return GenerationStatus.Unknown;
        }
    }

    public async Task<byte[]?> DownloadAudioAsync(string audioUrl)
    {
        EnsureInitialized();

        try
        {
            _logger.LogInformation("Downloading audio from {Url}", audioUrl);

            using var httpClient = new HttpClient();
            httpClient.Timeout = TimeSpan.FromMinutes(5);

            var response = await httpClient.GetAsync(audioUrl);
            response.EnsureSuccessStatusCode();

            var data = await response.Content.ReadAsByteArrayAsync();
            _logger.LogInformation("Downloaded {Size} bytes", data.Length);

            return data;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to download audio");
            ErrorOccurred?.Invoke(this, $"Audio download failed: {ex.Message}");
            return null;
        }
    }

    public async Task<byte[]?> DownloadCoverImageAsync(string imageUrl)
    {
        EnsureInitialized();

        try
        {
            _logger.LogInformation("Downloading cover image from {Url}", imageUrl);

            using var httpClient = new HttpClient();
            httpClient.Timeout = TimeSpan.FromSeconds(30);

            var response = await httpClient.GetAsync(imageUrl);
            response.EnsureSuccessStatusCode();

            return await response.Content.ReadAsByteArrayAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to download cover image");
            return null;
        }
    }

    public async Task<string?> GetCurrentPageUrlAsync()
    {
        return await Task.FromResult(_webView?.Source?.ToString());
    }

    private void EnsureInitialized()
    {
        if (!_initialized || _webView == null)
        {
            throw new InvalidOperationException("SunoAutomationService is not initialized. Call InitializeAsync first.");
        }
    }

    private async Task WaitForNavigationAsync()
    {
        var tcs = new TaskCompletionSource<bool>();
        var cts = new CancellationTokenSource(NavigationTimeoutMs);

        void Handler(object? s, CoreWebView2NavigationCompletedEventArgs e)
        {
            tcs.TrySetResult(e.IsSuccess);
        }

        _webView!.NavigationCompleted += Handler;
        cts.Token.Register(() => tcs.TrySetCanceled());

        try
        {
            await tcs.Task;
        }
        finally
        {
            _webView.NavigationCompleted -= Handler;
            cts.Dispose();
        }
    }

    private async Task<T?> ExecuteScriptAsync<T>(string script)
    {
        try
        {
            var result = await _webView!.CoreWebView2.ExecuteScriptAsync(script);

            if (string.IsNullOrEmpty(result) || result == "null" || result == "undefined")
            {
                return default;
            }

            return JsonSerializer.Deserialize<T>(result);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Script execution failed");
            return default;
        }
    }

    private static string EscapeJsString(string value)
    {
        return value
            .Replace("\\", "\\\\")
            .Replace("'", "\\'")
            .Replace("\"", "\\\"")
            .Replace("\n", "\\n")
            .Replace("\r", "\\r");
    }
}
