using System;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
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

    // Win32 API declarations for real mouse cursor simulation
    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetCursorPos(int x, int y);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, UIntPtr dwExtraInfo);

    private const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    private const uint MOUSEEVENTF_LEFTUP = 0x0004;

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

        // Ensure WebView2 is initialized with persistent storage for cookies/sessions
        if (_webView.CoreWebView2 == null)
        {
            // Create persistent user data folder for storing cookies, sessions, etc.
            var userDataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "JubileeMusic",
                "WebView2Data");

            Directory.CreateDirectory(userDataFolder);

            var environment = await CoreWebView2Environment.CreateAsync(
                userDataFolder: userDataFolder);

            await _webView.EnsureCoreWebView2Async(environment);

            _logger.LogInformation("WebView2 initialized with persistent storage at {Path}", userDataFolder);

            // Configure WebView2 settings for OAuth popup handling
            _webView.CoreWebView2.Settings.AreDefaultScriptDialogsEnabled = true;
            _webView.CoreWebView2.Settings.IsScriptEnabled = true;
            _webView.CoreWebView2.Settings.AreDevToolsEnabled = true;
            _webView.CoreWebView2.Settings.IsWebMessageEnabled = true;

            // Handle new window requests (OAuth popups) by opening in the same WebView
            _webView.CoreWebView2.NewWindowRequested += (sender, args) =>
            {
                args.Handled = true;
                _webView.CoreWebView2.Navigate(args.Uri);
                _logger.LogDebug("Redirected popup to main window: {Uri}", args.Uri);
            };
        }

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
            _logger.LogInformation("[LYRICS] Starting to enter lyrics ({Length} chars)", lyrics.Length);

            // Step 1: Find the lyrics textarea (NOT the one marked as styles)
            var findScript = @"
                (function() {
                    // Find all visible textareas sorted by vertical position
                    // IMPORTANT: Filter out textareas at top <= 10 (hidden/utility elements)
                    const allTextareas = Array.from(document.querySelectorAll('textarea'))
                        .map(el => ({ el, rect: el.getBoundingClientRect() }))
                        .filter(item => item.rect.height > 0 && item.rect.width > 0 && item.rect.top > 10)
                        .sort((a, b) => a.rect.top - b.rect.top);

                    console.log('[LYRICS] Found ' + allTextareas.length + ' visible textareas (filtered top > 10)');

                    // Log all textareas
                    allTextareas.forEach((item, i) => {
                        const marker = item.el.getAttribute('data-jubilee-field') || 'none';
                        console.log('[LYRICS] Textarea ' + i + ': top=' + Math.round(item.rect.top) +
                            ', placeholder=' + (item.el.placeholder || 'none').substring(0, 40) +
                            ', marker=' + marker);
                    });

                    let lyricsTextarea = null;
                    let foundBy = 'unknown';

                    // Method 1: Find the LYRICS field specifically - look for 'Write some lyrics' placeholder
                    // This is the Custom mode lyrics input in Suno
                    for (const item of allTextareas) {
                        const ph = (item.el.placeholder || '').toLowerCase();
                        if (ph.includes('write') && (ph.includes('lyrics') || ph.includes('prompt'))) {
                            lyricsTextarea = item.el;
                            foundBy = 'placeholder (write lyrics/prompt): ' + ph.substring(0, 40);
                            console.log('[LYRICS] Found by Write lyrics/prompt placeholder');
                            break;
                        }
                    }

                    // Method 2: Find by other lyrics-related placeholders
                    if (!lyricsTextarea) {
                        for (const item of allTextareas) {
                            const ph = (item.el.placeholder || '').toLowerCase();
                            // Skip if this looks like styles field
                            if (ph.includes('describe') && ph.includes('sound')) continue;
                            if (ph.includes('style') || ph.includes('genre')) continue;

                            if (ph.includes('lyrics') || ph.includes('verse') || ph.includes('chorus')) {
                                lyricsTextarea = item.el;
                                foundBy = 'placeholder (lyrics keyword): ' + ph.substring(0, 40);
                                console.log('[LYRICS] Found by lyrics keyword');
                                break;
                            }
                        }
                    }

                    // Method 3: Find textarea that is NOT already marked as styles
                    // and is positioned BELOW the styles textarea
                    if (!lyricsTextarea) {
                        const stylesTextarea = document.querySelector('[data-jubilee-field=""styles""]');
                        const stylesTop = stylesTextarea ? stylesTextarea.getBoundingClientRect().top : 0;

                        for (const item of allTextareas) {
                            if (item.el.getAttribute('data-jubilee-field') === 'styles') continue;
                            // Skip empty placeholders
                            if (!(item.el.placeholder || '')) continue;
                            // Lyrics should be BELOW styles
                            if (stylesTop > 0 && item.rect.top <= stylesTop) continue;

                            lyricsTextarea = item.el;
                            foundBy = 'position below styles: top=' + Math.round(item.rect.top);
                            console.log('[LYRICS] Using textarea below styles');
                            break;
                        }
                    }

                    if (!lyricsTextarea) {
                        return { success: false, error: 'No lyrics textarea found (all marked as styles or none available)' };
                    }

                    console.log('[LYRICS] Selected textarea found by: ' + foundBy);

                    // Mark this element as lyrics
                    lyricsTextarea.setAttribute('data-jubilee-field', 'lyrics');
                    lyricsTextarea.focus();

                    return {
                        success: true,
                        placeholder: lyricsTextarea.placeholder || '',
                        top: Math.round(lyricsTextarea.getBoundingClientRect().top),
                        foundBy: foundBy
                    };
                })();
            ";

            var findResult = await ExecuteScriptAsync<JsonElement>(findScript);
            _logger.LogInformation("[LYRICS] Find result: {Result}", findResult.ToString());

            if (!findResult.TryGetProperty("success", out var findSuccess) || !findSuccess.GetBoolean())
            {
                var findError = findResult.TryGetProperty("error", out var ep) ? ep.GetString() : "Unknown error finding textarea";
                _logger.LogWarning("[LYRICS] Failed to find lyrics textarea: {Error}", findError);
                return false;
            }

            // Step 2: Set the value
            var escapedValue = lyrics
                .Replace("\\", "\\\\")
                .Replace("\"", "\\\"")
                .Replace("\n", "\\n")
                .Replace("\r", "\\r")
                .Replace("\t", "\\t");

            var setValueScript = $@"
                (function() {{
                    const textarea = document.querySelector('[data-jubilee-field=""lyrics""]');
                    if (!textarea) {{
                        return {{ success: false, error: 'Marked lyrics textarea not found' }};
                    }}

                    const valueToSet = ""{escapedValue}"";
                    console.log('[LYRICS] Setting value: ' + valueToSet.substring(0, 50) + '...');

                    try {{
                        const nativeSetter = Object.getOwnPropertyDescriptor(
                            window.HTMLTextAreaElement.prototype, 'value'
                        ).set;

                        nativeSetter.call(textarea, valueToSet);

                        textarea.dispatchEvent(new Event('input', {{ bubbles: true, cancelable: true }}));
                        textarea.dispatchEvent(new Event('change', {{ bubbles: true, cancelable: true }}));

                        const actualValue = textarea.value;
                        const valueSet = actualValue === valueToSet;

                        console.log('[LYRICS] Value verification: match=' + valueSet);

                        return {{
                            success: valueSet,
                            actualLength: actualValue.length,
                            expectedLength: valueToSet.length
                        }};
                    }} catch (e) {{
                        console.log('[LYRICS] Error: ' + e.message);
                        return {{ success: false, error: e.message }};
                    }}
                }})();
            ";

            var setResult = await ExecuteScriptAsync<JsonElement>(setValueScript);
            _logger.LogInformation("[LYRICS] Set value result: {Result}", setResult.ToString());

            if (setResult.TryGetProperty("success", out var setSuccess) && setSuccess.GetBoolean())
            {
                _logger.LogInformation("[LYRICS] Successfully inserted lyrics");
                return true;
            }
            else
            {
                var setError = setResult.TryGetProperty("error", out var se) ? se.GetString() : "Value not set correctly";
                _logger.LogWarning("[LYRICS] Failed to set lyrics value: {Error}", setError);
                return false;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[LYRICS] Exception while entering lyrics");
            ErrorOccurred?.Invoke(this, $"Failed to enter lyrics: {ex.Message}");
            return false;
        }
    }

    public async Task<bool> EnterStylePromptAsync(string stylePrompt)
    {
        EnsureInitialized();

        try
        {
            _logger.LogInformation("[STYLES] Starting to enter styles: '{Style}' ({Length} chars)", stylePrompt, stylePrompt?.Length ?? 0);

            if (string.IsNullOrWhiteSpace(stylePrompt))
            {
                _logger.LogWarning("[STYLES] Style prompt is null or empty, skipping");
                return false;
            }

            // Combined find-and-set script to avoid race conditions
            // This script finds the styles textarea, sets the value, and triggers React state update in one atomic operation
            var escapedValue = stylePrompt
                .Replace("\\", "\\\\")
                .Replace("\"", "\\\"")
                .Replace("\n", "\\n")
                .Replace("\r", "\\r")
                .Replace("\t", "\\t");

            // Using verbatim string without interpolation to avoid escaping issues with JavaScript
            var combinedScript = @"
                (function() {
                    const valueToSet = """ + escapedValue + @""";
                    console.log('[STYLES] Starting styles insertion, value length: ' + valueToSet.length);

                    // Find all visible textareas sorted by vertical position
                    // IMPORTANT: Filter out textareas at top <= 10 (hidden/utility elements)
                    // and require non-empty placeholder to identify actual input fields
                    const allTextareas = Array.from(document.querySelectorAll('textarea'))
                        .map(el => ({ el, rect: el.getBoundingClientRect() }))
                        .filter(item => item.rect.height > 0 && item.rect.width > 0 && item.rect.top > 10)
                        .sort((a, b) => a.rect.top - b.rect.top);

                    console.log('[STYLES] Found ' + allTextareas.length + ' visible textareas (filtered top > 10)');

                    if (allTextareas.length === 0) {
                        return { success: false, error: 'No textareas found on page', step: 'find' };
                    }

                    // Log all textareas for debugging
                    allTextareas.forEach((item, i) => {
                        const marker = item.el.getAttribute('data-jubilee-field') || 'none';
                        console.log('[STYLES] Textarea ' + i + ': top=' + Math.round(item.rect.top) +
                            ', height=' + Math.round(item.rect.height) +
                            ', placeholder=' + (item.el.placeholder || 'none').substring(0, 40) +
                            ', marker=' + marker);
                    });

                    let stylesTextarea = null;
                    let foundBy = 'unknown';

                    // Helper to check if element is truly visible and interactable
                    function isReallyVisible(el) {
                        const style = window.getComputedStyle(el);
                        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                            return false;
                        }
                        // Check if any parent is hidden
                        let parent = el.parentElement;
                        while (parent) {
                            const parentStyle = window.getComputedStyle(parent);
                            if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') {
                                return false;
                            }
                            // Check for tab panels - if parent has role=tabpanel and is hidden
                            if (parent.getAttribute('role') === 'tabpanel' && parent.getAttribute('aria-hidden') === 'true') {
                                return false;
                            }
                            parent = parent.parentElement;
                        }
                        return true;
                    }

                    // Filter to only truly visible textareas
                    const visibleTextareas = allTextareas.filter(item => isReallyVisible(item.el));
                    console.log('[STYLES] After visibility filter: ' + visibleTextareas.length + ' textareas');

                    // Method 1: Find the STYLES field specifically - look for 'Describe the sound' placeholder
                    // This is the Custom mode style input in Suno
                    for (const item of visibleTextareas) {
                        const ph = (item.el.placeholder || '').toLowerCase();
                        if (ph.includes('describe') && ph.includes('sound')) {
                            stylesTextarea = item.el;
                            foundBy = 'placeholder (describe sound): ' + ph.substring(0, 40);
                            console.log('[STYLES] Found by Describe the sound placeholder');
                            break;
                        }
                    }

                    // Method 2: Find by other style-related placeholders
                    if (!stylesTextarea) {
                        const styleKeywords = ['style', 'genre', 'vibe', 'twerk', 'pop', 'rock', 'tags'];
                        for (const item of visibleTextareas) {
                            const ph = (item.el.placeholder || '').toLowerCase();
                            // Skip if this looks like lyrics field
                            if (ph.includes('lyrics') || ph.includes('write some')) continue;

                            for (const keyword of styleKeywords) {
                                if (ph.includes(keyword)) {
                                    stylesTextarea = item.el;
                                    foundBy = 'placeholder keyword: ' + keyword;
                                    console.log('[STYLES] Found by placeholder keyword: ' + keyword);
                                    break;
                                }
                            }
                            if (stylesTextarea) break;
                        }
                    }

                    // Method 3: Find by aria-label or data attributes
                    if (!stylesTextarea) {
                        for (const item of visibleTextareas) {
                            const ariaLabel = (item.el.getAttribute('aria-label') || '').toLowerCase();
                            const dataTestId = (item.el.getAttribute('data-testid') || '').toLowerCase();
                            if (ariaLabel.includes('style') || ariaLabel.includes('genre') ||
                                dataTestId.includes('style')) {
                                stylesTextarea = item.el;
                                foundBy = 'aria/data: ' + (ariaLabel || dataTestId);
                                console.log('[STYLES] Found by aria-label/data-testid');
                                break;
                            }
                        }
                    }

                    // Method 4: Use the FIRST textarea with non-empty placeholder that is NOT lyrics
                    if (!stylesTextarea) {
                        for (const item of visibleTextareas) {
                            const ph = (item.el.placeholder || '').toLowerCase();
                            // Skip empty placeholders and lyrics fields
                            if (!ph || ph.includes('lyrics') || ph.includes('write some')) continue;

                            const marker = item.el.getAttribute('data-jubilee-field');
                            if (marker !== 'lyrics') {
                                stylesTextarea = item.el;
                                foundBy = 'first non-lyrics with placeholder: ' + ph.substring(0, 30);
                                console.log('[STYLES] Using first non-lyrics textarea with placeholder');
                                break;
                            }
                        }
                    }

                    if (!stylesTextarea) {
                        console.log('[STYLES] ERROR: No styles textarea found');
                        return { success: false, error: 'No styles textarea found', step: 'find' };
                    }

                    console.log('[STYLES] Selected textarea found by: ' + foundBy);

                    // Mark this element for tracking
                    stylesTextarea.setAttribute('data-jubilee-field', 'styles');

                    // Focus the textarea
                    stylesTextarea.focus();
                    stylesTextarea.select();

                    try {
                        // CREATIVE APPROACH: Simulate a paste event with DataTransfer
                        // This is the most realistic way to simulate user input

                        // First clear the field
                        stylesTextarea.value = '';

                        // Create a synthetic paste event with DataTransfer
                        const dataTransfer = new DataTransfer();
                        dataTransfer.setData('text/plain', valueToSet);

                        const pasteEvent = new ClipboardEvent('paste', {
                            bubbles: true,
                            cancelable: true,
                            clipboardData: dataTransfer
                        });

                        // Dispatch paste event
                        const pasteHandled = !stylesTextarea.dispatchEvent(pasteEvent);
                        console.log('[STYLES] Paste event dispatched, defaultPrevented=' + pasteHandled);

                        // If paste didn't work, try simulating individual key presses
                        if (stylesTextarea.value !== valueToSet) {
                            console.log('[STYLES] Paste didnt set value, trying character-by-character input simulation');

                            // Clear again
                            stylesTextarea.value = '';

                            // Type each character with proper events
                            for (let i = 0; i < valueToSet.length; i++) {
                                const char = valueToSet[i];

                                // Simulate keydown
                                stylesTextarea.dispatchEvent(new KeyboardEvent('keydown', {
                                    key: char,
                                    code: 'Key' + char.toUpperCase(),
                                    bubbles: true
                                }));

                                // Simulate beforeinput
                                stylesTextarea.dispatchEvent(new InputEvent('beforeinput', {
                                    data: char,
                                    inputType: 'insertText',
                                    bubbles: true,
                                    cancelable: true
                                }));

                                // Actually insert the character
                                stylesTextarea.value += char;

                                // Simulate input event
                                stylesTextarea.dispatchEvent(new InputEvent('input', {
                                    data: char,
                                    inputType: 'insertText',
                                    bubbles: true
                                }));

                                // Simulate keyup
                                stylesTextarea.dispatchEvent(new KeyboardEvent('keyup', {
                                    key: char,
                                    code: 'Key' + char.toUpperCase(),
                                    bubbles: true
                                }));
                            }
                        }

                        // Verify the value was set
                        const actualValue = stylesTextarea.value;
                        const valueSet = actualValue === valueToSet;

                        console.log('[STYLES] Value verification: expected=' + valueToSet.length + ' chars, actual=' + actualValue.length + ' chars, match=' + valueSet);
                        console.log('[STYLES] Actual value preview: ' + actualValue.substring(0, 50));

                        return {
                            success: valueSet,
                            foundBy: foundBy,
                            actualValue: actualValue.substring(0, 100),
                            expectedLength: valueToSet.length,
                            actualLength: actualValue.length,
                            step: 'set'
                        };
                    } catch (e) {
                        console.log('[STYLES] Error setting value: ' + e.message);
                        return { success: false, error: e.message, step: 'set' };
                    }
                })();
            ";

            var result = await ExecuteScriptAsync<JsonElement>(combinedScript);
            _logger.LogInformation("[STYLES] Combined script result: {Result}", result.ToString());

            if (result.TryGetProperty("success", out var successProp) && successProp.GetBoolean())
            {
                var foundBy = result.TryGetProperty("foundBy", out var fb) ? fb.GetString() : "unknown";
                _logger.LogInformation("[STYLES] Successfully inserted styles (found by: {FoundBy})", foundBy);
                return true;
            }
            else
            {
                var error = result.TryGetProperty("error", out var ep) ? ep.GetString() : "Unknown error";
                var step = result.TryGetProperty("step", out var sp) ? sp.GetString() : "unknown";
                var actualLen = result.TryGetProperty("actualLength", out var al) ? al.GetInt32() : -1;
                var expectedLen = result.TryGetProperty("expectedLength", out var el) ? el.GetInt32() : -1;
                _logger.LogWarning("[STYLES] Failed at step '{Step}': {Error}, actualLen={Actual}, expectedLen={Expected}",
                    step, error, actualLen, expectedLen);
                return false;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[STYLES] Exception while entering styles");
            ErrorOccurred?.Invoke(this, $"Failed to enter styles: {ex.Message}");
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

    public async Task<bool> SetVocalGenderAsync(string gender)
    {
        EnsureInitialized();

        if (string.IsNullOrWhiteSpace(gender))
        {
            _logger.LogDebug("[GENDER] Gender is empty, skipping");
            return true;
        }

        try
        {
            var normalizedGender = gender.Trim().ToLowerInvariant();
            var isFemale = normalizedGender.Contains("female") || normalizedGender == "f";
            var isMale = normalizedGender.Contains("male") || normalizedGender == "m";

            if (!isFemale && !isMale)
            {
                _logger.LogWarning("[GENDER] Unknown gender value: {Gender}, defaulting to female", gender);
                isFemale = true;
            }

            var targetGender = isFemale ? "female" : "male";
            _logger.LogInformation("[GENDER] Setting vocal gender to: {Gender}", targetGender);

            var script = @"
                (function() {
                    console.log('[GENDER] Looking for vocal gender buttons');
                    const targetGender = '" + targetGender + @"';

                    // Method 1: Look for buttons/tabs with Male/Female text
                    const allElements = document.querySelectorAll('button, [role=""tab""], [role=""radio""], div[class*=""button""], span[class*=""button""]');

                    for (const el of allElements) {
                        const text = (el.textContent || '').trim().toLowerCase();
                        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();

                        // Check if this is the target gender button
                        if (text === targetGender || text.includes(targetGender) ||
                            ariaLabel === targetGender || ariaLabel.includes(targetGender)) {

                            // Check if already selected using multiple methods
                            const computedBg = getComputedStyle(el).backgroundColor;
                            const hasHighlightBg = computedBg && computedBg !== 'rgba(0, 0, 0, 0)' && computedBg !== 'transparent';

                            const isSelected = el.classList.contains('selected') ||
                                              el.classList.contains('active') ||
                                              el.getAttribute('aria-checked') === 'true' ||
                                              el.getAttribute('aria-selected') === 'true' ||
                                              el.getAttribute('data-state') === 'active' ||
                                              el.getAttribute('data-state') === 'on' ||
                                              el.getAttribute('aria-pressed') === 'true';

                            // Also check if the OTHER gender button looks unselected
                            const otherGender = targetGender === 'female' ? 'male' : 'female';
                            let otherButton = null;
                            for (const other of allElements) {
                                const otherText = (other.textContent || '').trim().toLowerCase();
                                if (otherText === otherGender || otherText.includes(otherGender)) {
                                    otherButton = other;
                                    break;
                                }
                            }

                            // If other button exists, compare backgrounds
                            let isSelectedByComparison = false;
                            if (otherButton) {
                                const otherBg = getComputedStyle(otherButton).backgroundColor;
                                isSelectedByComparison = hasHighlightBg && otherBg !== computedBg;
                            }

                            const finalIsSelected = isSelected || isSelectedByComparison;

                            console.log('[GENDER] Found ' + targetGender + ' button, isSelected=' + finalIsSelected + ' (attrs=' + isSelected + ', bgCompare=' + isSelectedByComparison + ')');

                            if (!finalIsSelected) {
                                console.log('[GENDER] Clicking ' + targetGender + ' button');
                                el.click();
                                return { success: true, clicked: targetGender };
                            } else {
                                console.log('[GENDER] ' + targetGender + ' already selected, skipping click');
                                return { success: true, alreadySelected: true };
                            }
                        }
                    }

                    // Method 2: Look for radio inputs or checkboxes
                    const radioInputs = document.querySelectorAll('input[type=""radio""], input[type=""checkbox""]');
                    for (const input of radioInputs) {
                        const label = input.closest('label') || document.querySelector('label[for=""' + input.id + '""]');
                        const labelText = (label?.textContent || '').toLowerCase();
                        const inputValue = (input.value || '').toLowerCase();
                        const inputName = (input.name || '').toLowerCase();

                        if (labelText.includes(targetGender) || inputValue === targetGender ||
                            (inputName.includes('gender') && inputValue === targetGender)) {
                            if (!input.checked) {
                                input.click();
                                console.log('[GENDER] Clicked radio/checkbox for ' + targetGender);
                                return { success: true, clicked: targetGender, method: 'radio' };
                            } else {
                                console.log('[GENDER] ' + targetGender + ' radio already checked');
                                return { success: true, alreadySelected: true };
                            }
                        }
                    }

                    // Method 3: Look for Vocal Gender section and find buttons within
                    const labels = document.querySelectorAll('label, span, div, p');
                    for (const label of labels) {
                        const text = (label.textContent || '').trim().toLowerCase();
                        if (text.includes('vocal') && text.includes('gender')) {
                            // Found the section, look for gender buttons in parent or sibling
                            const container = label.closest('div[class]') || label.parentElement?.parentElement;
                            if (container) {
                                const buttons = container.querySelectorAll('button, [role=""tab""], [role=""radio""]');
                                for (const btn of buttons) {
                                    const btnText = (btn.textContent || '').trim().toLowerCase();
                                    if (btnText === targetGender || btnText.includes(targetGender)) {
                                        // Check if already selected before clicking
                                        const isSelected = btn.classList.contains('selected') ||
                                                          btn.classList.contains('active') ||
                                                          btn.getAttribute('aria-checked') === 'true' ||
                                                          btn.getAttribute('aria-selected') === 'true' ||
                                                          btn.getAttribute('data-state') === 'active' ||
                                                          btn.getAttribute('data-state') === 'on' ||
                                                          getComputedStyle(btn).backgroundColor !== getComputedStyle(document.body).backgroundColor;

                                        if (!isSelected) {
                                            btn.click();
                                            console.log('[GENDER] Clicked ' + targetGender + ' in Vocal Gender section');
                                            return { success: true, clicked: targetGender, method: 'section' };
                                        } else {
                                            console.log('[GENDER] ' + targetGender + ' already selected in section');
                                            return { success: true, alreadySelected: true, method: 'section' };
                                        }
                                    }
                                }
                            }
                        }
                    }

                    console.log('[GENDER] Could not find gender selection controls');
                    return { success: false, error: 'Gender selection controls not found' };
                })();
            ";

            var result = await ExecuteScriptAsync<JsonElement>(script);

            if (result.TryGetProperty("success", out var successProp) && successProp.GetBoolean())
            {
                var alreadySelected = result.TryGetProperty("alreadySelected", out var as2) && as2.GetBoolean();
                if (alreadySelected)
                {
                    _logger.LogInformation("[GENDER] Vocal gender {Gender} was already selected", targetGender);
                }
                else
                {
                    _logger.LogInformation("[GENDER] Successfully set vocal gender to {Gender}", targetGender);
                }
                return true;
            }
            else
            {
                var error = result.TryGetProperty("error", out var ep) ? ep.GetString() : "Unknown error";
                _logger.LogWarning("[GENDER] Failed to set vocal gender: {Error}", error);
                return false;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[GENDER] Exception while setting vocal gender");
            ErrorOccurred?.Invoke(this, $"Failed to set vocal gender: {ex.Message}");
            return false;
        }
    }

    public async Task<bool> SetWeirdnessSliderAsync(string weirdness)
    {
        return await SetSliderValueAsync("Weirdness", weirdness);
    }

    public async Task<bool> SetStyleInfluenceSliderAsync(string styleInfluence)
    {
        return await SetSliderValueAsync("Style Influence", styleInfluence);
    }

    private async Task<bool> SetSliderValueAsync(string sliderName, string valueStr)
    {
        EnsureInitialized();

        if (string.IsNullOrWhiteSpace(valueStr))
        {
            _logger.LogDebug("[SLIDER] {SliderName} value is empty, skipping", sliderName);
            return true;
        }

        try
        {
            // Parse the percentage value - remove % symbol if present
            var cleanValue = valueStr.Trim().Replace("%", "").Trim();
            if (!int.TryParse(cleanValue, out var percentage))
            {
                _logger.LogWarning("[SLIDER] Could not parse {SliderName} value: {Value}", sliderName, valueStr);
                return false;
            }

            // Clamp to valid range
            percentage = Math.Max(0, Math.Min(100, percentage));

            _logger.LogInformation("[SLIDER] Setting {SliderName} to {Percentage}% using comprehensive slider detection", sliderName, percentage);

            var sliderNameLower = sliderName.ToLower();

            // DISCOVERY: Suno may use custom slider components, NOT standard input[type="range"]
            // This script searches for multiple types of slider implementations:
            // 1. Standard input[type="range"]
            // 2. Elements with role="slider"
            // 3. Radix UI sliders (common in React apps)
            // 4. Custom div-based sliders with thumb/track structure
            var dragSliderScript = @"
                (async function() {
                    const targetName = '" + sliderNameLower + @"';
                    const targetPercent = " + percentage + @";
                    console.log('[SLIDER] Starting comprehensive slider search for ' + targetName + ' to ' + targetPercent + '%');

                    // DIAGNOSTIC: Log all potential slider elements on the page
                    console.log('[SLIDER] === DIAGNOSTIC SCAN ===');

                    // Check for standard range inputs
                    const rangeInputs = document.querySelectorAll('input[type=""range""]');
                    console.log('[SLIDER] Standard range inputs: ' + rangeInputs.length);
                    rangeInputs.forEach((el, i) => {
                        const rect = el.getBoundingClientRect();
                        console.log('[SLIDER]   Range ' + i + ': ' + rect.width + 'x' + rect.height + ' at (' + Math.round(rect.left) + ',' + Math.round(rect.top) + ')');
                    });

                    // Check for role=""slider"" elements (Radix UI and other accessible sliders)
                    const roleSliders = document.querySelectorAll('[role=""slider""]');
                    console.log('[SLIDER] Role=slider elements: ' + roleSliders.length);
                    roleSliders.forEach((el, i) => {
                        const rect = el.getBoundingClientRect();
                        const ariaVal = el.getAttribute('aria-valuenow');
                        const ariaMin = el.getAttribute('aria-valuemin');
                        const ariaMax = el.getAttribute('aria-valuemax');
                        const parentText = el.parentElement?.parentElement?.parentElement?.textContent?.substring(0, 50) || '';
                        console.log('[SLIDER]   RoleSlider ' + i + ': value=' + ariaVal + ' (min=' + ariaMin + ', max=' + ariaMax + '), parent text: ' + parentText);
                    });

                    // Check for Radix UI slider structure
                    const radixSliders = document.querySelectorAll('[class*=""SliderRoot""], [class*=""slider-root""], [data-radix-slider]');
                    console.log('[SLIDER] Radix-style sliders: ' + radixSliders.length);

                    // Check for any elements with slider in class name
                    const sliderClasses = document.querySelectorAll('[class*=""slider""], [class*=""Slider""]');
                    console.log('[SLIDER] Elements with slider in class: ' + sliderClasses.length);

                    // Log unique class names containing slider
                    const sliderClassSet = new Set();
                    sliderClasses.forEach(el => {
                        el.classList.forEach(c => {
                            if (c.toLowerCase().includes('slider')) sliderClassSet.add(c);
                        });
                    });
                    console.log('[SLIDER] Unique slider classes: ' + Array.from(sliderClassSet).join(', '));

                    console.log('[SLIDER] === END DIAGNOSTIC ===');

                    // Find all slider elements - BOTH standard range inputs AND role=slider elements
                    const allRangeInputs = document.querySelectorAll('input[type=""range""]');
                    const allRoleSliders = document.querySelectorAll('[role=""slider""]');
                    console.log('[SLIDER] Found ' + allRangeInputs.length + ' range inputs, ' + allRoleSliders.length + ' role=slider elements');

                    let targetSlider = null;
                    let targetRoleSlider = null;
                    let foundSectionLabel = null;
                    let sliderType = 'unknown'; // 'range' or 'role'

                    // APPROACH 1: Find by label, then look for EITHER type of slider nearby
                    const allLabels = document.querySelectorAll('span, label, p, div, h3, h4');
                    for (const lbl of allLabels) {
                        const lblText = (lbl.textContent || '').trim().toLowerCase();

                        // Match exact label or close match
                        if (lblText === targetName ||
                            (lblText.includes(targetName) && lblText.length < targetName.length + 15)) {

                            console.log('[SLIDER] Found label: ' + lblText);
                            foundSectionLabel = lbl;

                            // Look for either type of slider in parent hierarchy
                            let searchContainer = lbl.parentElement;
                            for (let i = 0; i < 6 && searchContainer; i++) {
                                // Check for role=""slider"" elements FIRST (Radix UI pattern)
                                const roleSlider = searchContainer.querySelector('[role=""slider""]');
                                if (roleSlider && !roleSlider.hasAttribute('data-jubilee-used')) {
                                    targetRoleSlider = roleSlider;
                                    roleSlider.setAttribute('data-jubilee-used', 'true');
                                    sliderType = 'role';
                                    console.log('[SLIDER] Found role=slider near label in parent level ' + i);
                                    break;
                                }

                                // Check for standard range input
                                const rangeSlider = searchContainer.querySelector('input[type=""range""]');
                                if (rangeSlider && !rangeSlider.hasAttribute('data-jubilee-used')) {
                                    targetSlider = rangeSlider;
                                    rangeSlider.setAttribute('data-jubilee-used', 'true');
                                    sliderType = 'range';
                                    console.log('[SLIDER] Found range input near label in parent level ' + i);
                                    break;
                                }

                                searchContainer = searchContainer.parentElement;
                            }

                            if (targetSlider || targetRoleSlider) break;
                        }
                    }

                    // APPROACH 2: Search role=slider elements by looking at their parent text
                    if (!targetSlider && !targetRoleSlider && allRoleSliders.length > 0) {
                        console.log('[SLIDER] Trying role=slider parent text search');
                        for (const slider of allRoleSliders) {
                            if (slider.hasAttribute('data-jubilee-used')) continue;

                            let searchNode = slider;
                            for (let depth = 0; depth < 6 && searchNode; depth++) {
                                searchNode = searchNode.parentElement;
                                if (!searchNode) break;

                                const containerText = (searchNode.textContent || '').toLowerCase();
                                if (containerText.includes(targetName)) {
                                    // Check if there's a label that specifically matches
                                    const labels = searchNode.querySelectorAll('span, label, p, div');
                                    for (const lbl of labels) {
                                        const lblText = (lbl.textContent || '').trim().toLowerCase();
                                        if (lblText === targetName || (lblText.includes(targetName) && lblText.length < targetName.length + 20)) {
                                            targetRoleSlider = slider;
                                            slider.setAttribute('data-jubilee-used', 'true');
                                            sliderType = 'role';
                                            console.log('[SLIDER] Found role=slider via parent text at depth ' + depth);
                                            break;
                                        }
                                    }
                                    if (targetRoleSlider) break;
                                }
                            }
                            if (targetRoleSlider) break;
                        }
                    }

                    // APPROACH 3: Fallback - search standard range inputs
                    if (!targetSlider && !targetRoleSlider) {
                        console.log('[SLIDER] Trying fallback range input search');
                        for (const slider of allRangeInputs) {
                            if (slider.hasAttribute('data-jubilee-used')) continue;

                            let searchNode = slider;
                            for (let depth = 0; depth < 8 && searchNode; depth++) {
                                searchNode = searchNode.parentElement;
                                if (!searchNode) break;

                                const allText = (searchNode.textContent || '').toLowerCase();
                                if (allText.includes(targetName)) {
                                    const labels = searchNode.querySelectorAll('span, label, p, div');
                                    for (const lbl of labels) {
                                        const lblText = (lbl.textContent || '').trim().toLowerCase();
                                        if (lblText === targetName || (lblText.includes(targetName) && lblText.length < targetName.length + 20)) {
                                            targetSlider = slider;
                                            slider.setAttribute('data-jubilee-used', 'true');
                                            sliderType = 'range';
                                            break;
                                        }
                                    }
                                    if (targetSlider) break;
                                }
                            }
                            if (targetSlider) break;
                        }
                    }

                    // Determine which slider we're working with
                    const activeSlider = targetRoleSlider || targetSlider;

                    if (!activeSlider) {
                        console.log('[SLIDER] Could not find slider for: ' + targetName);
                        return { success: false, error: 'Slider not found for: ' + targetName, sliderType: 'none' };
                    }

                    // Scroll the slider into view
                    activeSlider.scrollIntoView({ behavior: 'instant', block: 'center' });
                    console.log('[SLIDER] Found ' + targetName + ' slider (type=' + sliderType + '), scrolled into view');

                    // Get slider properties - different for role=slider vs input[type=range]
                    let min, max, step, currentValue;

                    if (sliderType === 'role') {
                        // Radix UI / ARIA sliders use aria-* attributes
                        min = parseFloat(activeSlider.getAttribute('aria-valuemin') || '0');
                        max = parseFloat(activeSlider.getAttribute('aria-valuemax') || '100');
                        step = 1; // Usually no step attribute on role sliders
                        currentValue = parseFloat(activeSlider.getAttribute('aria-valuenow') || '0');
                        console.log('[SLIDER] Role slider: min=' + min + ', max=' + max + ', current=' + currentValue);
                    } else {
                        // Standard range input
                        min = parseFloat(activeSlider.min || '0');
                        max = parseFloat(activeSlider.max || '100');
                        step = parseFloat(activeSlider.step || '1');
                        currentValue = parseFloat(activeSlider.value);
                    }

                    // Calculate target based on percentage of the ACTUAL range
                    const newValue = min + (targetPercent / 100) * (max - min);
                    const steppedValue = Math.round(newValue / (step || 1)) * (step || 1);

                    console.log('[SLIDER] Current: ' + currentValue + ', Target: ' + steppedValue + ', min=' + min + ', max=' + max);

                    // Find the track container for coordinate calculations
                    let trackContainer = activeSlider.parentElement;
                    for (let i = 0; i < 6 && trackContainer; i++) {
                        const rect = trackContainer.getBoundingClientRect();
                        // Look for a container that's reasonably wide (at least 100px)
                        if (rect.width >= 100) {
                            console.log('[SLIDER] Found track container at level ' + i + ' with width ' + rect.width);
                            break;
                        }
                        trackContainer = trackContainer.parentElement;
                    }

                    // Get the track container's rect for coordinate calculations
                    const containerRect = trackContainer ? trackContainer.getBoundingClientRect() : activeSlider.getBoundingClientRect();
                    const trackWidth = containerRect.width;
                    const trackHeight = containerRect.height;

                    // Calculate the X position for the target value
                    const valuePercent = (steppedValue - min) / (max - min);
                    const targetX = containerRect.left + (trackWidth * valuePercent);
                    const centerY = containerRect.top + (trackHeight / 2);

                    // Current thumb position
                    const currentPercent = (currentValue - min) / (max - min);
                    const currentX = containerRect.left + (trackWidth * currentPercent);

                    console.log('[SLIDER] Track container: left=' + containerRect.left + ', width=' + trackWidth);
                    console.log('[SLIDER] Current X: ' + currentX + ', Target X: ' + targetX + ', Y: ' + centerY);

                    // For role=slider, the thumb IS the activeSlider element
                    // For range input, we need to find the thumb
                    let thumbEl, trackEl, eventTarget;

                    if (sliderType === 'role') {
                        thumbEl = activeSlider; // The role=slider element IS the thumb
                        trackEl = trackContainer?.querySelector('[class*=""track""], [class*=""Track""], [class*=""rail""], [class*=""Rail""]');
                        eventTarget = activeSlider;
                    } else {
                        thumbEl = trackContainer?.querySelector('[class*=""thumb""], [class*=""Thumb""], [class*=""handle""], [role=""slider""]');
                        trackEl = trackContainer?.querySelector('[class*=""track""], [class*=""Track""], [class*=""rail""], [class*=""Rail""]');
                        eventTarget = thumbEl || trackEl || trackContainer || activeSlider;
                    }

                    console.log('[SLIDER] Event target: ' + eventTarget.tagName + (eventTarget.className ? '.' + String(eventTarget.className).split(' ')[0] : ''));

                    // Helper to create PointerEvent
                    function createPointerEvent(type, x, y) {
                        return new PointerEvent(type, {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                            pointerId: 1,
                            pointerType: 'mouse',
                            isPrimary: true,
                            clientX: x,
                            clientY: y,
                            screenX: x,
                            screenY: y,
                            button: 0,
                            buttons: type === 'pointerup' ? 0 : 1,
                            pressure: type === 'pointerup' ? 0 : 0.5
                        });
                    }

                    // Helper to create MouseEvent
                    function createMouseEvent(type, x, y) {
                        return new MouseEvent(type, {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                            clientX: x,
                            clientY: y,
                            screenX: x,
                            screenY: y,
                            button: 0,
                            buttons: type === 'mouseup' ? 0 : 1
                        });
                    }

                    // Helper function to get current slider value (works for both types)
                    function getSliderValue() {
                        if (sliderType === 'role') {
                            return parseFloat(activeSlider.getAttribute('aria-valuenow') || '0');
                        } else {
                            return parseFloat(activeSlider.value);
                        }
                    }

                    try {
                        // METHOD 1: Try direct click on the track at target position
                        console.log('[SLIDER] Method 1: Direct click at target position');

                        // Dispatch click sequence at target position on the track
                        const clickTarget = trackEl || trackContainer || eventTarget;
                        clickTarget.dispatchEvent(createPointerEvent('pointerdown', targetX, centerY));
                        clickTarget.dispatchEvent(createMouseEvent('mousedown', targetX, centerY));
                        clickTarget.dispatchEvent(createPointerEvent('pointerup', targetX, centerY));
                        clickTarget.dispatchEvent(createMouseEvent('mouseup', targetX, centerY));
                        clickTarget.dispatchEvent(createMouseEvent('click', targetX, centerY));

                        // Check if value changed
                        let checkValue = getSliderValue();
                        if (Math.abs(checkValue - steppedValue) < (step || 1)) {
                            console.log('[SLIDER] Method 1 SUCCESS - value is now: ' + checkValue);
                            return { success: true, method: 'click', finalValue: checkValue, targetValue: steppedValue, sliderType: sliderType };
                        }

                        // METHOD 2: For Radix UI sliders, we need to click on the TRACK at the target position
                        // This is how users actually interact with sliders - clicking where they want the value
                        console.log('[SLIDER] Method 2: Click on track at target position (Radix pattern)');

                        // Find the track element (the background bar of the slider)
                        const sliderTrack = trackContainer?.querySelector('[class*=""Track""], [class*=""track""], [data-orientation]') || trackContainer;
                        console.log('[SLIDER] Clicking on track: ' + (sliderTrack?.tagName || 'none'));

                        if (sliderTrack) {
                            const trackRect = sliderTrack.getBoundingClientRect();
                            const clickX = trackRect.left + (trackRect.width * valuePercent);
                            const clickY = trackRect.top + trackRect.height / 2;

                            console.log('[SLIDER] Track click position: X=' + clickX + ', Y=' + clickY);

                            // Simulate a complete click sequence on the track
                            sliderTrack.dispatchEvent(createPointerEvent('pointerdown', clickX, clickY));
                            sliderTrack.dispatchEvent(createMouseEvent('mousedown', clickX, clickY));

                            // Small move to simulate natural interaction
                            sliderTrack.dispatchEvent(createPointerEvent('pointermove', clickX, clickY));

                            sliderTrack.dispatchEvent(createPointerEvent('pointerup', clickX, clickY));
                            sliderTrack.dispatchEvent(createMouseEvent('mouseup', clickX, clickY));
                            sliderTrack.dispatchEvent(createMouseEvent('click', clickX, clickY));
                        }

                        // Wait a tiny moment and check
                        await new Promise(r => setTimeout(r, 50));
                        checkValue = getSliderValue();
                        console.log('[SLIDER] After track click, value: ' + checkValue);

                        if (Math.abs(checkValue - steppedValue) < (step || 1) + 5) {
                            console.log('[SLIDER] Method 2 SUCCESS - value is now: ' + checkValue);
                            return { success: true, method: 'track_click', finalValue: checkValue, targetValue: steppedValue, sliderType: sliderType };
                        }

                        // METHOD 3: Full drag simulation on the thumb element itself
                        console.log('[SLIDER] Method 3: Full drag sequence on thumb');

                        // For Radix, the thumb is the role=slider element
                        const thumbElement = sliderType === 'role' ? activeSlider : (thumbEl || eventTarget);
                        const thumbRect = thumbElement.getBoundingClientRect();
                        const startX = thumbRect.left + thumbRect.width / 2;
                        const startY = thumbRect.top + thumbRect.height / 2;

                        console.log('[SLIDER] Dragging thumb from X=' + startX + ' to X=' + targetX);

                        // Focus the thumb first
                        thumbElement.focus();

                        // Start drag at thumb center
                        thumbElement.dispatchEvent(createPointerEvent('pointerdown', startX, startY));
                        thumbElement.dispatchEvent(createMouseEvent('mousedown', startX, startY));

                        // Smooth drag to target
                        const dragSteps = 20;
                        for (let i = 1; i <= dragSteps; i++) {
                            const progress = i / dragSteps;
                            const moveX = startX + (targetX - startX) * progress;
                            thumbElement.dispatchEvent(createPointerEvent('pointermove', moveX, startY));
                            thumbElement.dispatchEvent(createMouseEvent('mousemove', moveX, startY));
                        }

                        // End drag
                        thumbElement.dispatchEvent(createPointerEvent('pointerup', targetX, startY));
                        thumbElement.dispatchEvent(createMouseEvent('mouseup', targetX, startY));
                        thumbElement.blur();

                        await new Promise(r => setTimeout(r, 50));
                        checkValue = getSliderValue();
                        console.log('[SLIDER] After drag, value: ' + checkValue);

                        if (Math.abs(checkValue - steppedValue) < (step || 1) + 5) {
                            console.log('[SLIDER] Method 3 SUCCESS - value is now: ' + checkValue);
                            return { success: true, method: 'drag', finalValue: checkValue, targetValue: steppedValue, sliderType: sliderType };
                        }

                        // METHOD 4: Keyboard arrow keys (Radix sliders respond to keyboard)
                        // This is the MOST RELIABLE method for Radix sliders
                        console.log('[SLIDER] Method 4: Keyboard arrow key simulation');

                        // Use the thumb element for focus
                        const focusElement = sliderType === 'role' ? activeSlider : (thumbEl || eventTarget);
                        focusElement.focus();

                        // Re-read current value since it may have changed
                        const currentVal = getSliderValue();
                        const diff = steppedValue - currentVal;
                        const keyCode = diff > 0 ? 39 : 37; // Right or Left arrow
                        const keyName = diff > 0 ? 'ArrowRight' : 'ArrowLeft';
                        const numPresses = Math.abs(Math.round(diff));

                        console.log('[SLIDER] Current=' + currentVal + ', Target=' + steppedValue + ', pressing ' + keyName + ' ' + numPresses + ' times');

                        // Press arrow keys with delay after EACH press for React to process
                        for (let i = 0; i < Math.min(numPresses, 100); i++) {
                            focusElement.dispatchEvent(new KeyboardEvent('keydown', {
                                key: keyName,
                                code: keyName,
                                keyCode: keyCode,
                                which: keyCode,
                                bubbles: true,
                                cancelable: true
                            }));
                            focusElement.dispatchEvent(new KeyboardEvent('keyup', {
                                key: keyName,
                                code: keyName,
                                keyCode: keyCode,
                                which: keyCode,
                                bubbles: true,
                                cancelable: true
                            }));

                            // CRITICAL: Delay after EACH keypress so React can process state update
                            await new Promise(r => setTimeout(r, 20));
                        }

                        await new Promise(r => setTimeout(r, 100));
                        checkValue = getSliderValue();
                        console.log('[SLIDER] After keyboard, value: ' + checkValue + ' (target was ' + steppedValue + ')');

                        if (Math.abs(checkValue - steppedValue) <= 5) {
                            console.log('[SLIDER] Method 4 SUCCESS - value is now: ' + checkValue);
                            return { success: true, method: 'keyboard', finalValue: checkValue, targetValue: steppedValue, sliderType: sliderType };
                        }

                        // If keyboard didn't get close enough, try a few more times in a loop
                        let attempts = 0;
                        while (Math.abs(checkValue - steppedValue) > 1 && attempts < 3) {
                            attempts++;
                            const remaining = steppedValue - checkValue;
                            const kc = remaining > 0 ? 39 : 37;
                            const kn = remaining > 0 ? 'ArrowRight' : 'ArrowLeft';
                            const presses = Math.min(Math.abs(Math.round(remaining)), 50);

                            console.log('[SLIDER] Correction attempt ' + attempts + ': pressing ' + kn + ' ' + presses + ' times');

                            for (let i = 0; i < presses; i++) {
                                focusElement.dispatchEvent(new KeyboardEvent('keydown', {
                                    key: kn, code: kn, keyCode: kc, which: kc, bubbles: true, cancelable: true
                                }));
                                focusElement.dispatchEvent(new KeyboardEvent('keyup', {
                                    key: kn, code: kn, keyCode: kc, which: kc, bubbles: true, cancelable: true
                                }));
                                // Delay after EACH keypress for React
                                await new Promise(r => setTimeout(r, 20));
                            }

                            await new Promise(r => setTimeout(r, 50));
                            checkValue = getSliderValue();
                            console.log('[SLIDER] After correction ' + attempts + ', value: ' + checkValue);
                        }

                        // METHOD 4: For range input, try React _valueTracker hack
                        if (sliderType === 'range' && activeSlider.tagName === 'INPUT') {
                            console.log('[SLIDER] Method 4: React _valueTracker hack');

                            activeSlider.focus();
                            const lastValue = activeSlider.value;
                            activeSlider.value = steppedValue;

                            const tracker = activeSlider._valueTracker;
                            if (tracker) {
                                console.log('[SLIDER] Found _valueTracker, resetting');
                                tracker.setValue(lastValue);
                            }

                            activeSlider.dispatchEvent(new Event('input', { bubbles: true }));
                            activeSlider.dispatchEvent(new Event('change', { bubbles: true }));

                            checkValue = getSliderValue();
                            if (Math.abs(checkValue - steppedValue) < (step || 1)) {
                                console.log('[SLIDER] Method 4 SUCCESS - value is now: ' + checkValue);
                                return { success: true, method: 'valueTracker', finalValue: checkValue, targetValue: steppedValue, sliderType: sliderType };
                            }

                            // METHOD 5: Native setter + _valueTracker combination
                            console.log('[SLIDER] Method 5: Native setter + _valueTracker');

                            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                            const lastValue2 = activeSlider.value;
                            nativeSetter.call(activeSlider, steppedValue);

                            const tracker2 = activeSlider._valueTracker;
                            if (tracker2) {
                                tracker2.setValue(lastValue2);
                            }

                            activeSlider.dispatchEvent(new Event('input', { bubbles: true }));
                            activeSlider.dispatchEvent(new Event('change', { bubbles: true }));
                            activeSlider.blur();

                            checkValue = getSliderValue();
                        }

                        console.log('[SLIDER] Final value: ' + checkValue + ' (target was ' + steppedValue + ')');

                        const tolerance = (step || 1) * 2;
                        const isClose = Math.abs(checkValue - steppedValue) <= tolerance;

                        return {
                            success: isClose,
                            method: 'all_methods',
                            finalValue: checkValue,
                            targetValue: steppedValue,
                            tolerance: tolerance,
                            sliderType: sliderType
                        };

                    } catch (e) {
                        console.log('[SLIDER] Error during slider manipulation: ' + e.message);
                        return { success: false, error: e.message, sliderType: sliderType };
                    }
                })();
            ";

            var result = await ExecuteScriptAsync<JsonElement>(dragSliderScript);

            if (result.TryGetProperty("success", out var successProp) && successProp.GetBoolean())
            {
                var method = result.TryGetProperty("method", out var mp) ? mp.GetString() : "unknown";
                var finalValue = result.TryGetProperty("finalValue", out var fv) ? fv.GetDouble() : -1;
                var targetValue = result.TryGetProperty("targetValue", out var tv) ? tv.GetDouble() : -1;
                _logger.LogInformation("[SLIDER] {SliderName} SUCCESS via {Method}: final={Final}, target={Target}",
                    sliderName, method, finalValue, targetValue);
                return true;
            }
            else
            {
                var error = result.TryGetProperty("error", out var ep) ? ep.GetString() : "Unknown error";
                _logger.LogWarning("[SLIDER] Failed to set {SliderName}: {Error}", sliderName, error);
                return false;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[SLIDER] Exception while setting {SliderName}", sliderName);
            return false;
        }
    }

    public async Task<bool> EnterTitleAsync(string title)
    {
        EnsureInitialized();

        try
        {
            _logger.LogInformation("[TITLE] Starting to enter title: {Title}", title);

            // Single unified script that finds the element AND sets the value atomically
            // This prevents the race condition where activeElement changes between find and set
            var script = $@"
                (function() {{
                    console.log('[TITLE] Starting title insertion');

                    // Find all inputs that could be the title field
                    const allInputs = Array.from(document.querySelectorAll('input[type=""text""], input:not([type])'));

                    console.log('[TITLE] Found ' + allInputs.length + ' input fields');

                    let titleField = null;

                    // IMPORTANT: Filter out any element already marked
                    const availableFields = allInputs.filter(el => {{
                        const marker = el.getAttribute('data-jubilee-field');
                        if (marker) {{
                            console.log('[TITLE] Skipping element marked as: ' + marker);
                            return false;
                        }}
                        return true;
                    }});

                    console.log('[TITLE] ' + availableFields.length + ' fields available after filtering');

                    // Method 1: Find by placeholder containing 'title', 'name', or 'song'
                    for (const el of availableFields) {{
                        const placeholder = (el.placeholder || el.getAttribute('placeholder') || '').toLowerCase();
                        console.log('[TITLE] Checking input with placeholder: ' + placeholder);
                        if (placeholder.includes('title') || placeholder.includes('song name') ||
                            placeholder.includes('name your') || placeholder.includes('track name')) {{
                            titleField = el;
                            console.log('[TITLE] Found by placeholder: ' + placeholder);
                            break;
                        }}
                    }}

                    // Method 2: Look for input near a 'Title' label
                    if (!titleField) {{
                        const labels = document.querySelectorAll('label, span, div, p');
                        for (const label of labels) {{
                            const text = (label.textContent || '').trim().toLowerCase();
                            if ((text === 'title' || text.startsWith('title') || text.includes('song name')) && text.length < 30) {{
                                // Look for input in same container or nearby
                                const container = label.closest('div[class]') || label.parentElement;
                                if (container) {{
                                    const field = container.querySelector('input[type=""text""], input:not([type])');
                                    if (field && !field.getAttribute('data-jubilee-field')) {{
                                        titleField = field;
                                        console.log('[TITLE] Found near label: ' + text);
                                        break;
                                    }}
                                }}
                            }}
                        }}
                    }}

                    // Method 3: Title is often at the bottom - look for unmarked input in later DOM position
                    if (!titleField && availableFields.length > 0) {{
                        // Use the last available input (title often at bottom of form)
                        titleField = availableFields[availableFields.length - 1];
                        console.log('[TITLE] Using last available input field');
                    }}

                    if (!titleField) {{
                        console.log('[TITLE] No title field found - this may be intentional as title is optional');
                        return {{ success: false, error: 'No title field found', fieldCount: availableFields.length }};
                    }}

                    // Mark this element as title field for tracking
                    titleField.setAttribute('data-jubilee-field', 'title');

                    // Now set the value using React-compatible method
                    try {{
                        titleField.focus();
                        titleField.select();

                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                            window.HTMLInputElement.prototype,
                            'value'
                        ).set;
                        nativeInputValueSetter.call(titleField, {JsonSerializer.Serialize(title)});

                        titleField.dispatchEvent(new Event('input', {{ bubbles: true, cancelable: true }}));
                        titleField.dispatchEvent(new Event('change', {{ bubbles: true, cancelable: true }}));

                        // Blur to trigger any onBlur handlers
                        titleField.blur();

                        console.log('[TITLE] Successfully set title value');
                        return {{ success: true, placeholder: titleField.placeholder || 'none' }};
                    }} catch (e) {{
                        console.log('[TITLE] ERROR setting value: ' + e.message);
                        return {{ success: false, error: e.message }};
                    }}
                }})();
            ";

            var result = await ExecuteScriptAsync<JsonElement>(script);

            if (result.TryGetProperty("success", out var successProp) && successProp.GetBoolean())
            {
                _logger.LogInformation("[TITLE] Successfully inserted title");
                return true;
            }
            else
            {
                var error = result.TryGetProperty("error", out var errorProp) ? errorProp.GetString() : "Unknown error";
                _logger.LogWarning("[TITLE] Failed to insert title: {Error}", error);
                // Don't invoke error - title is optional
                return false;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TITLE] Exception while entering title");
            ErrorOccurred?.Invoke(this, $"Failed to enter title: {ex.Message}");
            return false;
        }
    }

    public async Task<bool> SelectOrCreateWorkspaceAsync(string workspaceName)
    {
        EnsureInitialized();

        try
        {
            _logger.LogInformation("[WORKSPACE] Starting workspace selection/creation for: {Name}", workspaceName);

            // Step 1: Click on workspace button to open the workspace panel
            var clickWorkspaceScript = @"
                (function() {
                    console.log('[WORKSPACE] Looking for workspace button');

                    // Helper function to find clickable element
                    function findClickableParent(el) {
                        let current = el;
                        for (let i = 0; i < 5 && current; i++) {
                            if (current.onclick || current.tagName === 'BUTTON' ||
                                current.getAttribute('role') === 'button' ||
                                getComputedStyle(current).cursor === 'pointer') {
                                return current;
                            }
                            current = current.parentElement;
                        }
                        return el;
                    }

                    // Find the workspace button (shows 'My Workspace' or similar)
                    const allElements = document.querySelectorAll('button, [role=""button""], div, span');
                    for (const el of allElements) {
                        const text = (el.textContent || '').trim();
                        if ((text.includes('My Workspace') || text === 'Workspace' ||
                             (text.includes('Workspace') && text.length < 40)) &&
                            !text.includes('Create') && !text.includes('New')) {
                            const clickable = findClickableParent(el);
                            clickable.click();
                            console.log('[WORKSPACE] Clicked workspace button: ' + text);
                            return { success: true, clicked: text };
                        }
                    }

                    console.log('[WORKSPACE] ERROR: Workspace button not found');
                    return { success: false, error: 'Workspace button not found' };
                })();
            ";

            var clickResult = await ExecuteScriptAsync<JsonElement>(clickWorkspaceScript);
            if (!clickResult.TryGetProperty("success", out var clickSuccess) || !clickSuccess.GetBoolean())
            {
                _logger.LogWarning("[WORKSPACE] Could not find workspace button");
                return false;
            }

            await Task.Delay(800); // Wait for panel to open

            // Step 2: Look for existing workspace or Create New Workspace option
            var targetNameLower = workspaceName.ToLowerInvariant().Trim();
            var findWorkspaceScript = $@"
                (function() {{
                    console.log('[WORKSPACE] Looking for workspace or Create New option');
                    const targetName = '{EscapeJsString(targetNameLower)}';

                    // Helper function
                    function findClickableParent(el) {{
                        let current = el;
                        for (let i = 0; i < 5 && current; i++) {{
                            if (current.onclick || current.tagName === 'BUTTON' ||
                                current.getAttribute('role') === 'button' ||
                                getComputedStyle(current).cursor === 'pointer') {{
                                return current;
                            }}
                            current = current.parentElement;
                        }}
                        return el;
                    }}

                    const allElements = document.querySelectorAll('div, span, button, a, li');
                    let createNewFound = false;

                    for (const el of allElements) {{
                        const text = (el.textContent || '').trim();
                        const lowerText = text.toLowerCase();
                        const firstLine = text.split('\\n')[0].trim().toLowerCase();

                        // Check for exact workspace match
                        if (firstLine === targetName && !lowerText.includes('create')) {{
                            const clickable = findClickableParent(el);
                            clickable.click();
                            console.log('[WORKSPACE] Found and clicked existing workspace: ' + text);
                            return {{ success: true, action: 'selected', workspace: firstLine }};
                        }}

                        // Remember if we found Create New Workspace
                        if (lowerText.includes('create') && lowerText.includes('workspace')) {{
                            createNewFound = true;
                        }}
                    }}

                    // If workspace not found, click Create New Workspace
                    if (createNewFound) {{
                        for (const el of allElements) {{
                            const text = (el.textContent || '').trim().toLowerCase();
                            if (text.includes('create') && text.includes('workspace')) {{
                                const clickable = findClickableParent(el);
                                clickable.click();
                                console.log('[WORKSPACE] Clicked Create New Workspace');
                                return {{ success: true, action: 'create_new' }};
                            }}
                        }}
                    }}

                    return {{ success: false, error: 'Neither workspace nor Create New found' }};
                }})();
            ";

            var findResult = await ExecuteScriptAsync<JsonElement>(findWorkspaceScript);
            if (!findResult.TryGetProperty("success", out var findSuccess) || !findSuccess.GetBoolean())
            {
                _logger.LogWarning("[WORKSPACE] Could not find workspace or Create New option");
                return false;
            }

            // Check if we selected existing workspace
            if (findResult.TryGetProperty("action", out var action) && action.GetString() == "selected")
            {
                _logger.LogInformation("[WORKSPACE] Selected existing workspace");
                return true;
            }

            // If we clicked Create New, we need to type the name
            await Task.Delay(600); // Wait for dialog

            // Step 3: Focus on the input field
            var focusInputScript = @"
                (function() {
                    console.log('[WORKSPACE] Looking for name input field');

                    // Try to find and focus the input
                    const inputs = document.querySelectorAll('input[type=""text""], input:not([type])');
                    for (const inp of inputs) {
                        const rect = inp.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            inp.focus();
                            inp.select();
                            console.log('[WORKSPACE] Focused input field');
                            return { success: true };
                        }
                    }

                    return { success: false, error: 'No input field found' };
                })();
            ";

            var focusResult = await ExecuteScriptAsync<JsonElement>(focusInputScript);
            if (!focusResult.TryGetProperty("success", out var focusSuccess) || !focusSuccess.GetBoolean())
            {
                _logger.LogWarning("[WORKSPACE] Could not focus input field");
                return false;
            }

            await Task.Delay(100);

            // Step 4: Use SendKeys to type the workspace name
            _logger.LogInformation("[WORKSPACE] Using SendKeys to type workspace name");

            // Escape special SendKeys characters
            var escapedName = workspaceName
                .Replace("+", "{+}")
                .Replace("^", "{^}")
                .Replace("%", "{%}")
                .Replace("~", "{~}")
                .Replace("(", "{(}")
                .Replace(")", "{)}")
                .Replace("{", "{{}}")
                .Replace("}", "{}}");

            SendKeys.SendWait(escapedName);
            await Task.Delay(300);

            // Step 5: Press Enter to confirm
            SendKeys.SendWait("{ENTER}");
            _logger.LogInformation("[WORKSPACE] Pressed Enter to confirm workspace creation");

            await Task.Delay(500);

            _logger.LogInformation("[WORKSPACE] Successfully created workspace '{Name}'", workspaceName);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[WORKSPACE] Exception while selecting/creating workspace");
            ErrorOccurred?.Invoke(this, $"Failed to set workspace: {ex.Message}");
            return false;
        }
    }

    public async Task<bool> SelectSaveToWorkspaceAsync(string workspaceName)
    {
        EnsureInitialized();

        try
        {
            _logger.LogInformation("[SAVE-TO] Selecting workspace '{Name}' from Save to dropdown", workspaceName);

            // Step 1: Make sure the "Save to..." checkbox is checked
            var checkSaveToScript = @"
                (function() {
                    console.log('[SAVE-TO] Looking for Save to checkbox');

                    // Find the Save to checkbox - look for checkbox near 'Save to' text
                    const labels = document.querySelectorAll('label, span, div');
                    for (const label of labels) {
                        const text = (label.textContent || '').trim();
                        if (text.includes('Save to') && text.length < 50) {
                            console.log('[SAVE-TO] Found Save to label: ' + text);

                            // Find nearby checkbox
                            const container = label.closest('div[class]') || label.parentElement?.parentElement;
                            if (container) {
                                const checkbox = container.querySelector('input[type=""checkbox""], [role=""checkbox""], button[aria-checked]');
                                if (checkbox) {
                                    const isChecked = checkbox.checked ||
                                                      checkbox.getAttribute('aria-checked') === 'true' ||
                                                      checkbox.getAttribute('data-state') === 'checked';
                                    if (!isChecked) {
                                        checkbox.click();
                                        console.log('[SAVE-TO] Clicked checkbox to enable Save to');
                                        return { success: true, action: 'checked' };
                                    } else {
                                        console.log('[SAVE-TO] Checkbox already checked');
                                        return { success: true, action: 'already_checked' };
                                    }
                                }
                            }
                        }
                    }

                    // Alternative: Find by checkbox that is near 'Save to' text
                    const checkboxes = document.querySelectorAll('input[type=""checkbox""], [role=""checkbox""], button[aria-checked]');
                    for (const cb of checkboxes) {
                        const parent = cb.closest('div') || cb.parentElement;
                        if (parent && parent.textContent.includes('Save to')) {
                            const isChecked = cb.checked ||
                                              cb.getAttribute('aria-checked') === 'true' ||
                                              cb.getAttribute('data-state') === 'checked';
                            if (!isChecked) {
                                cb.click();
                                console.log('[SAVE-TO] Clicked Save to checkbox (alt method)');
                                return { success: true, action: 'checked' };
                            }
                            return { success: true, action: 'already_checked' };
                        }
                    }

                    console.log('[SAVE-TO] Could not find Save to checkbox');
                    return { success: false, error: 'Save to checkbox not found' };
                })();
            ";

            var checkResult = await ExecuteScriptAsync<JsonElement>(checkSaveToScript);
            _logger.LogDebug("[SAVE-TO] Checkbox result: {Result}", checkResult.ToString());

            await Task.Delay(300);

            // Step 2: Click on the workspace dropdown to open it
            var targetNameLower = workspaceName.ToLowerInvariant().Trim();
            var openDropdownScript = $@"
                (async function() {{
                    console.log('[SAVE-TO] Looking for workspace dropdown');
                    const targetName = '{EscapeJsString(targetNameLower)}';

                    // Find dropdown button/select near 'Save to' area
                    // Look for elements that show current workspace name or have dropdown indicators
                    const dropdowns = document.querySelectorAll('button, [role=""combobox""], [role=""listbox""], select, [class*=""dropdown""], [class*=""select""]');

                    for (const dd of dropdowns) {{
                        const rect = dd.getBoundingClientRect();
                        if (rect.width < 50 || rect.height < 20) continue;

                        const text = (dd.textContent || '').trim().toLowerCase();
                        const parent = dd.closest('div[class]');
                        const parentText = parent ? (parent.textContent || '').toLowerCase() : '';

                        // Check if this dropdown is in the Save to area
                        if (parentText.includes('save to') || text.includes('workspace') ||
                            dd.getAttribute('aria-label')?.toLowerCase().includes('workspace')) {{

                            // Skip if it's just the checkbox
                            if (dd.getAttribute('role') === 'checkbox' || dd.type === 'checkbox') continue;

                            console.log('[SAVE-TO] Found potential dropdown: ' + text.substring(0, 50));
                            dd.click();
                            await new Promise(r => setTimeout(r, 300));
                            return {{ success: true, clicked: text.substring(0, 50) }};
                        }}
                    }}

                    // Alternative: Find button/dropdown that contains a workspace name
                    const allButtons = document.querySelectorAll('button');
                    for (const btn of allButtons) {{
                        const text = (btn.textContent || '').trim();
                        const rect = btn.getBoundingClientRect();

                        // Look for buttons near bottom of form (y > 500) that might be workspace selectors
                        if (rect.top > 500 && rect.width > 80 && rect.height > 20) {{
                            // Check if it looks like a workspace selector (has icon + text)
                            const hasIcon = btn.querySelector('svg, img, [class*=""icon""]');
                            if (hasIcon && text.length < 40 && !text.toLowerCase().includes('create')) {{
                                console.log('[SAVE-TO] Found workspace button (alt): ' + text);
                                btn.click();
                                await new Promise(r => setTimeout(r, 300));
                                return {{ success: true, clicked: text }};
                            }}
                        }}
                    }}

                    console.log('[SAVE-TO] Workspace dropdown not found');
                    return {{ success: false, error: 'Dropdown not found' }};
                }})();
            ";

            var dropdownResult = await ExecuteScriptAsync<JsonElement>(openDropdownScript);
            if (!dropdownResult.TryGetProperty("success", out var dropdownSuccess) || !dropdownSuccess.GetBoolean())
            {
                _logger.LogWarning("[SAVE-TO] Could not find or click workspace dropdown");
                return false;
            }

            await Task.Delay(500); // Wait for dropdown to open

            // Step 3: Select the target workspace from the dropdown list
            var selectWorkspaceScript = $@"
                (function() {{
                    console.log('[SAVE-TO] Looking for workspace option in dropdown');
                    const targetName = '{EscapeJsString(targetNameLower)}';

                    // Find all potential list items in dropdown
                    const options = document.querySelectorAll('[role=""option""], [role=""menuitem""], li, div[class*=""option""], div[class*=""item""]');

                    for (const opt of options) {{
                        const rect = opt.getBoundingClientRect();
                        if (rect.width < 50 || rect.height < 20) continue;

                        const text = (opt.textContent || '').trim();
                        const lowerText = text.toLowerCase();
                        const firstLine = text.split('\\n')[0].trim().toLowerCase();

                        console.log('[SAVE-TO] Checking option: ' + firstLine);

                        // Check for match
                        if (firstLine === targetName || lowerText === targetName ||
                            firstLine.includes(targetName) || targetName.includes(firstLine)) {{
                            opt.click();
                            console.log('[SAVE-TO] Selected workspace: ' + text);
                            return {{ success: true, selected: text }};
                        }}
                    }}

                    // Try looking in portals/modals
                    const portals = document.querySelectorAll('[data-radix-portal], [role=""dialog""], [role=""listbox""], [class*=""dropdown""], [class*=""menu""]');
                    for (const portal of portals) {{
                        const items = portal.querySelectorAll('div, span, li, button');
                        for (const item of items) {{
                            const text = (item.textContent || '').trim();
                            const lowerText = text.toLowerCase();
                            if (lowerText === targetName || text.toLowerCase().includes(targetName)) {{
                                item.click();
                                console.log('[SAVE-TO] Selected workspace from portal: ' + text);
                                return {{ success: true, selected: text }};
                            }}
                        }}
                    }}

                    console.log('[SAVE-TO] Target workspace not found in dropdown');
                    return {{ success: false, error: 'Workspace not in dropdown' }};
                }})();
            ";

            var selectResult = await ExecuteScriptAsync<JsonElement>(selectWorkspaceScript);
            if (!selectResult.TryGetProperty("success", out var selectSuccess) || !selectSuccess.GetBoolean())
            {
                _logger.LogWarning("[SAVE-TO] Could not find workspace '{Name}' in dropdown", workspaceName);
                return false;
            }

            _logger.LogInformation("[SAVE-TO] Successfully selected workspace '{Name}'", workspaceName);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[SAVE-TO] Exception while selecting Save to workspace");
            ErrorOccurred?.Invoke(this, $"Failed to select Save to workspace: {ex.Message}");
            return false;
        }
    }

    public Task<bool> IsOnCreatePageAsync()
    {
        EnsureInitialized();

        try
        {
            var currentUrl = _webView?.Source?.ToString() ?? "";
            return Task.FromResult(currentUrl.Contains("suno.com/create", StringComparison.OrdinalIgnoreCase));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to check if on create page");
            return Task.FromResult(false);
        }
    }

    public async Task<bool> ClickCreateIconAsync()
    {
        EnsureInitialized();

        try
        {
            _logger.LogInformation("[CREATE-ICON] Attempting to click Create icon (musical note with star)");

            // Wait for page to be ready
            await Task.Delay(1500);

            var script = @"
                (function() {
                    console.log('[CREATE-ICON] Searching for Create button...');

                    // Find clickable parent helper
                    function findClickableParent(el) {
                        let current = el;
                        for (let i = 0; i < 5 && current; i++) {
                            if (current.onclick || current.tagName === 'BUTTON' ||
                                current.tagName === 'A' ||
                                current.getAttribute('role') === 'button' ||
                                current.getAttribute('role') === 'tab' ||
                                current.classList.contains('clickable') ||
                                getComputedStyle(current).cursor === 'pointer') {
                                return current;
                            }
                            current = current.parentElement;
                        }
                        return el;
                    }

                    // Method 1: Look for the Create tab/button in the sidebar
                    // Suno uses a sidebar with icons including a 'Create' button
                    const allElements = document.querySelectorAll('a, button, div, span, [role=""tab""], [role=""button""]');

                    for (const el of allElements) {
                        const text = (el.textContent || '').trim().toLowerCase();
                        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
                        const title = (el.getAttribute('title') || '').toLowerCase();
                        const href = (el.getAttribute('href') || '').toLowerCase();

                        // Look for Create link/button
                        if (href.includes('/create') ||
                            text === 'create' ||
                            ariaLabel.includes('create') ||
                            title.includes('create')) {

                            const clickable = findClickableParent(el);
                            console.log('[CREATE-ICON] Found Create element: ' + (el.tagName) + ', text=' + text + ', href=' + href);
                            clickable.click();
                            return { success: true, method: 'direct-create', element: el.tagName };
                        }
                    }

                    // Method 2: Look for SVG with music note or star (icon-based navigation)
                    const svgs = document.querySelectorAll('svg');
                    for (const svg of svgs) {
                        const parent = svg.closest('a, button, [role=""button""], [role=""tab""]');
                        if (parent) {
                            const href = (parent.getAttribute('href') || '').toLowerCase();
                            const ariaLabel = (parent.getAttribute('aria-label') || '').toLowerCase();

                            if (href.includes('/create') || ariaLabel.includes('create')) {
                                console.log('[CREATE-ICON] Found Create via SVG parent');
                                parent.click();
                                return { success: true, method: 'svg-parent', element: 'svg' };
                            }
                        }
                    }

                    // Method 3: Navigate directly if on suno.com
                    if (window.location.hostname.includes('suno.com') && !window.location.pathname.includes('/create')) {
                        console.log('[CREATE-ICON] Navigating directly to /create');
                        window.location.href = 'https://suno.com/create';
                        return { success: true, method: 'direct-navigation', element: 'url' };
                    }

                    console.log('[CREATE-ICON] Create button not found');
                    return { success: false, error: 'Create button not found' };
                })();
            ";

            var result = await ExecuteScriptAsync<System.Text.Json.JsonElement>(script);

            if (result.TryGetProperty("success", out var successProp) && successProp.GetBoolean())
            {
                var method = result.TryGetProperty("method", out var mp) ? mp.GetString() : "unknown";
                _logger.LogInformation("[CREATE-ICON] Successfully clicked Create icon via {Method}", method);
                return true;
            }
            else
            {
                var error = result.TryGetProperty("error", out var ep) ? ep.GetString() : "Unknown error";
                _logger.LogWarning("[CREATE-ICON] Failed to click Create icon: {Error}", error);
                return false;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[CREATE-ICON] Exception while clicking Create icon");
            return false;
        }
    }

    public async Task<bool> InsertIntoCreateFormAsync(string? title, string? style, string? lyrics, bool isInstrumental, string? vocalGender = null, string? weirdness = null, string? styleInfluence = null, string? workspace = null)
    {
        EnsureInitialized();

        try
        {
            // First check if we're on the create page
            if (!await IsOnCreatePageAsync())
            {
                _logger.LogWarning("[FORM] Not on create page, cannot insert form data");
                return false;
            }

            _logger.LogInformation("[FORM] Inserting data into create form - Title: '{Title}', Style: '{Style}' ({StyleLen} chars), Lyrics: ({LyricsLen} chars), Instrumental: {Instrumental}, VocalGender: {Gender}, Weirdness: {Weirdness}, StyleInfluence: {StyleInfluence}, Workspace: {Workspace}",
                title ?? "(empty)", style ?? "(empty)", style?.Length ?? 0, lyrics?.Length ?? 0, isInstrumental, vocalGender ?? "(none)", weirdness ?? "(none)", styleInfluence ?? "(none)", workspace ?? "(none)");

            var success = true;

            // Clear any previous markers first (both field markers and slider-used markers)
            _logger.LogDebug("[FORM] Clearing previous field and slider markers");
            await ExecuteScriptAsync<object>(@"
                document.querySelectorAll('[data-jubilee-field]').forEach(el => el.removeAttribute('data-jubilee-field'));
                document.querySelectorAll('[data-jubilee-used]').forEach(el => el.removeAttribute('data-jubilee-used'));
            ");

            // Wait for DOM to stabilize after clearing markers
            await Task.Delay(100);

            // Insert STYLES FIRST (top textarea in Suno Custom mode)
            if (!string.IsNullOrWhiteSpace(style))
            {
                _logger.LogInformation("[FORM] Inserting style: '{Style}'", style);
                var styleResult = await EnterStylePromptAsync(style);
                if (!styleResult)
                {
                    _logger.LogWarning("[FORM] Failed to insert style");
                    success = false;
                }
                else
                {
                    _logger.LogInformation("[FORM] Style inserted successfully");
                }
                await Task.Delay(300); // Human-like delay between fields
            }
            else
            {
                _logger.LogDebug("[FORM] Style is empty, skipping");
            }

            // Set vocal gender (if not instrumental)
            if (!isInstrumental && !string.IsNullOrWhiteSpace(vocalGender))
            {
                _logger.LogInformation("[FORM] Setting vocal gender: '{Gender}'", vocalGender);
                var genderResult = await SetVocalGenderAsync(vocalGender);
                if (!genderResult)
                {
                    _logger.LogWarning("[FORM] Failed to set vocal gender - control may not exist");
                    // Don't fail the whole operation if gender fails
                }
                else
                {
                    _logger.LogInformation("[FORM] Vocal gender set successfully");
                }
                await Task.Delay(300);
            }

            // Set Weirdness slider
            if (!string.IsNullOrWhiteSpace(weirdness))
            {
                _logger.LogInformation("[FORM] Setting Weirdness: '{Weirdness}'", weirdness);
                var weirdnessResult = await SetWeirdnessSliderAsync(weirdness);
                if (!weirdnessResult)
                {
                    _logger.LogWarning("[FORM] Failed to set Weirdness slider - control may not exist");
                }
                else
                {
                    _logger.LogInformation("[FORM] Weirdness slider set successfully");
                }
                await Task.Delay(300);
            }

            // Set Style Influence slider
            if (!string.IsNullOrWhiteSpace(styleInfluence))
            {
                _logger.LogInformation("[FORM] Setting Style Influence: '{StyleInfluence}'", styleInfluence);
                var styleInfluenceResult = await SetStyleInfluenceSliderAsync(styleInfluence);
                if (!styleInfluenceResult)
                {
                    _logger.LogWarning("[FORM] Failed to set Style Influence slider - control may not exist");
                }
                else
                {
                    _logger.LogInformation("[FORM] Style Influence slider set successfully");
                }
                await Task.Delay(300);
            }

            // Insert LYRICS (bottom textarea in Suno Custom mode)
            if (!isInstrumental && !string.IsNullOrWhiteSpace(lyrics))
            {
                _logger.LogInformation("[FORM] Inserting lyrics ({Length} chars)", lyrics.Length);
                var lyricsResult = await EnterLyricsAsync(lyrics);
                if (!lyricsResult)
                {
                    _logger.LogWarning("[FORM] Failed to insert lyrics");
                    success = false;
                }
                else
                {
                    _logger.LogInformation("[FORM] Lyrics inserted successfully");
                }
                await Task.Delay(300); // Human-like delay between fields
            }
            else
            {
                _logger.LogDebug("[FORM] Lyrics skipped (instrumental={IsInstrumental}, lyrics empty={IsEmpty})",
                    isInstrumental, string.IsNullOrWhiteSpace(lyrics));
            }

            // Insert title LAST (usually at the bottom of create form, input field)
            if (!string.IsNullOrWhiteSpace(title))
            {
                _logger.LogInformation("[FORM] Inserting title: '{Title}'", title);
                var titleResult = await EnterTitleAsync(title);
                if (!titleResult)
                {
                    _logger.LogWarning("[FORM] Failed to insert title - field may not exist on this page");
                    // Don't fail the whole operation if title fails, it's optional
                }
                else
                {
                    _logger.LogInformation("[FORM] Title inserted successfully");
                }
                await Task.Delay(200);
            }

            // Set instrumental mode
            _logger.LogDebug("[FORM] Setting instrumental mode: {Instrumental}", isInstrumental);
            await SetInstrumentalOnlyAsync(isInstrumental);
            await Task.Delay(200);

            // Select workspace from "Save to..." dropdown (at the bottom of form)
            if (!string.IsNullOrWhiteSpace(workspace))
            {
                _logger.LogInformation("[FORM] Selecting Save to workspace: '{Workspace}'", workspace);
                var workspaceResult = await SelectSaveToWorkspaceAsync(workspace);
                if (!workspaceResult)
                {
                    _logger.LogWarning("[FORM] Failed to select Save to workspace - dropdown may not exist or workspace not found");
                    // Don't fail the whole operation if workspace selection fails
                }
                else
                {
                    _logger.LogInformation("[FORM] Save to workspace selected successfully");
                }
                await Task.Delay(200);
            }

            _logger.LogInformation("[FORM] Form data insertion completed, success: {Success}", success);
            return success;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[FORM] Failed to insert into create form");
            ErrorOccurred?.Invoke(this, $"Failed to insert form data: {ex.Message}");
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
