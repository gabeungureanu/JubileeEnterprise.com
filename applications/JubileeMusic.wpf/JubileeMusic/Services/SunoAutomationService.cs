using System;
using System.IO;
using System.Net.Http;
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

    public async Task<bool> InsertIntoCreateFormAsync(string? title, string? style, string? lyrics, bool isInstrumental)
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

            _logger.LogInformation("[FORM] Inserting data into create form - Title: '{Title}', Style: '{Style}' ({StyleLen} chars), Lyrics: ({LyricsLen} chars), Instrumental: {Instrumental}",
                title ?? "(empty)", style ?? "(empty)", style?.Length ?? 0, lyrics?.Length ?? 0, isInstrumental);

            var success = true;

            // Clear any previous markers first
            _logger.LogDebug("[FORM] Clearing previous field markers");
            await ExecuteScriptAsync<object>(@"
                document.querySelectorAll('[data-jubilee-field]').forEach(el => el.removeAttribute('data-jubilee-field'));
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

            // Insert LYRICS SECOND (bottom textarea in Suno Custom mode)
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

            // Set instrumental mode last
            _logger.LogDebug("[FORM] Setting instrumental mode: {Instrumental}", isInstrumental);
            await SetInstrumentalOnlyAsync(isInstrumental);

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
