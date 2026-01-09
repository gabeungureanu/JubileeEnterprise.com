using JubileeOutlook.Models;

namespace JubileeOutlook.Services;

public interface IMailService
{
    Task<List<EmailMessage>> GetMessagesAsync(string folderId);
    Task<EmailMessage?> GetMessageByIdAsync(string messageId);
    Task SendMessageAsync(EmailMessage message);
    Task DeleteMessageAsync(string messageId);
    Task MoveMessageAsync(string messageId, string targetFolderId);
    Task MarkAsReadAsync(string messageId, bool isRead);
    Task ToggleFlagAsync(string messageId);
    List<MailFolder> GetFolders();
    Task<List<EmailMessage>> SearchMessagesAsync(string query);
}
