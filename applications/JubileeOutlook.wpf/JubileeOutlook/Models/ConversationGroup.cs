using CommunityToolkit.Mvvm.ComponentModel;
using System.Collections.ObjectModel;

namespace JubileeOutlook.Models;

/// <summary>
/// Represents a group of emails in a conversation thread
/// </summary>
public partial class ConversationGroup : ObservableObject
{
    public string ConversationId { get; set; } = string.Empty;

    /// <summary>
    /// The subject line for the conversation (from the first/latest message)
    /// </summary>
    public string Subject { get; set; } = string.Empty;

    /// <summary>
    /// Participants in the conversation
    /// </summary>
    public List<string> Participants { get; set; } = new();

    /// <summary>
    /// Display string for participants
    /// </summary>
    public string ParticipantsDisplay => Participants.Count > 3
        ? $"{string.Join(", ", Participants.Take(3))} +{Participants.Count - 3} more"
        : string.Join(", ", Participants);

    /// <summary>
    /// All messages in this conversation
    /// </summary>
    public ObservableCollection<EmailMessage> Messages { get; set; } = new();

    /// <summary>
    /// The most recent message in the conversation
    /// </summary>
    public EmailMessage? LatestMessage => Messages.OrderByDescending(m => m.ReceivedDate).FirstOrDefault();

    /// <summary>
    /// Number of messages in the conversation
    /// </summary>
    public int MessageCount => Messages.Count;

    /// <summary>
    /// Number of unread messages in the conversation
    /// </summary>
    public int UnreadCount => Messages.Count(m => !m.IsRead);

    /// <summary>
    /// Whether the conversation has any unread messages
    /// </summary>
    public bool HasUnread => UnreadCount > 0;

    /// <summary>
    /// The date of the most recent message
    /// </summary>
    public DateTime LatestDate => LatestMessage?.ReceivedDate ?? DateTime.MinValue;

    /// <summary>
    /// Preview text from the latest message
    /// </summary>
    public string Preview => LatestMessage?.Preview ?? string.Empty;

    /// <summary>
    /// Whether any message in the conversation is flagged
    /// </summary>
    public bool IsFlagged => Messages.Any(m => m.IsFlagged);

    /// <summary>
    /// Whether any message has attachments
    /// </summary>
    public bool HasAttachments => Messages.Any(m => m.HasAttachments);

    [ObservableProperty]
    private bool _isExpanded = false;

    /// <summary>
    /// Creates a conversation group from a collection of messages
    /// </summary>
    public static ConversationGroup FromMessages(string conversationId, IEnumerable<EmailMessage> messages)
    {
        var messageList = messages.OrderByDescending(m => m.ReceivedDate).ToList();
        var latestMessage = messageList.FirstOrDefault();

        var participants = messageList
            .SelectMany(m => new[] { m.From }.Concat(m.To))
            .Distinct()
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .ToList();

        return new ConversationGroup
        {
            ConversationId = conversationId,
            Subject = latestMessage?.Subject?.Replace("RE: ", "").Replace("FW: ", "").Trim() ?? "No Subject",
            Participants = participants,
            Messages = new ObservableCollection<EmailMessage>(messageList)
        };
    }
}
