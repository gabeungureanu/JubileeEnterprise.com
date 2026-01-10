using JubileeOutlook.Models;

namespace JubileeOutlook.Services;

public class MockMailService : IMailService
{
    private readonly List<EmailMessage> _messages = new();
    private readonly List<MailFolder> _folders = new();

    public MockMailService()
    {
        InitializeFolders();
        InitializeMockMessages();
    }

    private void InitializeFolders()
    {
        // Using Material Icons Unicode characters
        _folders.Add(new MailFolder
        {
            Id = "inbox",
            Name = "Inbox",
            Type = FolderType.Inbox,
            Icon = "\uE156", // inbox icon
            UnreadCount = 5,
            TotalCount = 25
        });

        _folders.Add(new MailFolder
        {
            Id = "sent",
            Name = "Sent Items",
            Type = FolderType.Sent,
            Icon = "\uE163", // send icon
            UnreadCount = 0,
            TotalCount = 42
        });

        _folders.Add(new MailFolder
        {
            Id = "drafts",
            Name = "Drafts",
            Type = FolderType.Drafts,
            Icon = "\uE151", // drafts icon
            UnreadCount = 0,
            TotalCount = 3
        });

        _folders.Add(new MailFolder
        {
            Id = "deleted",
            Name = "Deleted Items",
            Type = FolderType.Deleted,
            Icon = "\uE872", // delete icon
            UnreadCount = 0,
            TotalCount = 8
        });

        _folders.Add(new MailFolder
        {
            Id = "junk",
            Name = "Junk Email",
            Type = FolderType.Junk,
            Icon = "\uE14C", // report/spam icon
            UnreadCount = 2,
            TotalCount = 15
        });
    }

    private void InitializeMockMessages()
    {
        _messages.Add(new EmailMessage
        {
            Id = "1",
            Subject = "Welcome to Jubilee Outlook",
            From = "Jubilee Team",
            FromEmail = "team@jubilee.com",
            Body = "Welcome to Jubilee Outlook! This is your first email. Explore the features and let us know what you think.",
            ReceivedDate = DateTime.Now.AddHours(-2),
            IsRead = false,
            FolderId = "inbox",
            Preview = "Welcome to Jubilee Outlook! This is your first email..."
        });

        _messages.Add(new EmailMessage
        {
            Id = "2",
            Subject = "Project Update - Q1 2026",
            From = "Sarah Johnson",
            FromEmail = "sarah.johnson@company.com",
            Body = "Here's the latest update on our Q1 projects. Everything is on track and we're making great progress.",
            ReceivedDate = DateTime.Now.AddHours(-5),
            IsRead = false,
            IsFlagged = true,
            Priority = EmailPriority.High,
            FolderId = "inbox",
            HasAttachments = true,
            Preview = "Here's the latest update on our Q1 projects..."
        });

        _messages.Add(new EmailMessage
        {
            Id = "3",
            Subject = "Meeting Schedule - Next Week",
            From = "Michael Chen",
            FromEmail = "m.chen@company.com",
            Body = "Let's schedule our weekly sync for next week. Please let me know your availability.",
            ReceivedDate = DateTime.Now.AddDays(-1),
            IsRead = true,
            FolderId = "inbox",
            Preview = "Let's schedule our weekly sync for next week..."
        });

        _messages.Add(new EmailMessage
        {
            Id = "4",
            Subject = "Budget Approval Required",
            From = "Finance Department",
            FromEmail = "finance@company.com",
            Body = "Your budget request for Q2 requires approval. Please review and confirm the details.",
            ReceivedDate = DateTime.Now.AddDays(-2),
            IsRead = false,
            Priority = EmailPriority.High,
            FolderId = "inbox",
            Preview = "Your budget request for Q2 requires approval..."
        });

        _messages.Add(new EmailMessage
        {
            Id = "5",
            Subject = "Team Building Event - Save the Date",
            From = "HR Team",
            FromEmail = "hr@company.com",
            Body = "We're organizing a team building event next month. Mark your calendars!",
            ReceivedDate = DateTime.Now.AddDays(-3),
            IsRead = true,
            FolderId = "inbox",
            Preview = "We're organizing a team building event next month..."
        });

        _messages.Add(new EmailMessage
        {
            Id = "6",
            Subject = "RE: Project Update - Q1 2026",
            From = "You",
            FromEmail = "you@company.com",
            To = new List<string> { "sarah.johnson@company.com" },
            Body = "Thanks for the update! Everything looks great.",
            SentDate = DateTime.Now.AddHours(-3),
            IsRead = true,
            FolderId = "sent",
            Preview = "Thanks for the update! Everything looks great."
        });
    }

    public Task<List<EmailMessage>> GetMessagesAsync(string folderId)
    {
        var messages = _messages.Where(m => m.FolderId == folderId)
            .OrderByDescending(m => m.ReceivedDate)
            .ToList();
        return Task.FromResult(messages);
    }

    public Task<EmailMessage?> GetMessageByIdAsync(string messageId)
    {
        var message = _messages.FirstOrDefault(m => m.Id == messageId);
        return Task.FromResult(message);
    }

    public Task SendMessageAsync(EmailMessage message)
    {
        message.Id = Guid.NewGuid().ToString();
        message.SentDate = DateTime.Now;
        message.FolderId = "sent";
        _messages.Add(message);
        return Task.CompletedTask;
    }

    public Task DeleteMessageAsync(string messageId)
    {
        var message = _messages.FirstOrDefault(m => m.Id == messageId);
        if (message != null)
        {
            message.FolderId = "deleted";
        }
        return Task.CompletedTask;
    }

    public Task MoveMessageAsync(string messageId, string targetFolderId)
    {
        var message = _messages.FirstOrDefault(m => m.Id == messageId);
        if (message != null)
        {
            message.FolderId = targetFolderId;
        }
        return Task.CompletedTask;
    }

    public Task MarkAsReadAsync(string messageId, bool isRead)
    {
        var message = _messages.FirstOrDefault(m => m.Id == messageId);
        if (message != null)
        {
            message.IsRead = isRead;
            UpdateFolderCounts();
        }
        return Task.CompletedTask;
    }

    public Task ToggleFlagAsync(string messageId)
    {
        var message = _messages.FirstOrDefault(m => m.Id == messageId);
        if (message != null)
        {
            message.IsFlagged = !message.IsFlagged;
        }
        return Task.CompletedTask;
    }

    public List<MailFolder> GetFolders()
    {
        UpdateFolderCounts();
        return _folders;
    }

    public Task<List<EmailMessage>> SearchMessagesAsync(string query)
    {
        var results = _messages.Where(m =>
            m.Subject.Contains(query, StringComparison.OrdinalIgnoreCase) ||
            m.From.Contains(query, StringComparison.OrdinalIgnoreCase) ||
            m.Body.Contains(query, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(m => m.ReceivedDate)
            .ToList();
        return Task.FromResult(results);
    }

    private void UpdateFolderCounts()
    {
        foreach (var folder in _folders)
        {
            var folderMessages = _messages.Where(m => m.FolderId == folder.Id).ToList();
            folder.TotalCount = folderMessages.Count;
            folder.UnreadCount = folderMessages.Count(m => !m.IsRead);
        }
    }
}
