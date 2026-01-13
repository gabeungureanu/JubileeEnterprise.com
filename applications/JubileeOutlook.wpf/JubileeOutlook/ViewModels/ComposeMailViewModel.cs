using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using System.Collections.ObjectModel;
using System.Text.RegularExpressions;

namespace JubileeOutlook.ViewModels;

public partial class ComposeMailViewModel : ObservableObject
{
    [ObservableProperty]
    private string _from = "user@example.com";

    [ObservableProperty]
    private string _to = string.Empty;

    [ObservableProperty]
    private string _cc = string.Empty;

    [ObservableProperty]
    private string _bcc = string.Empty;

    [ObservableProperty]
    private string _subject = string.Empty;

    [ObservableProperty]
    private string _body = string.Empty;

    [ObservableProperty]
    private bool _showCc = false;

    [ObservableProperty]
    private bool _showBcc = false;

    [ObservableProperty]
    private bool _isComposing = false;

    [ObservableProperty]
    private bool _isSending = false;

    [ObservableProperty]
    private string _validationError = string.Empty;

    public ObservableCollection<AttachmentInfo> Attachments { get; } = new();

    // Events for communication with MainWindow
    public event EventHandler? MailSent;
    public event EventHandler? ComposeCancelled;
    public event EventHandler? AttachmentRequested;
    public event EventHandler<SendMailEventArgs>? SendMailRequested;

    [RelayCommand(CanExecute = nameof(CanSend))]
    private async Task Send()
    {
        // Clear previous validation errors
        ValidationError = string.Empty;

        // Validate before sending
        var validationResult = ValidateEmail();
        if (!validationResult.IsValid)
        {
            ValidationError = validationResult.ErrorMessage;
            return;
        }

        // Set sending state
        IsSending = true;

        try
        {
            // Create email data for sending
            var emailData = new SendMailEventArgs
            {
                From = From,
                To = ParseEmailAddresses(To),
                Cc = ParseEmailAddresses(Cc),
                Bcc = ParseEmailAddresses(Bcc),
                Subject = Subject,
                Body = Body,
                Attachments = Attachments.Select(a => new AttachmentData
                {
                    FileName = a.FileName,
                    FilePath = a.FilePath
                }).ToList()
            };

            // Request MainWindow to send the email via the service
            SendMailRequested?.Invoke(this, emailData);

            // Notify that mail was sent successfully
            MailSent?.Invoke(this, EventArgs.Empty);
            ClearForm();
        }
        catch (Exception ex)
        {
            ValidationError = $"Failed to send email: {ex.Message}";
        }
        finally
        {
            IsSending = false;
        }
    }

    private bool CanSend()
    {
        return !IsSending && !string.IsNullOrWhiteSpace(To);
    }

    private (bool IsValid, string ErrorMessage) ValidateEmail()
    {
        // Check if To field is empty
        if (string.IsNullOrWhiteSpace(To))
        {
            return (false, "Please enter at least one recipient in the To field.");
        }

        // Validate all email addresses in To field
        var toAddresses = ParseEmailAddresses(To);
        if (toAddresses.Count == 0)
        {
            return (false, "Please enter at least one valid email address in the To field.");
        }

        foreach (var email in toAddresses)
        {
            if (!IsValidEmail(email))
            {
                return (false, $"Invalid email address: {email}");
            }
        }

        // Validate Cc addresses if present
        if (!string.IsNullOrWhiteSpace(Cc))
        {
            var ccAddresses = ParseEmailAddresses(Cc);
            foreach (var email in ccAddresses)
            {
                if (!IsValidEmail(email))
                {
                    return (false, $"Invalid Cc email address: {email}");
                }
            }
        }

        // Validate Bcc addresses if present
        if (!string.IsNullOrWhiteSpace(Bcc))
        {
            var bccAddresses = ParseEmailAddresses(Bcc);
            foreach (var email in bccAddresses)
            {
                if (!IsValidEmail(email))
                {
                    return (false, $"Invalid Bcc email address: {email}");
                }
            }
        }

        return (true, string.Empty);
    }

    private static bool IsValidEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return false;

        // Standard email validation regex pattern
        var emailPattern = @"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$";
        return Regex.IsMatch(email.Trim(), emailPattern);
    }

    private static List<string> ParseEmailAddresses(string input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return new List<string>();

        // Split by comma or semicolon and trim whitespace
        return input.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
                    .Select(e => e.Trim())
                    .Where(e => !string.IsNullOrWhiteSpace(e))
                    .ToList();
    }

    [RelayCommand]
    private void ShowCcField()
    {
        ShowCc = true;
    }

    [RelayCommand]
    private void ShowBccField()
    {
        ShowBcc = true;
    }

    [RelayCommand]
    private void Cancel()
    {
        ComposeCancelled?.Invoke(this, EventArgs.Empty);
        ClearForm();
    }

    [RelayCommand]
    private void Attach()
    {
        // Raise event to trigger file selection in the view
        AttachmentRequested?.Invoke(this, EventArgs.Empty);
    }

    [RelayCommand]
    private void RemoveAttachment(AttachmentInfo attachment)
    {
        Attachments.Remove(attachment);
    }

    [RelayCommand]
    private void Format(string formatType)
    {
        // TODO: Implement text formatting logic
    }

    public void AddAttachment(string filePath)
    {
        var fileInfo = new System.IO.FileInfo(filePath);
        var attachment = new AttachmentInfo
        {
            FileName = fileInfo.Name,
            FilePath = filePath,
            FileSize = FormatFileSize(fileInfo.Length)
        };
        Attachments.Add(attachment);
    }

    private string FormatFileSize(long bytes)
    {
        string[] sizes = { "B", "KB", "MB", "GB" };
        double len = bytes;
        int order = 0;
        while (len >= 1024 && order < sizes.Length - 1)
        {
            order++;
            len /= 1024;
        }
        return $"{len:0.##} {sizes[order]}";
    }

    private void ClearForm()
    {
        To = string.Empty;
        Cc = string.Empty;
        Bcc = string.Empty;
        Subject = string.Empty;
        Body = string.Empty;
        ShowCc = false;
        ShowBcc = false;
        IsComposing = false;
        IsSending = false;
        ValidationError = string.Empty;
        Attachments.Clear();
    }

    public void StartComposing(string? fromEmail = null)
    {
        // Always clear the form first to ensure a fresh compose state
        ClearForm();

        IsComposing = true;

        // Set the From field to the provided email, or keep default if not provided
        if (!string.IsNullOrEmpty(fromEmail))
        {
            From = fromEmail;
        }
    }

    /// <summary>
    /// Sets the message body content (used when updating from RichTextBox)
    /// </summary>
    public void SetBodyContent(string content)
    {
        Body = content;
    }
}

public class AttachmentInfo
{
    public string FileName { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public string FileSize { get; set; } = string.Empty;
}

public class AttachmentData
{
    public string FileName { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
}

public class SendMailEventArgs : EventArgs
{
    public string From { get; set; } = string.Empty;
    public List<string> To { get; set; } = new();
    public List<string> Cc { get; set; } = new();
    public List<string> Bcc { get; set; } = new();
    public string Subject { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public List<AttachmentData> Attachments { get; set; } = new();
}
