using System;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JubileeMusic.Models;
using JubileeMusic.Services;
using Microsoft.Extensions.Logging;

namespace JubileeMusic.ViewModels;

public partial class CreateViewModel : BaseViewModel
{
    private readonly ISunoAutomationService _automationService;
    private readonly ILibraryService _libraryService;
    private readonly ILogger<CreateViewModel> _logger;

    [ObservableProperty]
    private string _lyrics = string.Empty;

    [ObservableProperty]
    private string _stylePrompt = string.Empty;

    [ObservableProperty]
    private string _title = string.Empty;

    [ObservableProperty]
    private bool _isInstrumentalOnly;

    [ObservableProperty]
    private bool _isGenerating;

    [ObservableProperty]
    private string _generationProgress = string.Empty;

    [ObservableProperty]
    private int _generationProgressPercent;

    [ObservableProperty]
    private GenerationStatus _currentStatus = GenerationStatus.None;

    private string? _currentJobId;

    public CreateViewModel(
        ISunoAutomationService automationService,
        ILibraryService libraryService,
        ILogger<CreateViewModel> logger)
    {
        _automationService = automationService;
        _libraryService = libraryService;
        _logger = logger;

        _automationService.GenerationStatusChanged += OnGenerationStatusChanged;
    }

    [RelayCommand(CanExecute = nameof(CanGenerate))]
    private async Task Generate()
    {
        await ExecuteWithBusyIndicator(async () =>
        {
            IsGenerating = true;
            CurrentStatus = GenerationStatus.Pending;
            GenerationProgress = "Preparing to generate...";
            GenerationProgressPercent = 0;

            _logger.LogInformation("Starting generation - Title: {Title}, Style: {Style}, Instrumental: {Instrumental}",
                Title, StylePrompt, IsInstrumentalOnly);

            // Navigate to create page if not already there
            GenerationProgress = "Navigating to create page...";
            GenerationProgressPercent = 10;
            await _automationService.NavigateToCreatePageAsync();

            // Enter lyrics (if not instrumental)
            if (!IsInstrumentalOnly && !string.IsNullOrWhiteSpace(Lyrics))
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
            if (!string.IsNullOrWhiteSpace(StylePrompt))
            {
                GenerationProgress = "Entering style...";
                GenerationProgressPercent = 40;
                await _automationService.EnterStylePromptAsync(StylePrompt);
            }

            // Set instrumental mode
            GenerationProgress = "Setting options...";
            GenerationProgressPercent = 50;
            await _automationService.SetInstrumentalOnlyAsync(IsInstrumentalOnly);

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
                GenerationProgress = "Generation complete! Downloading...";
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
                Lyrics = IsInstrumentalOnly ? null : Lyrics,
                StylePrompt = StylePrompt,
                IsInstrumental = IsInstrumentalOnly,
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

            // Reset form for next creation
            await Task.Delay(2000);
            ResetForm();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save generated track");
            throw;
        }
    }

    private bool CanGenerate()
    {
        return !IsGenerating &&
               (!string.IsNullOrWhiteSpace(Lyrics) || IsInstrumentalOnly) &&
               !string.IsNullOrWhiteSpace(StylePrompt);
    }

    [RelayCommand]
    private void ResetForm()
    {
        Lyrics = string.Empty;
        StylePrompt = string.Empty;
        Title = string.Empty;
        IsInstrumentalOnly = false;
        IsGenerating = false;
        CurrentStatus = GenerationStatus.None;
        GenerationProgress = string.Empty;
        GenerationProgressPercent = 0;
        _currentJobId = null;
        ClearError();
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

    partial void OnLyricsChanged(string value) => GenerateCommand.NotifyCanExecuteChanged();
    partial void OnStylePromptChanged(string value) => GenerateCommand.NotifyCanExecuteChanged();
    partial void OnIsInstrumentalOnlyChanged(bool value) => GenerateCommand.NotifyCanExecuteChanged();
}
