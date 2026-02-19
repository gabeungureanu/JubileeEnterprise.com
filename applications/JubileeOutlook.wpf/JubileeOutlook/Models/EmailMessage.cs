using CommunityToolkit.Mvvm.ComponentModel;

namespace JubileeOutlook.Models;

public partial class EmailMessage : ObservableObject
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Subject { get; set; } = string.Empty;
    public string From { get; set; } = string.Empty;
    public string FromEmail { get; set; } = string.Empty;
    public List<string> To { get; set; } = new();
    public List<string> Cc { get; set; } = new();
    public List<string> Bcc { get; set; } = new();
    public string Body { get; set; } = string.Empty;
    public bool IsHtml { get; set; }
    public DateTime ReceivedDate { get; set; } = DateTime.Now;
    public DateTime SentDate { get; set; } = DateTime.Now;

    [ObservableProperty]
    private bool _isRead;

    [ObservableProperty]
    private bool _isFlagged;

    [ObservableProperty]
    private bool _isPinned;

    public bool HasAttachments { get; set; }
    public List<EmailAttachment> Attachments { get; set; } = new();
    public string FolderId { get; set; } = string.Empty;
    public EmailPriority Priority { get; set; } = EmailPriority.Normal;
    public string Preview { get; set; } = string.Empty;
    public string ConversationId { get; set; } = string.Empty;

    // Categories/Labels for email organization
    [ObservableProperty]
    private List<string> _categories = new();

    // Properties for synced email on-demand body fetching
    public Guid? SyncedMessageId { get; set; }
    public string? RemoteMessageId { get; set; }
    public Guid? AccountId { get; set; }
    public bool NeedsBodyFetch { get; set; }
}

public class EmailAttachment
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string FileName { get; set; } = string.Empty;
    public string? FilePath { get; set; }
    public long FileSize { get; set; }
    public string ContentType { get; set; } = string.Empty;
    public byte[]? Data { get; set; }
}

public enum EmailPriority
{
    Low,
    Normal,
    High
}
