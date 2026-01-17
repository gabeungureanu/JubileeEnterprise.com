using System.ComponentModel;

namespace JubileeBrowser.Models;

public class TodoItem : INotifyPropertyChanged
{
    private int _id;
    private string _title = string.Empty;
    private string? _description;
    private bool _isCompleted;
    private DateTime? _dueDate;
    private string? _priority;
    private string? _assignedTo;
    private string? _status;
    private DateTime _createdAt;
    private DateTime? _updatedAt;
    private string _userEmail = string.Empty;

    public int Id
    {
        get => _id;
        set { _id = value; OnPropertyChanged(nameof(Id)); }
    }

    public string Title
    {
        get => _title;
        set { _title = value; OnPropertyChanged(nameof(Title)); }
    }

    public string? Description
    {
        get => _description;
        set { _description = value; OnPropertyChanged(nameof(Description)); }
    }

    public bool IsCompleted
    {
        get => _isCompleted;
        set { _isCompleted = value; OnPropertyChanged(nameof(IsCompleted)); }
    }

    public DateTime? DueDate
    {
        get => _dueDate;
        set { _dueDate = value; OnPropertyChanged(nameof(DueDate)); }
    }

    public string? Priority
    {
        get => _priority;
        set { _priority = value; OnPropertyChanged(nameof(Priority)); OnPropertyChanged(nameof(PriorityColor)); }
    }

    public string? AssignedTo
    {
        get => _assignedTo;
        set { _assignedTo = value; OnPropertyChanged(nameof(AssignedTo)); }
    }

    public string? Status
    {
        get => _status;
        set { _status = value; OnPropertyChanged(nameof(Status)); OnPropertyChanged(nameof(StatusColor)); }
    }

    public DateTime CreatedAt
    {
        get => _createdAt;
        set { _createdAt = value; OnPropertyChanged(nameof(CreatedAt)); }
    }

    public DateTime? UpdatedAt
    {
        get => _updatedAt;
        set { _updatedAt = value; OnPropertyChanged(nameof(UpdatedAt)); }
    }

    public string UserEmail
    {
        get => _userEmail;
        set { _userEmail = value; OnPropertyChanged(nameof(UserEmail)); }
    }

    // Computed property for priority color
    public string PriorityColor => Priority?.ToLower() switch
    {
        "high" => "#ff6b6b",
        "medium" => "#ffd93d",
        "low" => "#6bcb77",
        _ => "#888888"
    };

    // Computed property for status color
    public string StatusColor => Status?.ToLower() switch
    {
        "in progress" => "#00bfff",
        "pending" => "#ffd93d",
        "completed" => "#6bcb77",
        "blocked" => "#ff6b6b",
        _ => "#888888"
    };

    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged(string propertyName)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}
