using System;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JubileeMusic.Models;
using JubileeMusic.Services;
using Microsoft.Extensions.Logging;
using Microsoft.Web.WebView2.Wpf;

namespace JubileeMusic.ViewModels;

public partial class BrowserViewModel : BaseViewModel
{
    private readonly ISunoAutomationService _automationService;
    private readonly ICredentialService _credentialService;
    private readonly ILibraryService _libraryService;
    private readonly IWorkflowService _workflowService;
    private readonly ILogger<BrowserViewModel> _logger;
    private WebView2? _webView;
    private string? _currentJobId;

    // Workflow automation
    public SongWorkflow? CurrentWorkflow { get; private set; }
    public event EventHandler<string>? ChatGptPromptReady;

    [ObservableProperty]
    private string _currentUrl = "https://suno.com";

    // Stored last URL for restoring on next launch
    public string? SunoLastUrl { get; set; }

    [ObservableProperty]
    private bool _isNavigating;

    [ObservableProperty]
    private bool _isLoggedIn;

    [ObservableProperty]
    private bool _showLoginPrompt;

    [ObservableProperty]
    private string _pageTitle = "Suno";

    // ChatGPT Panel Properties (left side)
    [ObservableProperty]
    private bool _isChatGptPanelOpen;

    [ObservableProperty]
    private double _chatGptPanelWidth = 400;

    // Suno WebView state
    [ObservableProperty]
    private double _sunoZoomFactor = 1.0;

    // Creator Panel Properties (right side)
    [ObservableProperty]
    private bool _isCreatorPanelOpen;

    [ObservableProperty]
    private string _title = string.Empty;

    [ObservableProperty]
    private string _musicStyle = string.Empty;

    [ObservableProperty]
    private string _lyrics = string.Empty;

    [ObservableProperty]
    private string _vocalGender = string.Empty;

    [ObservableProperty]
    private string _weirdness = string.Empty;

    [ObservableProperty]
    private string _styleInfluence = string.Empty;

    [ObservableProperty]
    private bool _isInstrumental;

    [ObservableProperty]
    private string _workspace = string.Empty;

    [ObservableProperty]
    private bool _isGenerating;

    [ObservableProperty]
    private string _generationProgress = string.Empty;

    [ObservableProperty]
    private int _generationProgressPercent;

    [ObservableProperty]
    private GenerationStatus _currentStatus = GenerationStatus.None;

    public BrowserViewModel(
        ISunoAutomationService automationService,
        ICredentialService credentialService,
        ILibraryService libraryService,
        IWorkflowService workflowService,
        ILogger<BrowserViewModel> logger)
    {
        _automationService = automationService;
        _credentialService = credentialService;
        _libraryService = libraryService;
        _workflowService = workflowService;
        _logger = logger;

        // Subscribe to automation events
        _automationService.NavigationStarted += OnNavigationStarted;
        _automationService.NavigationCompleted += OnNavigationCompleted;
        _automationService.ErrorOccurred += OnErrorOccurred;
        _automationService.GenerationStatusChanged += OnGenerationStatusChanged;

        // Load default workflow
        LoadDefaultWorkflow();
    }

    private void LoadDefaultWorkflow()
    {
        CurrentWorkflow = _workflowService.LoadDefaultWorkflow();
        if (CurrentWorkflow != null)
        {
            _logger.LogInformation("Loaded workflow: {Name}", CurrentWorkflow.Name);
        }
        else
        {
            _logger.LogWarning("No default workflow found");
        }
    }

    public void TriggerChatGptPrompt()
    {
        if (CurrentWorkflow != null && !string.IsNullOrWhiteSpace(CurrentWorkflow.Prompt))
        {
            _logger.LogInformation("Triggering ChatGPT prompt from workflow");
            ChatGptPromptReady?.Invoke(this, CurrentWorkflow.Prompt);
        }
    }

    public void ApplyChatGptResults(string response)
    {
        var result = _workflowService.ParseChatGptResponse(response);
        if (result != null)
        {
            if (!string.IsNullOrWhiteSpace(result.Workspace))
            {
                Workspace = result.Workspace;
                _logger.LogInformation("Applied Workspace: {Workspace}", result.Workspace);
            }
            if (!string.IsNullOrWhiteSpace(result.Title))
            {
                Title = result.Title;
                _logger.LogInformation("Applied Title: {Title}", result.Title);
            }
            if (!string.IsNullOrWhiteSpace(result.Styles))
            {
                MusicStyle = result.Styles;
                _logger.LogInformation("Applied Styles: {Styles}", result.Styles);
            }
            if (!string.IsNullOrWhiteSpace(result.Gender))
            {
                VocalGender = result.Gender;
                _logger.LogInformation("Applied Gender: {Gender}", result.Gender);
            }
            if (!string.IsNullOrWhiteSpace(result.Weirdness))
            {
                Weirdness = result.Weirdness;
                _logger.LogInformation("Applied Weirdness: {Weirdness}", result.Weirdness);
            }
            if (!string.IsNullOrWhiteSpace(result.StyleInfluence))
            {
                StyleInfluence = result.StyleInfluence;
                _logger.LogInformation("Applied StyleInfluence: {StyleInfluence}", result.StyleInfluence);
            }
            if (!string.IsNullOrWhiteSpace(result.Lyrics))
            {
                Lyrics = result.Lyrics;
                _logger.LogInformation("Applied Lyrics ({Length} chars)", result.Lyrics.Length);
            }

            // Open the Create panel if we have results
            if (result.IsComplete)
            {
                IsCreatorPanelOpen = true;
                SetStatus("Song details populated from ChatGPT!");
            }
        }
    }

    public async Task InitializeWebViewAsync(WebView2 webView)
    {
        _webView = webView;
        await _automationService.InitializeAsync(webView);

        // Configure WebView2 settings (automation service handles most config)
        if (_webView.CoreWebView2 != null)
        {
            // Subscribe to title changes
            _webView.CoreWebView2.DocumentTitleChanged += (s, e) =>
            {
                PageTitle = _webView.CoreWebView2.DocumentTitle;
            };

            // Navigate to saved URL if available, otherwise Suno.com
            if (!string.IsNullOrWhiteSpace(SunoLastUrl) && SunoLastUrl.Contains("suno.com", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogInformation("Navigating to saved URL: {Url}", SunoLastUrl);
                _webView.CoreWebView2.Navigate(SunoLastUrl);
            }
            else
            {
                await _automationService.NavigateToSunoAsync();
            }
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

    [RelayCommand]
    private void ToggleCreatorPanel()
    {
        IsCreatorPanelOpen = !IsCreatorPanelOpen;
        _logger.LogDebug("Creator panel toggled: {IsOpen}", IsCreatorPanelOpen);
    }

    [RelayCommand]
    private void ToggleChatGptPanel()
    {
        IsChatGptPanelOpen = !IsChatGptPanelOpen;
        _logger.LogDebug("ChatGPT panel toggled: {IsOpen}", IsChatGptPanelOpen);
    }

    [RelayCommand]
    private async Task InsertIntoCreateForm()
    {
        // Only proceed if the Create panel is open
        if (!IsCreatorPanelOpen)
        {
            _logger.LogDebug("Insert aborted: Create panel is not open");
            return;
        }

        // Log the values being inserted for traceability
        _logger.LogInformation("[INSERT] Starting form insertion with values - Title: '{Title}', MusicStyle: '{MusicStyle}' ({StyleLen} chars), Lyrics: ({LyricsLen} chars), IsInstrumental: {IsInstrumental}",
            Title ?? "(empty)",
            MusicStyle ?? "(empty)",
            MusicStyle?.Length ?? 0,
            Lyrics?.Length ?? 0,
            IsInstrumental);

        await ExecuteWithBusyIndicator(async () =>
        {
            // Check if we're on the create page
            var isOnCreatePage = await _automationService.IsOnCreatePageAsync();

            if (!isOnCreatePage)
            {
                // Navigate to create page first
                SetStatus("Navigating to Create page...");
                _logger.LogInformation("[INSERT] Not on create page, navigating...");
                await _automationService.NavigateToCreatePageAsync();
                await Task.Delay(2000); // Wait for page to load
            }

            // Handle workspace selection/creation first if specified
            if (!string.IsNullOrWhiteSpace(Workspace))
            {
                SetStatus($"Setting workspace to '{Workspace}'...");
                var workspaceResult = await _automationService.SelectOrCreateWorkspaceAsync(Workspace);

                if (!workspaceResult)
                {
                    _logger.LogWarning("[INSERT] Failed to select/create workspace '{Workspace}'", Workspace);
                    // Continue with form insertion even if workspace fails
                }
                else
                {
                    _logger.LogInformation("[INSERT] Workspace '{Workspace}' selected/created successfully", Workspace);
                    await Task.Delay(500); // Brief delay after workspace change
                }
            }

            SetStatus("Inserting form data...");
            _logger.LogInformation("[INSERT] Calling InsertIntoCreateFormAsync with MusicStyle='{Style}', VocalGender='{Gender}', Weirdness='{Weirdness}', StyleInfluence='{StyleInfluence}', Workspace='{Workspace}'",
                MusicStyle ?? "(null)", VocalGender ?? "(null)", Weirdness ?? "(null)", StyleInfluence ?? "(null)", Workspace ?? "(null)");

            var success = await _automationService.InsertIntoCreateFormAsync(
                Title,
                MusicStyle,
                Lyrics,
                IsInstrumental,
                VocalGender,
                Weirdness,
                StyleInfluence,
                Workspace);

            if (success)
            {
                SetStatus("Form data inserted successfully");
                _logger.LogInformation("[INSERT] Successfully inserted form data into Suno create page");
            }
            else
            {
                SetError("Failed to insert some form data. Please check the create page.");
                _logger.LogWarning("[INSERT] Partial or complete failure inserting form data");
            }
        }, "Inserting form data...");
    }

    [RelayCommand(CanExecute = nameof(CanGenerateSong))]
    private async Task GenerateSong()
    {
        await ExecuteWithBusyIndicator(async () =>
        {
            IsGenerating = true;
            CurrentStatus = GenerationStatus.Pending;
            GenerationProgress = "Preparing to generate...";
            GenerationProgressPercent = 0;

            _logger.LogInformation("Starting generation - Title: {Title}, Style: {Style}, Instrumental: {Instrumental}",
                Title, MusicStyle, IsInstrumental);

            // Navigate to create page first
            GenerationProgress = "Navigating to create page...";
            GenerationProgressPercent = 10;
            await _automationService.NavigateToCreatePageAsync();
            await Task.Delay(2000); // Wait for page to load

            // Enter lyrics (if not instrumental)
            if (!IsInstrumental && !string.IsNullOrWhiteSpace(Lyrics))
            {
                GenerationProgress = "Entering lyrics...";
                GenerationProgressPercent = 25;
                var lyricsEntered = await _automationService.EnterLyricsAsync(Lyrics);

                if (!lyricsEntered)
                {
                    throw new Exception("Failed to enter lyrics. The Suno interface may have changed.");
                }
            }

            // Enter style prompt
            if (!string.IsNullOrWhiteSpace(MusicStyle))
            {
                GenerationProgress = "Entering style...";
                GenerationProgressPercent = 40;
                await _automationService.EnterStylePromptAsync(MusicStyle);
            }

            // Set instrumental mode
            GenerationProgress = "Setting options...";
            GenerationProgressPercent = 50;
            await _automationService.SetInstrumentalOnlyAsync(IsInstrumental);

            // Submit generation
            GenerationProgress = "Submitting generation request...";
            GenerationProgressPercent = 60;
            CurrentStatus = GenerationStatus.Pending;

            var result = await _automationService.SubmitGenerationAsync();

            if (!result.Success)
            {
                throw new Exception(result.ErrorMessage ?? "Generation submission failed");
            }

            _currentJobId = result.JobId;
            CurrentStatus = GenerationStatus.Generating;
            GenerationProgress = "Generating music...";
            GenerationProgressPercent = 70;

            _logger.LogInformation("Generation submitted, JobId: {JobId}", _currentJobId);

            // Poll for completion
            await PollForCompletionAsync();

        }, "Starting generation...");
    }

    private async Task PollForCompletionAsync()
    {
        const int maxAttempts = 120; // 10 minutes with 5-second intervals
        int attempt = 0;

        while (attempt < maxAttempts && CurrentStatus == GenerationStatus.Generating)
        {
            await Task.Delay(5000); // Poll every 5 seconds
            attempt++;

            var status = await _automationService.CheckGenerationStatusAsync(_currentJobId!);

            if (status == GenerationStatus.Completed)
            {
                CurrentStatus = GenerationStatus.Completed;
                GenerationProgress = "Generation complete! Saving...";
                GenerationProgressPercent = 90;

                await SaveGeneratedTrackAsync();
                break;
            }
            else if (status == GenerationStatus.Failed)
            {
                CurrentStatus = GenerationStatus.Failed;
                throw new Exception("Generation failed on Suno's side. Please try again.");
            }

            GenerationProgress = $"Generating music... ({attempt * 5}s)";
            GenerationProgressPercent = 70 + (int)(attempt / (float)maxAttempts * 20);
        }

        if (attempt >= maxAttempts && CurrentStatus == GenerationStatus.Generating)
        {
            CurrentStatus = GenerationStatus.Failed;
            throw new Exception("Generation timed out. Please check Suno manually.");
        }
    }

    private async Task SaveGeneratedTrackAsync()
    {
        try
        {
            GenerationProgress = "Saving to library...";
            GenerationProgressPercent = 95;

            // Create track record
            var track = new MusicTrack
            {
                Id = Guid.NewGuid().ToString(),
                Title = string.IsNullOrWhiteSpace(Title) ? $"Generated {DateTime.Now:yyyy-MM-dd HH:mm}" : Title,
                Lyrics = IsInstrumental ? null : Lyrics,
                StylePrompt = MusicStyle,
                IsInstrumental = IsInstrumental,
                GenerationStatus = GenerationStatus.Completed,
                SunoJobId = _currentJobId,
                CreatedAt = DateTime.UtcNow
            };

            // Save track metadata
            await _libraryService.SaveTrackAsync(track);

            GenerationProgress = "Done!";
            GenerationProgressPercent = 100;
            SetStatus($"Track '{track.Title}' saved to library");

            _logger.LogInformation("Track saved: {Id} - {Title}", track.Id, track.Title);

            // Reset form for next creation after a short delay
            await Task.Delay(2000);
            ResetCreatorForm();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save generated track");
            throw;
        }
    }

    private bool CanGenerateSong()
    {
        return !IsGenerating &&
               (!string.IsNullOrWhiteSpace(Lyrics) || IsInstrumental) &&
               !string.IsNullOrWhiteSpace(MusicStyle);
    }

    [RelayCommand]
    private void CancelGeneration()
    {
        if (IsGenerating)
        {
            IsGenerating = false;
            CurrentStatus = GenerationStatus.None;
            GenerationProgress = "Cancelled";
            SetStatus("Generation cancelled");
            _logger.LogInformation("Generation cancelled by user");
        }
    }

    private void ResetCreatorForm()
    {
        Workspace = string.Empty;
        Title = string.Empty;
        MusicStyle = string.Empty;
        VocalGender = string.Empty;
        Weirdness = string.Empty;
        StyleInfluence = string.Empty;
        Lyrics = string.Empty;
        IsInstrumental = false;
        IsGenerating = false;
        CurrentStatus = GenerationStatus.None;
        GenerationProgress = string.Empty;
        GenerationProgressPercent = 0;
        _currentJobId = null;
        ClearError();
    }

    private void OnGenerationStatusChanged(object? sender, GenerationStatusChangedEventArgs e)
    {
        if (e.JobId == _currentJobId)
        {
            CurrentStatus = e.NewStatus;
            if (!string.IsNullOrEmpty(e.Message))
            {
                GenerationProgress = e.Message;
            }
        }
    }

    partial void OnLyricsChanged(string value) => GenerateSongCommand.NotifyCanExecuteChanged();
    partial void OnMusicStyleChanged(string value) => GenerateSongCommand.NotifyCanExecuteChanged();
    partial void OnIsInstrumentalChanged(bool value) => GenerateSongCommand.NotifyCanExecuteChanged();

    [RelayCommand]
    private void ClearCreatorFields()
    {
        ResetCreatorForm();
        _logger.LogDebug("Creator fields cleared");
    }

    [RelayCommand]
    private void DismissError()
    {
        ClearError();
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
