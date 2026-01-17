using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using JubileeMusic.ViewModels;
using Microsoft.Web.WebView2.Core;

namespace JubileeMusic.Views;

public partial class BrowserView : UserControl
{
    // Win32 API imports for mouse simulation
    [DllImport("user32.dll")]
    private static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, int dwExtraInfo);

    [DllImport("user32.dll")]
    private static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    private static extern bool GetCursorPos(out POINT lpPoint);

    [StructLayout(LayoutKind.Sequential)]
    private struct POINT
    {
        public int X;
        public int Y;
    }

    private const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    private const uint MOUSEEVENTF_LEFTUP = 0x0004;

    private BrowserViewModel? _viewModel;
    private const double CreatorPanelWidth = 320;
    private const double DefaultChatGptPanelWidth = 400;
    private const double MinChatGptPanelWidth = 300;
    private const double SplitterWidth = 5;
    private bool _chatGptWebViewInitialized;
    private bool _sunoNavigationCompleted;
    private bool _createIconClicked;
    private bool _chatGptPromptSubmitted;
    private bool _chatGptResultsScraped;

    public BrowserView()
    {
        InitializeComponent();

        Loaded += async (s, e) =>
        {
            if (DataContext is BrowserViewModel viewModel)
            {
                _viewModel = viewModel;
                _viewModel.PropertyChanged += OnViewModelPropertyChanged;
                _viewModel.ChatGptPromptReady += OnChatGptPromptReady;

                // Set initial panel states without animation
                UpdateCreatorPanelWidth(_viewModel.IsCreatorPanelOpen, animate: false);
                UpdateChatGptPanelWidth(_viewModel.IsChatGptPanelOpen, _viewModel.ChatGptPanelWidth, animate: false);

                // Initialize Suno WebView
                await viewModel.InitializeWebViewAsync(WebView);

                // Subscribe to Suno navigation completion for auto-click Create
                if (WebView.CoreWebView2 != null)
                {
                    WebView.CoreWebView2.NavigationCompleted += OnSunoNavigationCompleted;

                    // Apply saved zoom factor
                    if (_viewModel.SunoZoomFactor > 0 && _viewModel.SunoZoomFactor != 1.0)
                    {
                        WebView.ZoomFactor = _viewModel.SunoZoomFactor;
                        System.Diagnostics.Debug.WriteLine($"[SUNO] Applied saved zoom factor: {_viewModel.SunoZoomFactor}");
                    }

                    // Subscribe to zoom factor changes to save them
                    WebView.ZoomFactorChanged += OnSunoZoomFactorChanged;
                }

                // Initialize ChatGPT WebView if panel is open
                if (_viewModel.IsChatGptPanelOpen)
                {
                    await InitializeChatGptWebViewAsync();
                }

                // Auto-open ChatGPT panel and trigger workflow prompt
                if (_viewModel.CurrentWorkflow != null && !_viewModel.IsChatGptPanelOpen)
                {
                    _viewModel.IsChatGptPanelOpen = true;
                    await InitializeChatGptWebViewAsync();
                }
            }
        };

        Unloaded += (s, e) =>
        {
            if (_viewModel != null)
            {
                _viewModel.PropertyChanged -= OnViewModelPropertyChanged;
                _viewModel.ChatGptPromptReady -= OnChatGptPromptReady;
            }

            if (WebView.CoreWebView2 != null)
            {
                WebView.CoreWebView2.NavigationCompleted -= OnSunoNavigationCompleted;
            }

            WebView.ZoomFactorChanged -= OnSunoZoomFactorChanged;
        };
    }

    private async void OnChatGptPromptReady(object? sender, string prompt)
    {
        if (_chatGptPromptSubmitted || ChatGptWebView?.CoreWebView2 == null)
            return;

        await SubmitChatGptPromptAsync(prompt);
    }

    private async void OnSunoNavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        // Only auto-click Create on first successful navigation to Suno
        if (!_sunoNavigationCompleted && e.IsSuccess && _viewModel != null)
        {
            var url = WebView.Source?.ToString() ?? "";
            if (url.Contains("suno.com", StringComparison.OrdinalIgnoreCase))
            {
                _sunoNavigationCompleted = true;

                // Wait for the page to fully load
                await Task.Delay(2500);

                // Click the Create icon using JavaScript to find its position, then simulate mouse click
                await ClickCreateIconWithMouseAsync();
            }
        }
    }

    private async Task ClickCreateIconWithMouseAsync()
    {
        if (_createIconClicked || WebView.CoreWebView2 == null)
            return;

        try
        {
            System.Diagnostics.Debug.WriteLine("[BROWSER] Attempting to click Create icon using mouse simulation");

            // First, use JavaScript to find the Create button/link position
            var script = @"
                (function() {
                    // Find the Create link/button
                    const allElements = document.querySelectorAll('a, button, [role=""button""]');

                    for (const el of allElements) {
                        const href = (el.getAttribute('href') || '').toLowerCase();
                        const text = (el.textContent || '').trim().toLowerCase();
                        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();

                        if (href.includes('/create') || text === 'create' || ariaLabel.includes('create')) {
                            const rect = el.getBoundingClientRect();
                            if (rect.width > 0 && rect.height > 0) {
                                return {
                                    success: true,
                                    x: rect.left + rect.width / 2,
                                    y: rect.top + rect.height / 2,
                                    text: text,
                                    href: href
                                };
                            }
                        }
                    }

                    return { success: false, error: 'Create button not found' };
                })();
            ";

            var resultJson = await WebView.CoreWebView2.ExecuteScriptAsync(script);
            System.Diagnostics.Debug.WriteLine($"[BROWSER] Create icon search result: {resultJson}");

            // Parse the result
            var result = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(resultJson);

            if (result.TryGetProperty("success", out var successProp) && successProp.GetBoolean())
            {
                var relativeX = result.GetProperty("x").GetDouble();
                var relativeY = result.GetProperty("y").GetDouble();

                // Get the WebView's screen position
                var webViewPosition = WebView.PointToScreen(new Point(0, 0));

                // Calculate absolute screen coordinates
                var screenX = (int)(webViewPosition.X + relativeX);
                var screenY = (int)(webViewPosition.Y + relativeY);

                System.Diagnostics.Debug.WriteLine($"[BROWSER] Clicking at screen position: ({screenX}, {screenY})");

                // Save current cursor position
                GetCursorPos(out POINT originalPos);

                // Move cursor to the Create button and click
                SetCursorPos(screenX, screenY);
                await Task.Delay(100); // Brief delay for cursor to settle

                // Perform mouse click
                mouse_event(MOUSEEVENTF_LEFTDOWN, screenX, screenY, 0, 0);
                await Task.Delay(50);
                mouse_event(MOUSEEVENTF_LEFTUP, screenX, screenY, 0, 0);

                // Restore original cursor position
                await Task.Delay(100);
                SetCursorPos(originalPos.X, originalPos.Y);

                _createIconClicked = true;
                System.Diagnostics.Debug.WriteLine("[BROWSER] Create icon clicked successfully via mouse simulation");
            }
            else
            {
                // Fallback: navigate directly to /create
                System.Diagnostics.Debug.WriteLine("[BROWSER] Create button not found, navigating directly");
                WebView.CoreWebView2.Navigate("https://suno.com/create");
                _createIconClicked = true;
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[BROWSER] Failed to click Create icon: {ex.Message}");
            // Fallback to direct navigation
            try
            {
                WebView.CoreWebView2?.Navigate("https://suno.com/create");
                _createIconClicked = true;
            }
            catch { }
        }
    }

    private async Task InitializeChatGptWebViewAsync()
    {
        if (_chatGptWebViewInitialized || ChatGptWebView == null)
            return;

        try
        {
            // Create persistent user data folder for ChatGPT cookies/sessions
            var userDataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "JubileeMusic",
                "ChatGptWebView2Data");

            Directory.CreateDirectory(userDataFolder);

            var environment = await CoreWebView2Environment.CreateAsync(
                userDataFolder: userDataFolder);

            await ChatGptWebView.EnsureCoreWebView2Async(environment);

            if (ChatGptWebView.CoreWebView2 != null)
            {
                // Configure WebView2 settings
                ChatGptWebView.CoreWebView2.Settings.AreDefaultScriptDialogsEnabled = true;
                ChatGptWebView.CoreWebView2.Settings.IsScriptEnabled = true;
                ChatGptWebView.CoreWebView2.Settings.AreDevToolsEnabled = true;
                ChatGptWebView.CoreWebView2.Settings.IsWebMessageEnabled = true;

                // Handle new window requests (popups) by opening in the same WebView
                ChatGptWebView.CoreWebView2.NewWindowRequested += (sender, args) =>
                {
                    args.Handled = true;
                    ChatGptWebView.CoreWebView2.Navigate(args.Uri);
                };

                // Navigate to ChatGPT
                ChatGptWebView.CoreWebView2.Navigate("https://chatgpt.com");
            }

            _chatGptWebViewInitialized = true;
            System.Diagnostics.Debug.WriteLine("[CHATGPT] WebView initialized with persistent storage");

            // Subscribe to navigation completed to trigger prompt after login
            ChatGptWebView.CoreWebView2.NavigationCompleted += OnChatGptNavigationCompleted;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[CHATGPT] Failed to initialize WebView: {ex.Message}");
        }
    }

    private async void OnChatGptNavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        if (!e.IsSuccess || _chatGptPromptSubmitted || _viewModel?.CurrentWorkflow == null)
            return;

        var url = ChatGptWebView.Source?.ToString() ?? "";
        System.Diagnostics.Debug.WriteLine($"[CHATGPT] Navigation completed: {url}");

        // Wait for the page to be ready (ChatGPT needs time to load)
        if (url.Contains("chatgpt.com", StringComparison.OrdinalIgnoreCase))
        {
            // Give time for page to fully render
            await Task.Delay(3000);

            // Check if we're logged in (look for the prompt textarea)
            var isReady = await IsChatGptReadyAsync();
            if (isReady)
            {
                System.Diagnostics.Debug.WriteLine("[CHATGPT] ChatGPT is ready, triggering workflow prompt");
                _viewModel.TriggerChatGptPrompt();
            }
        }
    }

    private async Task<bool> IsChatGptReadyAsync()
    {
        if (ChatGptWebView?.CoreWebView2 == null)
            return false;

        try
        {
            var script = @"
                (function() {
                    // Look for the prompt textarea
                    const textarea = document.querySelector('textarea[data-id=""root""], textarea#prompt-textarea, div[contenteditable=""true""]');
                    return textarea !== null;
                })();
            ";

            var result = await ChatGptWebView.CoreWebView2.ExecuteScriptAsync(script);
            return result == "true";
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[CHATGPT] Error checking ready state: {ex.Message}");
            return false;
        }
    }

    private async Task SubmitChatGptPromptAsync(string prompt)
    {
        if (_chatGptPromptSubmitted || ChatGptWebView?.CoreWebView2 == null)
            return;

        try
        {
            System.Diagnostics.Debug.WriteLine("[CHATGPT] Submitting prompt to ChatGPT");

            // Escape the prompt for JavaScript
            var escapedPrompt = prompt.Replace("\\", "\\\\")
                                      .Replace("\"", "\\\"")
                                      .Replace("\n", "\\n")
                                      .Replace("\r", "\\r")
                                      .Replace("\t", "\\t");

            // Insert prompt into ChatGPT textarea and submit
            var script = $@"
                (function() {{
                    // Find the textarea or contenteditable element
                    let textarea = document.querySelector('textarea[data-id=""root""]');
                    if (!textarea) textarea = document.querySelector('textarea#prompt-textarea');
                    if (!textarea) textarea = document.querySelector('div[contenteditable=""true""][data-testid=""fruitjuice-new-conversation-text-area""]');
                    if (!textarea) textarea = document.querySelector('div[contenteditable=""true""]');

                    if (!textarea) {{
                        console.log('ChatGPT textarea not found');
                        return {{ success: false, error: 'Textarea not found' }};
                    }}

                    // Set the value based on element type
                    if (textarea.tagName.toLowerCase() === 'textarea') {{
                        textarea.value = ""{escapedPrompt}"";
                        textarea.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    }} else {{
                        // For contenteditable div
                        textarea.innerHTML = ""{escapedPrompt}"".replace(/\\n/g, '<br>');
                        textarea.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    }}

                    return {{ success: true }};
                }})();
            ";

            var result = await ChatGptWebView.CoreWebView2.ExecuteScriptAsync(script);
            System.Diagnostics.Debug.WriteLine($"[CHATGPT] Insert prompt result: {result}");

            // Wait a bit for the UI to update
            await Task.Delay(500);

            // Click the submit button
            var submitScript = @"
                (function() {
                    // Find the submit button
                    let submitBtn = document.querySelector('button[data-testid=""send-button""]');
                    if (!submitBtn) submitBtn = document.querySelector('button[data-testid=""fruitjuice-send-button""]');
                    if (!submitBtn) submitBtn = document.querySelector('button[aria-label=""Send""]');
                    if (!submitBtn) submitBtn = document.querySelector('button[aria-label=""Send message""]');

                    // Try to find button with send icon
                    if (!submitBtn) {
                        const buttons = document.querySelectorAll('button');
                        for (const btn of buttons) {
                            if (btn.querySelector('svg') && (btn.closest('form') || btn.closest('[class*=""composer""]'))) {
                                // Check if it's likely a send button (near the textarea)
                                const rect = btn.getBoundingClientRect();
                                if (rect.width > 0 && rect.height > 0) {
                                    submitBtn = btn;
                                    break;
                                }
                            }
                        }
                    }

                    if (submitBtn && !submitBtn.disabled) {
                        submitBtn.click();
                        return { success: true };
                    }

                    return { success: false, error: 'Submit button not found or disabled' };
                })();
            ";

            var submitResult = await ChatGptWebView.CoreWebView2.ExecuteScriptAsync(submitScript);
            System.Diagnostics.Debug.WriteLine($"[CHATGPT] Submit button click result: {submitResult}");

            _chatGptPromptSubmitted = true;

            // Start monitoring for response completion
            _ = MonitorChatGptResponseAsync();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[CHATGPT] Failed to submit prompt: {ex.Message}");
        }
    }

    private async Task MonitorChatGptResponseAsync()
    {
        if (ChatGptWebView?.CoreWebView2 == null || _viewModel == null)
            return;

        System.Diagnostics.Debug.WriteLine("[CHATGPT] Starting to monitor for response...");

        // Wait for response to start generating
        await Task.Delay(5000);

        int attempts = 0;
        const int maxAttempts = 60; // 2 minutes max wait time
        string lastContent = "";

        while (attempts < maxAttempts && !_chatGptResultsScraped)
        {
            try
            {
                // Check if response is still generating or complete
                var script = @"
                    (function() {
                        // Find the last assistant message
                        const messages = document.querySelectorAll('[data-message-author-role=""assistant""]');
                        const lastMessage = messages[messages.length - 1];

                        if (!lastMessage) {
                            return { generating: true, content: '' };
                        }

                        // Helper function to extract text preserving line breaks from HTML
                        // Matches ChatGPT format: section headers followed by lines, blank line between sections
                        function getTextWithLineBreaks(element) {
                            // Section headers that should have a blank line before them (except first)
                            const sectionHeaders = ['Intro:', 'Verse:', 'Chorus:', 'Bridge:', 'Outro:', 'Pre-Chorus:', 'Hook:', 'Refrain:'];

                            // Get all paragraphs
                            const paragraphs = element.querySelectorAll('p');
                            let lines = [];

                            paragraphs.forEach((p) => {
                                const text = p.textContent.trim();
                                if (!text) return;
                                lines.push(text);
                            });

                            // Now build the result with proper spacing
                            let result = '';
                            let isFirstSection = true;

                            for (let i = 0; i < lines.length; i++) {
                                const text = lines[i];

                                // Check if this is a section header
                                const isHeader = sectionHeaders.some(header =>
                                    text.startsWith(header) || text === header.replace(':', '')
                                );

                                if (isHeader) {
                                    if (!isFirstSection) {
                                        // Add blank line before section headers (except first)
                                        result += '\n' + text;
                                    } else {
                                        // First section header - no leading blank line
                                        result += text;
                                        isFirstSection = false;
                                    }
                                } else {
                                    // Regular line within a section
                                    result += text;
                                }

                                // Add newline after each line (except the last)
                                if (i < lines.length - 1) {
                                    result += '\n';
                                }
                            }

                            // If no paragraphs found, fall back to innerText
                            if (!result) {
                                result = element.innerText || element.textContent || '';
                            }

                            return result.trim();
                        }

                        // Get the text content with preserved line breaks
                        const content = getTextWithLineBreaks(lastMessage);

                        // Check if still generating (look for streaming indicator or loading state)
                        const isGenerating = document.querySelector('[class*=""streaming""]') !== null ||
                                            document.querySelector('[class*=""generating""]') !== null ||
                                            document.querySelector('button[aria-label=""Stop generating""]') !== null;

                        return {
                            generating: isGenerating,
                            content: content.trim()
                        };
                    })();
                ";

                var resultJson = await ChatGptWebView.CoreWebView2.ExecuteScriptAsync(script);
                var result = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(resultJson);

                var isGenerating = result.TryGetProperty("generating", out var gen) && gen.GetBoolean();
                var content = result.TryGetProperty("content", out var cont) ? cont.GetString() ?? "" : "";

                System.Diagnostics.Debug.WriteLine($"[CHATGPT] Response check - generating: {isGenerating}, content length: {content.Length}");

                // Check if content contains our expected format and has stabilized
                if (!isGenerating && content.Length > 100 && content == lastContent)
                {
                    // Response appears complete - check if it has the expected format
                    if (content.Contains("Title:", StringComparison.OrdinalIgnoreCase) &&
                        content.Contains("Styles:", StringComparison.OrdinalIgnoreCase) &&
                        content.Contains("Lyrics:", StringComparison.OrdinalIgnoreCase))
                    {
                        System.Diagnostics.Debug.WriteLine("[CHATGPT] Complete response detected, parsing results...");
                        _chatGptResultsScraped = true;

                        // Apply results to ViewModel on UI thread
                        await Dispatcher.InvokeAsync(() =>
                        {
                            _viewModel.ApplyChatGptResults(content);
                        });
                        break;
                    }
                }

                lastContent = content;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[CHATGPT] Error monitoring response: {ex.Message}");
            }

            await Task.Delay(2000); // Check every 2 seconds
            attempts++;
        }

        if (!_chatGptResultsScraped)
        {
            System.Diagnostics.Debug.WriteLine("[CHATGPT] Timed out waiting for response or response format not detected");
        }
    }

    private void OnViewModelPropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(BrowserViewModel.IsCreatorPanelOpen))
        {
            UpdateCreatorPanelWidth(_viewModel?.IsCreatorPanelOpen ?? false, animate: true);
        }
        else if (e.PropertyName == nameof(BrowserViewModel.IsChatGptPanelOpen))
        {
            var isOpen = _viewModel?.IsChatGptPanelOpen ?? false;
            var width = _viewModel?.ChatGptPanelWidth ?? DefaultChatGptPanelWidth;
            UpdateChatGptPanelWidth(isOpen, width, animate: true);

            // Initialize ChatGPT WebView when panel opens for the first time
            if (isOpen && !_chatGptWebViewInitialized)
            {
                _ = InitializeChatGptWebViewAsync();
            }
        }
    }

    private void UpdateCreatorPanelWidth(bool isOpen, bool animate)
    {
        var targetWidth = isOpen ? CreatorPanelWidth : 0;
        var targetSplitterWidth = isOpen ? SplitterWidth : 0;

        if (!animate)
        {
            CreatorPanelColumn.Width = new GridLength(targetWidth);
            CreatorSplitterColumn.Width = new GridLength(targetSplitterWidth);
            return;
        }

        AnimateGridColumn(CreatorPanelColumn, targetWidth, isOpen ? 250 : 200, isOpen);
        AnimateGridColumn(CreatorSplitterColumn, targetSplitterWidth, isOpen ? 250 : 200, isOpen);
    }

    private void UpdateChatGptPanelWidth(bool isOpen, double panelWidth, bool animate)
    {
        var targetPanelWidth = isOpen ? Math.Max(MinChatGptPanelWidth, panelWidth) : 0;
        var targetSplitterWidth = isOpen ? SplitterWidth : 0;

        if (!animate)
        {
            ChatGptPanelColumn.Width = new GridLength(targetPanelWidth);
            ChatGptSplitterColumn.Width = new GridLength(targetSplitterWidth);
            return;
        }

        // Animate both panel and splitter
        AnimateGridColumn(ChatGptPanelColumn, targetPanelWidth, isOpen ? 250 : 200, isOpen);
        AnimateGridColumn(ChatGptSplitterColumn, targetSplitterWidth, isOpen ? 250 : 200, isOpen);
    }

    private void AnimateGridColumn(ColumnDefinition column, double targetWidth, int durationMs, bool isOpening)
    {
        var startWidth = column.Width.Value;
        var startTime = DateTime.Now;

        System.Windows.Threading.DispatcherTimer timer = new()
        {
            Interval = TimeSpan.FromMilliseconds(16) // ~60fps
        };

        timer.Tick += (s, e) =>
        {
            var elapsed = DateTime.Now - startTime;
            var progress = Math.Min(1.0, elapsed.TotalMilliseconds / durationMs);

            // Apply easing
            var easedProgress = isOpening
                ? EaseOut(progress)
                : EaseIn(progress);

            var currentWidth = startWidth + (targetWidth - startWidth) * easedProgress;
            column.Width = new GridLength(Math.Max(0, currentWidth));

            if (progress >= 1.0)
            {
                timer.Stop();
                column.Width = new GridLength(targetWidth);
            }
        };

        timer.Start();
    }

    // Cubic ease out
    private static double EaseOut(double t)
    {
        return 1 - Math.Pow(1 - t, 3);
    }

    // Cubic ease in
    private static double EaseIn(double t)
    {
        return t * t * t;
    }

    // Handle ChatGPT splitter drag to update panel width
    private void ChatGptSplitter_DragCompleted(object sender, DragCompletedEventArgs e)
    {
        if (_viewModel != null)
        {
            var newWidth = ChatGptPanelColumn.Width.Value;

            // Enforce minimum width
            if (newWidth < MinChatGptPanelWidth)
            {
                newWidth = MinChatGptPanelWidth;
                ChatGptPanelColumn.Width = new GridLength(newWidth);
            }

            // Enforce maximum width (50% of screen)
            var maxWidth = ActualWidth * 0.5;
            if (newWidth > maxWidth)
            {
                newWidth = maxWidth;
                ChatGptPanelColumn.Width = new GridLength(newWidth);
            }

            // Update ViewModel to persist the width
            _viewModel.ChatGptPanelWidth = newWidth;
            System.Diagnostics.Debug.WriteLine($"[CHATGPT] Panel width updated to {newWidth}px");
        }
    }

    // Handle TextBox focus to prevent WebView2 from stealing keyboard input
    private void TextBox_GotFocus(object sender, RoutedEventArgs e)
    {
        if (sender is TextBox textBox)
        {
            // Ensure the textbox captures keyboard input
            textBox.Focus();
            Keyboard.Focus(textBox);
        }
    }

    private void LyricsResizeGripper_DragDelta(object sender, DragDeltaEventArgs e)
    {
        // Get the current height and apply the delta
        var currentHeight = LyricsRowDefinition.Height.Value;
        var newHeight = currentHeight + e.VerticalChange;

        // Clamp to reasonable bounds (min 100, max 600)
        newHeight = Math.Max(100, Math.Min(600, newHeight));

        LyricsRowDefinition.Height = new GridLength(newHeight);
    }

    // Save Suno zoom factor when it changes
    private void OnSunoZoomFactorChanged(object? sender, EventArgs e)
    {
        if (_viewModel != null && WebView != null)
        {
            _viewModel.SunoZoomFactor = WebView.ZoomFactor;
            System.Diagnostics.Debug.WriteLine($"[SUNO] Zoom factor changed to: {WebView.ZoomFactor}");
        }
    }
}
