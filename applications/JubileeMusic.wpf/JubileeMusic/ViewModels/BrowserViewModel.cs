using System;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JubileeMusic.Services;
using Microsoft.Extensions.Logging;
using Microsoft.Web.WebView2.Wpf;

namespace JubileeMusic.ViewModels;

public partial class BrowserViewModel : BaseViewModel
{
    private readonly ISunoAutomationService _automationService;
    private readonly ICredentialService _credentialService;
    private readonly ILogger<BrowserViewModel> _logger;
    private WebView2? _webView;

    [ObservableProperty]
    private string _currentUrl = "https://suno.com";

    [ObservableProperty]
    private bool _isNavigating;

    [ObservableProperty]
    private bool _isLoggedIn;

    [ObservableProperty]
    private bool _showLoginPrompt;

    [ObservableProperty]
    private string _pageTitle = "Suno";

    public BrowserViewModel(
        ISunoAutomationService automationService,
        ICredentialService credentialService,
        ILogger<BrowserViewModel> logger)
    {
        _automationService = automationService;
        _credentialService = credentialService;
        _logger = logger;

        // Subscribe to automation events
        _automationService.NavigationStarted += OnNavigationStarted;
        _automationService.NavigationCompleted += OnNavigationCompleted;
        _automationService.ErrorOccurred += OnErrorOccurred;
    }

    public async Task InitializeWebViewAsync(WebView2 webView)
    {
        _webView = webView;
        await _automationService.InitializeAsync(webView);

        // Configure WebView2 settings
        if (_webView.CoreWebView2 != null)
        {
            _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
            _webView.CoreWebView2.Settings.IsZoomControlEnabled = true;

            // Subscribe to title changes
            _webView.CoreWebView2.DocumentTitleChanged += (s, e) =>
            {
                PageTitle = _webView.CoreWebView2.DocumentTitle;
            };
        }

        _logger.LogInformation("WebView initialized");
    }

    [RelayCommand]
    private async Task NavigateToSuno()
    {
        await ExecuteWithBusyIndicator(async () =>
        {
            await _automationService.NavigateToSunoAsync();
        }, "Navigating to Suno...");
    }

    [RelayCommand]
    private async Task NavigateToCreate()
    {
        await ExecuteWithBusyIndicator(async () =>
        {
            await _automationService.NavigateToCreatePageAsync();
        }, "Navigating to Create page...");
    }

    [RelayCommand]
    private async Task CheckLoginStatus()
    {
        await ExecuteWithBusyIndicator(async () =>
        {
            IsLoggedIn = await _automationService.IsLoggedInAsync();
            ShowLoginPrompt = !IsLoggedIn;
            SetStatus(IsLoggedIn ? "Logged in" : "Not logged in");
        }, "Checking login status...");
    }

    [RelayCommand]
    private async Task AutoLogin()
    {
        await ExecuteWithBusyIndicator(async () =>
        {
            var credentials = await _credentialService.GetCredentialsAsync();

            if (credentials == null)
            {
                SetError("No stored credentials found. Please log in manually or configure credentials.");
                ShowLoginPrompt = true;
                return;
            }

            var success = await _automationService.LoginAsync(credentials.Email, credentials.Password);

            if (success)
            {
                IsLoggedIn = true;
                ShowLoginPrompt = false;
                SetStatus("Login successful");
                _logger.LogInformation("Auto-login successful");
            }
            else
            {
                SetError("Login failed. Please check your credentials.");
                _logger.LogWarning("Auto-login failed");
            }
        }, "Logging in...");
    }

    [RelayCommand]
    private void Refresh()
    {
        _webView?.Reload();
    }

    [RelayCommand]
    private void GoBack()
    {
        if (_webView?.CanGoBack == true)
        {
            _webView.GoBack();
        }
    }

    [RelayCommand]
    private void GoForward()
    {
        if (_webView?.CanGoForward == true)
        {
            _webView.GoForward();
        }
    }

    private void OnNavigationStarted(object? sender, string url)
    {
        IsNavigating = true;
        CurrentUrl = url;
        SetStatus($"Loading: {url}");
    }

    private void OnNavigationCompleted(object? sender, string url)
    {
        IsNavigating = false;
        CurrentUrl = url;
        SetStatus("Ready");

        // Check login status after navigation
        _ = CheckLoginStatus();
    }

    private void OnErrorOccurred(object? sender, string error)
    {
        SetError(error);
    }
}
