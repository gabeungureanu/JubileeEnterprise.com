using System.ComponentModel;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using JubileeMusic.ViewModels;
using Microsoft.Web.WebView2.Core;

namespace JubileeMusic.Views;

public partial class BrowserView : UserControl
{
    private BrowserViewModel? _viewModel;
    private const double CreatorPanelWidth = 320;
    private const double DefaultChatGptPanelWidth = 400;
    private const double MinChatGptPanelWidth = 300;
    private const double SplitterWidth = 5;
    private bool _chatGptWebViewInitialized;
    private bool _sunoNavigationCompleted;

    public BrowserView()
    {
        InitializeComponent();

        Loaded += async (s, e) =>
        {
            if (DataContext is BrowserViewModel viewModel)
            {
                _viewModel = viewModel;
                _viewModel.PropertyChanged += OnViewModelPropertyChanged;

                // Set initial panel states without animation
                UpdateCreatorPanelWidth(_viewModel.IsCreatorPanelOpen, animate: false);
                UpdateChatGptPanelWidth(_viewModel.IsChatGptPanelOpen, _viewModel.ChatGptPanelWidth, animate: false);

                // Initialize Suno WebView
                await viewModel.InitializeWebViewAsync(WebView);

                // Subscribe to Suno navigation completion for auto-click Create
                if (WebView.CoreWebView2 != null)
                {
                    WebView.CoreWebView2.NavigationCompleted += OnSunoNavigationCompleted;
                }

                // Initialize ChatGPT WebView if panel is open
                if (_viewModel.IsChatGptPanelOpen)
                {
                    await InitializeChatGptWebViewAsync();
                }
            }
        };

        Unloaded += (s, e) =>
        {
            if (_viewModel != null)
            {
                _viewModel.PropertyChanged -= OnViewModelPropertyChanged;
            }

            if (WebView.CoreWebView2 != null)
            {
                WebView.CoreWebView2.NavigationCompleted -= OnSunoNavigationCompleted;
            }
        };
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

                // Wait a bit for the page to fully load, then click Create
                await Task.Delay(2000);

                // Use the automation service to click Create
                try
                {
                    System.Diagnostics.Debug.WriteLine("[BROWSER] Auto-clicking Create icon on Suno");
                    // Navigate directly to the create page instead of trying to click
                    WebView.CoreWebView2?.Navigate("https://suno.com/create");
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[BROWSER] Failed to auto-navigate to Create: {ex.Message}");
                }
            }
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
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[CHATGPT] Failed to initialize WebView: {ex.Message}");
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

        if (!animate)
        {
            CreatorPanelColumn.Width = new GridLength(targetWidth);
            return;
        }

        AnimateGridColumn(CreatorPanelColumn, targetWidth, isOpen ? 250 : 200, isOpen);
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
}
