using JubileeMusic.Models;
using Microsoft.Web.WebView2.Wpf;

namespace JubileeMusic.Services;

public interface ISunoAutomationService
{
    Task InitializeAsync(WebView2 webView);
    Task<bool> NavigateToSunoAsync();
    Task<bool> IsLoggedInAsync();
    Task<bool> LoginAsync(string email, string password);
    Task<bool> NavigateToCreatePageAsync();
    Task<bool> EnterLyricsAsync(string lyrics);
    Task<bool> EnterStylePromptAsync(string stylePrompt);
    Task<bool> EnterTitleAsync(string title);
    Task<bool> SetInstrumentalOnlyAsync(bool instrumental);
    Task<bool> InsertIntoCreateFormAsync(string? title, string? style, string? lyrics, bool isInstrumental);
    Task<bool> SelectOrCreateWorkspaceAsync(string workspaceName);
    Task<bool> IsOnCreatePageAsync();
    Task<GenerationResult> SubmitGenerationAsync();
    Task<GenerationStatus> CheckGenerationStatusAsync(string jobId);
    Task<byte[]?> DownloadAudioAsync(string audioUrl);
    Task<byte[]?> DownloadCoverImageAsync(string imageUrl);
    Task<string?> GetCurrentPageUrlAsync();
    event EventHandler<string>? NavigationStarted;
    event EventHandler<string>? NavigationCompleted;
    event EventHandler<GenerationStatusChangedEventArgs>? GenerationStatusChanged;
    event EventHandler<string>? ErrorOccurred;
}

public class GenerationResult
{
    public bool Success { get; set; }
    public string? JobId { get; set; }
    public string? ErrorMessage { get; set; }
    public List<GeneratedTrackInfo> Tracks { get; set; } = new();
}

public class GeneratedTrackInfo
{
    public string? TrackId { get; set; }
    public string? Title { get; set; }
    public string? AudioUrl { get; set; }
    public string? CoverImageUrl { get; set; }
    public string? Lyrics { get; set; }
    public string? StylePrompt { get; set; }
}

public class GenerationStatusChangedEventArgs : EventArgs
{
    public string JobId { get; set; } = string.Empty;
    public GenerationStatus OldStatus { get; set; }
    public GenerationStatus NewStatus { get; set; }
    public string? Message { get; set; }
}
