using JubileeOutlook.Models;

namespace JubileeOutlook.Services;

public interface IMailService
{
    Task<List<EmailMessage>> GetMessagesAsync(string folderId);
    Task<EmailMessage?> GetMessageByIdAsync(string messageId);
    Task SendMessageAsync(EmailMessage message);
    Task<EmailMessage> SaveDraftAsync(EmailMessage draft, string? existingDraftId = null);
    Task DeleteMessageAsync(string messageId);
    Task MoveMessageAsync(string messageId, string targetFolderId);
    Task MarkAsReadAsync(string messageId, bool isRead);
    Task ToggleFlagAsync(string messageId, bool? isFlagged = null);
    List<MailFolder> GetFolders();
    Task<List<MailFolder>> GetFoldersAsync();
    Task<List<EmailMessage>> SearchMessagesAsync(string query);
}
