namespace JubileeOutlook.Models;

public class MailFolder
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public FolderType Type { get; set; }
    public int UnreadCount { get; set; }
    public int TotalCount { get; set; }
    public string Icon { get; set; } = string.Empty;
    public List<MailFolder> SubFolders { get; set; } = new();
    public string? ParentFolderId { get; set; }
}

public enum FolderType
{
    Inbox,
    Sent,
    Drafts,
    Deleted,
    Junk,
    Archive,
    Custom
}
