using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace JubileeVibes.Core.Models;

public class Track : INotifyPropertyChanged
{
    private bool _isLiked;
    private bool _isPlaying;

    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string ArtistId { get; set; } = string.Empty;
    public string ArtistName { get; set; } = string.Empty;
    public string AlbumId { get; set; } = string.Empty;
    public string AlbumName { get; set; } = string.Empty;
    public string? AlbumArtUrl { get; set; }
    public TimeSpan Duration { get; set; }
    public int TrackNumber { get; set; }
    public int DiscNumber { get; set; } = 1;
    public bool IsExplicit { get; set; }
    public bool IsLocal { get; set; }
    public string? LocalPath { get; set; }
    public string? StreamUrl { get; set; }
    public DateTime? AddedAt { get; set; }
    public int PlayCount { get; set; }

    public bool IsLiked
    {
        get => _isLiked;
        set { if (_isLiked != value) { _isLiked = value; OnPropertyChanged(); } }
    }

    public bool IsPlaying
    {
        get => _isPlaying;
        set { if (_isPlaying != value) { _isPlaying = value; OnPropertyChanged(); } }
    }

    public string DurationFormatted => Duration.TotalHours >= 1
        ? Duration.ToString(@"h\:mm\:ss")
        : Duration.ToString(@"m\:ss");

    public event PropertyChangedEventHandler? PropertyChanged;

    protected virtual void OnPropertyChanged([CallerMemberName] string? propertyName = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}
