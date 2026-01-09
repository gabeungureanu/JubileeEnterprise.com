namespace JubileeOutlook.Models;

public class MailAccount
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string EmailAddress { get; set; } = string.Empty;
    public AccountType Type { get; set; }
    public bool IsDefault { get; set; }
    public string DisplayName { get; set; } = string.Empty;
}

public enum AccountType
{
    Exchange,
    IMAP,
    POP3,
    Outlook
}
