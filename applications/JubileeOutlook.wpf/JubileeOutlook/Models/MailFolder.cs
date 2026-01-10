using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace JubileeOutlook.Models;

public class MailFolder : INotifyPropertyChanged
{
    private bool _isExpanded = true;
    private bool _isSelected;
    private string _name = string.Empty;

    public string Id { get; set; } = Guid.NewGuid().ToString();

    public string Name
    {
        get => _name;
        set
        {
            if (_name != value)
            {
                _name = value;
                OnPropertyChanged();
            }
        }
    }
    public FolderType Type { get; set; }
    public int UnreadCount { get; set; }
    public int TotalCount { get; set; }
    public string Icon { get; set; } = string.Empty;
    public List<MailFolder> SubFolders { get; set; } = new();
    public string? ParentFolderId { get; set; }

    /// <summary>
    /// Indicates if this folder is the account root (WWBW email address)
    /// </summary>
    public bool IsAccountRoot { get; set; }

    /// <summary>
    /// The WWBW email address for root account folders
    /// </summary>
    public string? WwbwEmailAddress { get; set; }

    /// <summary>
    /// Whether the folder tree is expanded (for root nodes)
    /// </summary>
    public bool IsExpanded
    {
        get => _isExpanded;
        set
        {
            if (_isExpanded != value)
            {
                _isExpanded = value;
                OnPropertyChanged();
            }
        }
    }

    /// <summary>
    /// Whether this folder is currently selected
    /// </summary>
    public bool IsSelected
    {
        get => _isSelected;
        set
        {
            if (_isSelected != value)
            {
                _isSelected = value;
                OnPropertyChanged();
            }
        }
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    protected virtual void OnPropertyChanged([CallerMemberName] string? propertyName = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}

public enum FolderType
{
    AccountRoot,
    Inbox,
    Sent,
    Drafts,
    Deleted,
    Junk,
    Archive,
    Custom
}
