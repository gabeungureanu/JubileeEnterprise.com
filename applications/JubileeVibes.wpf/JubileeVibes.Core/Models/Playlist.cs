using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace JubileeVibes.Core.Models;

public class Playlist : INotifyPropertyChanged
{
    private string _name = string.Empty;
    private string? _description;
    private string? _coverImageUrl;

    public string Id { get; set; } = string.Empty;

    public string Name
    {
        get => _name;
        set { if (_name != value) { _name = value; OnPropertyChanged(); } }
    }

    public string? Description
    {
        get => _description;
        set { if (_description != value) { _description = value; OnPropertyChanged(); } }
    }

    public string? CoverImageUrl
    {
        get => _coverImageUrl;
        set { if (_coverImageUrl != value) { _coverImageUrl = value; OnPropertyChanged(); } }
    }

    public string OwnerId { get; set; } = string.Empty;
    public string OwnerName { get; set; } = string.Empty;
    public int TrackCount { get; set; }
    public TimeSpan TotalDuration { get; set; }
    public bool IsPublic { get; set; } = true;
    public bool IsCollaborative { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public int FollowerCount { get; set; }

    public string TotalDurationFormatted
    {
        get
        {
            if (TotalDuration.TotalHours >= 1)
                return $"{(int)TotalDuration.TotalHours} hr {TotalDuration.Minutes} min";
            return $"{TotalDuration.Minutes} min";
        }
    }

    public string TrackCountFormatted => TrackCount == 1 ? "1 song" : $"{TrackCount} songs";

    public event PropertyChangedEventHandler? PropertyChanged;

    protected virtual void OnPropertyChanged([CallerMemberName] string? propertyName = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}
