using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace JubileeVibes.Core.Models;

public class Artist : INotifyPropertyChanged
{
    private bool _isFollowed;

    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public string? Bio { get; set; }
    public int MonthlyListeners { get; set; }
    public int FollowerCount { get; set; }
    public List<string> Genres { get; set; } = new();
    public bool IsVerified { get; set; }

    public bool IsFollowed
    {
        get => _isFollowed;
        set { if (_isFollowed != value) { _isFollowed = value; OnPropertyChanged(); } }
    }

    public string MonthlyListenersFormatted => FormatNumber(MonthlyListeners);
    public string FollowerCountFormatted => FormatNumber(FollowerCount);

    private static string FormatNumber(int number)
    {
        return number switch
        {
            >= 1_000_000 => $"{number / 1_000_000.0:0.#}M",
            >= 1_000 => $"{number / 1_000.0:0.#}K",
            _ => number.ToString("N0")
        };
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    protected virtual void OnPropertyChanged([CallerMemberName] string? propertyName = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}
