using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JubileeOutlook.Models;
using JubileeOutlook.Services;
using System.Collections.ObjectModel;

namespace JubileeOutlook.ViewModels;

public partial class MainViewModel : ObservableObject
{
    private readonly IMailService _mailService;
    private readonly ICalendarService _calendarService;

    [ObservableProperty]
    private ObservableCollection<MailFolder> _folders = new();

    [ObservableProperty]
    private ObservableCollection<EmailMessage> _messages = new();

    [ObservableProperty]
    private ObservableCollection<CalendarEvent> _events = new();

    [ObservableProperty]
    private MailFolder? _selectedFolder;

    [ObservableProperty]
    private EmailMessage? _selectedMessage;

    [ObservableProperty]
    private CalendarEvent? _selectedEvent;

    [ObservableProperty]
    private string _currentView = "Mail";

    [ObservableProperty]
    private string _searchQuery = string.Empty;

    [ObservableProperty]
    private bool _isComposingNewMessage;

    public MainViewModel(IMailService mailService, ICalendarService calendarService)
    {
        _mailService = mailService;
        _calendarService = calendarService;

        InitializeData();
    }

    private async void InitializeData()
    {
        // Load folders
        var folders = _mailService.GetFolders();
        Folders = new ObservableCollection<MailFolder>(folders);

        // Select inbox by default
        SelectedFolder = Folders.FirstOrDefault(f => f.Type == FolderType.Inbox);

        if (SelectedFolder != null)
        {
            await LoadMessagesAsync(SelectedFolder.Id);
        }

        // Load today's events
        await LoadEventsAsync(DateTime.Today, DateTime.Today.AddDays(1));
    }

    partial void OnSelectedFolderChanged(MailFolder? value)
    {
        if (value != null)
        {
            _ = LoadMessagesAsync(value.Id);
        }
    }

    partial void OnSelectedMessageChanged(EmailMessage? value)
    {
        if (value != null && !value.IsRead)
        {
            _ = _mailService.MarkAsReadAsync(value.Id, true);
            value.IsRead = true;
        }
    }

    private async Task LoadMessagesAsync(string folderId)
    {
        var messages = await _mailService.GetMessagesAsync(folderId);
        Messages = new ObservableCollection<EmailMessage>(messages);
    }

    private async Task LoadEventsAsync(DateTime startDate, DateTime endDate)
    {
        var events = await _calendarService.GetEventsAsync(startDate, endDate);
        Events = new ObservableCollection<CalendarEvent>(events);
    }

    [RelayCommand]
    private void NewMessage()
    {
        IsComposingNewMessage = true;
    }

    [RelayCommand]
    private async Task Reply()
    {
        if (SelectedMessage == null) return;

        var replyMessage = new EmailMessage
        {
            Subject = "RE: " + SelectedMessage.Subject,
            To = new List<string> { SelectedMessage.FromEmail },
            Body = $"\n\n--- Original Message ---\nFrom: {SelectedMessage.From}\nDate: {SelectedMessage.ReceivedDate}\nSubject: {SelectedMessage.Subject}\n\n{SelectedMessage.Body}"
        };

        await _mailService.SendMessageAsync(replyMessage);
        IsComposingNewMessage = false;
    }

    [RelayCommand]
    private async Task ReplyAll()
    {
        if (SelectedMessage == null) return;

        var replyMessage = new EmailMessage
        {
            Subject = "RE: " + SelectedMessage.Subject,
            To = new List<string> { SelectedMessage.FromEmail },
            Cc = SelectedMessage.Cc,
            Body = $"\n\n--- Original Message ---\nFrom: {SelectedMessage.From}\nDate: {SelectedMessage.ReceivedDate}\nSubject: {SelectedMessage.Subject}\n\n{SelectedMessage.Body}"
        };

        await _mailService.SendMessageAsync(replyMessage);
        IsComposingNewMessage = false;
    }

    [RelayCommand]
    private async Task Forward()
    {
        if (SelectedMessage == null) return;

        var forwardMessage = new EmailMessage
        {
            Subject = "FW: " + SelectedMessage.Subject,
            Body = $"\n\n--- Forwarded Message ---\nFrom: {SelectedMessage.From}\nDate: {SelectedMessage.ReceivedDate}\nSubject: {SelectedMessage.Subject}\n\n{SelectedMessage.Body}",
            Attachments = SelectedMessage.Attachments
        };

        await _mailService.SendMessageAsync(forwardMessage);
        IsComposingNewMessage = false;
    }

    [RelayCommand]
    private async Task Delete()
    {
        if (SelectedMessage == null) return;

        await _mailService.DeleteMessageAsync(SelectedMessage.Id);
        Messages.Remove(SelectedMessage);
        SelectedMessage = null;
    }

    [RelayCommand]
    private async Task ToggleFlag()
    {
        if (SelectedMessage == null) return;

        await _mailService.ToggleFlagAsync(SelectedMessage.Id);
        SelectedMessage.IsFlagged = !SelectedMessage.IsFlagged;
    }

    [RelayCommand]
    private async Task Search()
    {
        if (string.IsNullOrWhiteSpace(SearchQuery)) return;

        var results = await _mailService.SearchMessagesAsync(SearchQuery);
        Messages = new ObservableCollection<EmailMessage>(results);
    }

    [RelayCommand]
    private void SwitchToMailView()
    {
        CurrentView = "Mail";
    }

    [RelayCommand]
    private void SwitchToCalendarView()
    {
        CurrentView = "Calendar";
    }

    [RelayCommand]
    private async Task NewEvent()
    {
        var newEvent = new CalendarEvent
        {
            Subject = "New Event",
            StartTime = DateTime.Now,
            EndTime = DateTime.Now.AddHours(1)
        };

        await _calendarService.CreateEventAsync(newEvent);
        await LoadEventsAsync(DateTime.Today, DateTime.Today.AddDays(7));
    }

    [RelayCommand]
    private async Task DeleteEvent()
    {
        if (SelectedEvent == null) return;

        await _calendarService.DeleteEventAsync(SelectedEvent.Id);
        Events.Remove(SelectedEvent);
        SelectedEvent = null;
    }

    [RelayCommand]
    private void RefreshFolders()
    {
        var folders = _mailService.GetFolders();
        Folders = new ObservableCollection<MailFolder>(folders);
    }

    // Home Tab - Move & Organize
    [RelayCommand]
    private async Task MoveToFolder()
    {
        if (SelectedMessage == null) return;
        // Move to Junk folder as example
        await _mailService.MoveMessageAsync(SelectedMessage.Id, "junk");
        Messages.Remove(SelectedMessage);
    }

    [RelayCommand]
    private async Task ArchiveMessage()
    {
        if (SelectedMessage == null) return;
        await _mailService.MoveMessageAsync(SelectedMessage.Id, "archive");
        Messages.Remove(SelectedMessage);
    }

    [RelayCommand]
    private async Task MarkAsUnread()
    {
        if (SelectedMessage == null) return;
        await _mailService.MarkAsReadAsync(SelectedMessage.Id, false);
        SelectedMessage.IsRead = false;
    }

    [RelayCommand]
    private void ApplyCategory()
    {
        // Category application logic
    }

    [RelayCommand]
    private void CreateRule()
    {
        // Rule creation logic
    }

    [RelayCommand]
    private void QuickStep()
    {
        // Quick steps logic
    }

    // Send/Receive Tab
    [RelayCommand]
    private async Task SendReceiveAll()
    {
        if (SelectedFolder != null)
        {
            await LoadMessagesAsync(SelectedFolder.Id);
        }
        RefreshFolders();
    }

    [RelayCommand]
    private async Task UpdateFolder()
    {
        if (SelectedFolder != null)
        {
            await LoadMessagesAsync(SelectedFolder.Id);
        }
    }

    [RelayCommand]
    private void WorkOffline()
    {
        // Toggle offline mode
    }

    [RelayCommand]
    private void DownloadAddressBook()
    {
        // Download address book logic
    }

    // Folder Tab
    [RelayCommand]
    private void NewFolder()
    {
        // Create new folder logic
    }

    [RelayCommand]
    private void RenameFolder()
    {
        // Rename folder logic
    }

    [RelayCommand]
    private void DeleteFolder()
    {
        // Delete folder logic
    }

    [RelayCommand]
    private void CleanUpFolder()
    {
        // Clean up folder logic
    }

    [RelayCommand]
    private void RecoverDeletedItems()
    {
        // Recover deleted items logic
    }

    // View Tab - Layout
    [ObservableProperty]
    private string _readingPanePosition = "Right";

    [ObservableProperty]
    private bool _showFolderPane = true;

    [ObservableProperty]
    private bool _showConversationView = false;

    [RelayCommand]
    private void ChangeReadingPanePosition(string position)
    {
        ReadingPanePosition = position;
    }

    [RelayCommand]
    private void ToggleFolderPane()
    {
        ShowFolderPane = !ShowFolderPane;
    }

    [RelayCommand]
    private void ToggleConversationView()
    {
        ShowConversationView = !ShowConversationView;
    }

    [RelayCommand]
    private void SortMessages(string criteria)
    {
        // Sort messages by date, sender, subject, etc.
    }

    [RelayCommand]
    private void FilterMessages(string filter)
    {
        // Filter messages (unread, flagged, etc.)
    }

    [RelayCommand]
    private void SaveCurrentView()
    {
        // Save current view layout
    }

    // Message Compose - Format & Insert
    [RelayCommand]
    private void InsertAttachment()
    {
        // Insert attachment logic
    }

    [RelayCommand]
    private void InsertSignature()
    {
        // Insert signature logic
    }

    [RelayCommand]
    private void SetImportance(string level)
    {
        // Set message importance (High/Normal/Low)
    }

    [RelayCommand]
    private void SetFollowUp()
    {
        // Set follow-up reminder
    }

    [RelayCommand]
    private void ScheduleDelivery()
    {
        // Schedule delayed delivery
    }

    [RelayCommand]
    private void RequestReceipt()
    {
        // Request read/delivery receipt
    }

    // Calendar Commands
    [RelayCommand]
    private async Task NewAppointment()
    {
        var appointment = new CalendarEvent
        {
            Subject = "New Appointment",
            StartTime = DateTime.Now,
            EndTime = DateTime.Now.AddHours(1)
        };
        await _calendarService.CreateEventAsync(appointment);
        await LoadEventsAsync(DateTime.Today, DateTime.Today.AddDays(7));
    }

    [RelayCommand]
    private async Task NewMeeting()
    {
        var meeting = new CalendarEvent
        {
            Subject = "New Meeting",
            StartTime = DateTime.Now,
            EndTime = DateTime.Now.AddHours(1),
            Attendees = new List<string>()
        };
        await _calendarService.CreateEventAsync(meeting);
        await LoadEventsAsync(DateTime.Today, DateTime.Today.AddDays(7));
    }

    // Additional Home Tab Commands
    [RelayCommand]
    private async Task IgnoreMessage()
    {
        if (SelectedMessage == null) return;
        // Mark conversation as ignored
        await _mailService.MarkAsReadAsync(SelectedMessage.Id, true);
        await _mailService.MoveMessageAsync(SelectedMessage.Id, "deleted");
        Messages.Remove(SelectedMessage);
    }

    [RelayCommand]
    private async Task BlockSender()
    {
        if (SelectedMessage == null) return;
        // Block the sender and move all messages to junk
        await _mailService.MoveMessageAsync(SelectedMessage.Id, "junk");
        Messages.Remove(SelectedMessage);
    }

    [RelayCommand]
    private async Task ReportMessage()
    {
        if (SelectedMessage == null) return;
        // Report message as spam/phishing
        await _mailService.MoveMessageAsync(SelectedMessage.Id, "junk");
        Messages.Remove(SelectedMessage);
    }

    [RelayCommand]
    private async Task CreateMeeting()
    {
        // Create meeting from selected message
        var meeting = new CalendarEvent
        {
            Subject = SelectedMessage?.Subject ?? "New Meeting",
            StartTime = DateTime.Now,
            EndTime = DateTime.Now.AddHours(1),
            Attendees = SelectedMessage?.To ?? new List<string>()
        };
        await _calendarService.CreateEventAsync(meeting);
        SwitchToCalendarView();
    }

    [RelayCommand]
    private void MarkDone()
    {
        if (SelectedMessage == null) return;
        // Mark as done and archive
        _ = ArchiveMessage();
    }

    [RelayCommand]
    private async Task ReplyAndDelete()
    {
        if (SelectedMessage == null) return;
        await Reply();
        await Delete();
    }

    [RelayCommand]
    private async Task ForwardToManager()
    {
        if (SelectedMessage == null) return;
        // Forward to a predefined manager email
        await Forward();
    }

    [RelayCommand]
    private void CreateQuickStep()
    {
        // Open quick step creation dialog
    }

    [RelayCommand]
    private async Task ToggleRead()
    {
        if (SelectedMessage == null) return;
        if (SelectedMessage.IsRead)
        {
            await _mailService.MarkAsReadAsync(SelectedMessage.Id, false);
            SelectedMessage.IsRead = false;
        }
        else
        {
            await _mailService.MarkAsReadAsync(SelectedMessage.Id, true);
            SelectedMessage.IsRead = true;
        }
    }

    [RelayCommand]
    private void PrintMessage()
    {
        if (SelectedMessage == null) return;
        // Print selected message
    }

    [RelayCommand]
    private void Discover()
    {
        // Open Discover/Add-ins panel
    }

    [RelayCommand]
    private void ShareCalendar()
    {
        // Share calendar logic
    }

    [RelayCommand]
    private void SetRecurrence()
    {
        // Set event recurrence
    }

    [RelayCommand]
    private void ChangeTimeZone()
    {
        // Change timezone logic
    }

    [RelayCommand]
    private void PinMessage()
    {
        if (SelectedMessage == null) return;
        // Pin message to top logic
    }

    [RelayCommand]
    private void SnoozeMessage()
    {
        if (SelectedMessage == null) return;
        // Snooze message logic
    }

    [RelayCommand]
    private void MoreApps()
    {
        // Open more apps panel
    }
}
