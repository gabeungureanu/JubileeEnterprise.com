using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace JubileeVibes.Core.Models;

public class Album : INotifyPropertyChanged
{
    private bool _isSaved;

    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string ArtistId { get; set; } = string.Empty;
    public string ArtistName { get; set; } = string.Empty;
    public string? CoverArtUrl { get; set; }
    public DateTime ReleaseDate { get; set; }
    public int TrackCount { get; set; }
    public AlbumType Type { get; set; } = AlbumType.Album;
    public TimeSpan TotalDuration { get; set; }
    public string? Copyright { get; set; }
    public List<string> Genres { get; set; } = new();

    public bool IsSaved
    {
        get => _isSaved;
        set { if (_isSaved != value) { _isSaved = value; OnPropertyChanged(); } }
    }

    public string ReleaseYear => ReleaseDate.Year.ToString();

    public string TypeAndYear => $"{Type} - {ReleaseYear}";

    public event PropertyChangedEventHandler? PropertyChanged;

    protected virtual void OnPropertyChanged([CallerMemberName] string? propertyName = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}

public enum AlbumType
{
    Album,
    Single,
    EP,
    Compilation
}
