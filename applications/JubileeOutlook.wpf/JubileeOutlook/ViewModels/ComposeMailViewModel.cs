using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using System.Collections.ObjectModel;
using System.Text.RegularExpressions;
using System.Windows.Threading;
using JubileeOutlook.Services;

namespace JubileeOutlook.ViewModels;

public partial class ComposeMailViewModel : ObservableObject
{
    private readonly DispatcherTimer _autoSaveTimer;
    private string _lastSavedContent = string.Empty;
    private bool _hasUnsavedChanges = false;

    [ObservableProperty]
    private string _from = "user@example.com";

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(SendCommand))]
    [NotifyCanExecuteChangedFor(nameof(SaveDraftCommand))]
    private string _to = string.Empty;

    [ObservableProperty]
    private string _cc = string.Empty;

    [ObservableProperty]
    private string _bcc = string.Empty;

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(SaveDraftCommand))]
    private string _subject = string.Empty;

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(SaveDraftCommand))]
    private string _body = string.Empty;

    [ObservableProperty]
    private bool _showCc = false;

    [ObservableProperty]
    private bool _showBcc = false;

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(SaveDraftCommand))]
    private bool _isComposing = false;

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(SendCommand))]
    [NotifyCanExecuteChangedFor(nameof(SaveDraftCommand))]
    private bool _isSending = false;

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(SendCommand))]
    [NotifyCanExecuteChangedFor(nameof(SaveDraftCommand))]
    private bool _isSavingDraft = false;

    [ObservableProperty]
    private string _validationError = string.Empty;

    [ObservableProperty]
    private string? _currentDraftId = null;

    [ObservableProperty]
    private string _draftStatus = string.Empty;

    public ObservableCollection<AttachmentInfo> Attachments { get; } = new();

    // List of embedded images in the email body (for CID attachments)
    public List<EmbeddedImageData> EmbeddedImages { get; } = new();

    // Signature support
    private readonly EmailSignatureService _signatureService = EmailSignatureService.Instance;

    [ObservableProperty]
    private ObservableCollection<EmailSignature> _availableSignatures = new();

    [ObservableProperty]
    private EmailSignature? _selectedSignature;

    [ObservableProperty]
    private bool _includeSignature = true;

    // Event to request signature insertion in the view
    public event EventHandler<string>? InsertSignatureRequested;

    // Event to request opening signature management dialog
    public event EventHandler? ManageSignaturesRequested;

    // Events for communication with MainWindow
    public event EventHandler? MailSent;
    public event EventHandler? ComposeCancelled;
    public event EventHandler? AttachmentRequested;
    public event EventHandler<SendMailEventArgs>? SendMailRequested;
    public event EventHandler<SaveDraftEventArgs>? SaveDraftRequested;

    public ComposeMailViewModel()
    {
        // Initialize auto-save timer (30 seconds interval)
        _autoSaveTimer = new DispatcherTimer
        {
            Interval = TimeSpan.FromSeconds(30)
        };
        _autoSaveTimer.Tick += OnAutoSaveTick;
    }

    [RelayCommand(CanExecute = nameof(CanSend))]
    private Task Send()
    {
        // Clear previous validation errors
        ValidationError = string.Empty;

        // Validate before sending
        var validationResult = ValidateEmail();
        if (!validationResult.IsValid)
        {
            ValidationError = validationResult.ErrorMessage;
            return Task.CompletedTask;
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
                }).ToList(),
                EmbeddedImages = EmbeddedImages.ToList()
            };

            // Request MainWindow to send the email via the service
            // MainWindow will call NotifyMailSentSuccess() or set error when complete
            SendMailRequested?.Invoke(this, emailData);
        }
        catch (Exception ex)
        {
            ValidationError = $"Failed to send email: {ex.Message}";
            IsSending = false;
        }

        return Task.CompletedTask;
    }

    /// <summary>
    /// Called by MainWindow when send operation completes successfully
    /// </summary>
    public void NotifyMailSentSuccess()
    {
        IsSending = false;
        MailSent?.Invoke(this, EventArgs.Empty);
        ClearForm();
    }

    /// <summary>
    /// Called by MainWindow when send operation fails
    /// </summary>
    public void NotifyMailSentFailed(string errorMessage)
    {
        IsSending = false;
        ValidationError = errorMessage;
    }

    private bool CanSend()
    {
        return !IsSending && !IsSavingDraft && !string.IsNullOrWhiteSpace(To);
    }

    private void OnAutoSaveTick(object? sender, EventArgs e)
    {
        // Only auto-save if composing and there are unsaved changes
        if (IsComposing && HasContentToSave() && _hasUnsavedChanges)
        {
            _ = SaveDraftInternalAsync(isAutoSave: true);
        }
    }

    private bool HasContentToSave()
    {
        // Check if there's any content worth saving
        return !string.IsNullOrWhiteSpace(To) ||
               !string.IsNullOrWhiteSpace(Subject) ||
               !string.IsNullOrWhiteSpace(Body);
    }

    private string GetContentHash()
    {
        // Create a simple hash of the current content to detect changes
        return $"{To}|{Cc}|{Bcc}|{Subject}|{Body}|{string.Join(",", Attachments.Select(a => a.FilePath))}";
    }

    [RelayCommand(CanExecute = nameof(CanSaveDraft))]
    private async Task SaveDraft()
    {
        await SaveDraftInternalAsync(isAutoSave: false);
    }

    private bool CanSaveDraft()
    {
        return !IsSending && !IsSavingDraft && IsComposing && HasContentToSave();
    }

    private Task SaveDraftInternalAsync(bool isAutoSave)
    {
        if (IsSavingDraft) return Task.CompletedTask;

        var currentHash = GetContentHash();
        if (currentHash == _lastSavedContent && !string.IsNullOrEmpty(CurrentDraftId))
        {
            // No changes since last save
            return Task.CompletedTask;
        }

        IsSavingDraft = true;
        DraftStatus = "Saving...";

        try
        {
            var draftData = new SaveDraftEventArgs
            {
                DraftId = CurrentDraftId,
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
                }).ToList(),
                EmbeddedImages = EmbeddedImages.ToList()
            };

            // Request MainWindow to save the draft via the service
            SaveDraftRequested?.Invoke(this, draftData);

            _lastSavedContent = currentHash;
            _hasUnsavedChanges = false;
            DraftStatus = isAutoSave ? "Draft saved" : "Draft saved";

            // Clear status after a delay
            _ = ClearDraftStatusAfterDelay();
        }
        catch (Exception ex)
        {
            DraftStatus = $"Failed to save: {ex.Message}";
        }
        finally
        {
            IsSavingDraft = false;
        }

        return Task.CompletedTask;
    }

    private async Task ClearDraftStatusAfterDelay()
    {
        await Task.Delay(3000);
        if (DraftStatus == "Draft saved")
        {
            DraftStatus = string.Empty;
        }
    }

    public void SetDraftId(string draftId)
    {
        CurrentDraftId = draftId;
    }

    public void MarkAsChanged()
    {
        _hasUnsavedChanges = true;
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

    [RelayCommand]
    private void ManageSignatures()
    {
        ManageSignaturesRequested?.Invoke(this, EventArgs.Empty);
    }

    [RelayCommand]
    private void InsertSignature()
    {
        if (SelectedSignature != null && IncludeSignature)
        {
            var formattedSignature = _signatureService.FormatSignatureForEmail(SelectedSignature, asHtml: true);
            InsertSignatureRequested?.Invoke(this, formattedSignature);
        }
    }

    [RelayCommand]
    private void ChangeSignature(EmailSignature? signature)
    {
        SelectedSignature = signature;
    }

    /// <summary>
    /// Load available signatures from the service
    /// </summary>
    public async Task LoadSignaturesAsync()
    {
        await _signatureService.LoadAsync();
        var signatures = _signatureService.GetSignatures();

        AvailableSignatures.Clear();
        foreach (var sig in signatures)
        {
            AvailableSignatures.Add(sig);
        }

        // Select default signature if available
        SelectedSignature = _signatureService.GetDefaultSignature();
    }

    /// <summary>
    /// Get the formatted signature content for the current selection
    /// </summary>
    public string GetFormattedSignature(bool asHtml = true)
    {
        if (SelectedSignature != null && IncludeSignature)
        {
            return _signatureService.FormatSignatureForEmail(SelectedSignature, asHtml);
        }
        return string.Empty;
    }

    /// <summary>
    /// Refresh the signature list (call after managing signatures)
    /// </summary>
    public void RefreshSignatures()
    {
        var signatures = _signatureService.GetSignatures();

        AvailableSignatures.Clear();
        foreach (var sig in signatures)
        {
            AvailableSignatures.Add(sig);
        }

        // Re-select the current signature if it still exists
        if (SelectedSignature != null)
        {
            SelectedSignature = AvailableSignatures.FirstOrDefault(s => s.Id == SelectedSignature.Id)
                               ?? _signatureService.GetDefaultSignature();
        }
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
        // Stop auto-save timer
        _autoSaveTimer.Stop();

        To = string.Empty;
        Cc = string.Empty;
        Bcc = string.Empty;
        Subject = string.Empty;
        Body = string.Empty;
        ShowCc = false;
        ShowBcc = false;
        IsComposing = false;
        IsSending = false;
        IsSavingDraft = false;
        ValidationError = string.Empty;
        DraftStatus = string.Empty;
        CurrentDraftId = null;
        _lastSavedContent = string.Empty;
        _hasUnsavedChanges = false;
        Attachments.Clear();
        EmbeddedImages.Clear();
    }

    public async void StartComposing(string? fromEmail = null)
    {
        // Always clear the form first to ensure a fresh compose state
        ClearForm();

        IsComposing = true;

        // Set the From field to the provided email, or keep default if not provided
        if (!string.IsNullOrEmpty(fromEmail))
        {
            From = fromEmail;
        }

        // Load signatures
        await LoadSignaturesAsync();

        // Start auto-save timer
        _autoSaveTimer.Start();
    }

    /// <summary>
    /// Start composing a new email with pre-filled recipient
    /// </summary>
    public async void StartComposingTo(string? fromEmail, string toEmail)
    {
        // Always clear the form first to ensure a fresh compose state
        ClearForm();

        IsComposing = true;

        // Set the From field to the provided email, or keep default if not provided
        if (!string.IsNullOrEmpty(fromEmail))
        {
            From = fromEmail;
        }

        // Set the To field with the recipient
        if (!string.IsNullOrEmpty(toEmail))
        {
            To = toEmail;
        }

        // Load signatures
        await LoadSignaturesAsync();

        // Start auto-save timer
        _autoSaveTimer.Start();
    }

    public async void LoadDraft(string draftId, string to, string cc, string bcc, string subject, string body, string? fromEmail = null, List<AttachmentInfo>? attachments = null)
    {
        // Clear and start fresh
        ClearForm();

        IsComposing = true;
        CurrentDraftId = draftId;

        // Set the From field
        if (!string.IsNullOrEmpty(fromEmail))
        {
            From = fromEmail;
        }

        // Load draft content
        To = to;
        Cc = cc;
        Bcc = bcc;
        Subject = subject;
        Body = body;

        // Show Cc/Bcc fields if they have content
        ShowCc = !string.IsNullOrWhiteSpace(cc);
        ShowBcc = !string.IsNullOrWhiteSpace(bcc);

        // Load attachments if provided
        if (attachments != null && attachments.Count > 0)
        {
            foreach (var attachment in attachments)
            {
                Attachments.Add(attachment);
            }
        }

        // Store the initial content hash so we don't immediately re-save
        _lastSavedContent = GetContentHash();
        _hasUnsavedChanges = false;

        // Load signatures (but don't auto-insert for drafts)
        await LoadSignaturesAsync();

        // Start auto-save timer
        _autoSaveTimer.Start();
    }

    /// <summary>
    /// Sets the message body content (used when updating from RichTextBox)
    /// </summary>
    public void SetBodyContent(string content)
    {
        Body = content;
    }

    /// <summary>
    /// Start composing a reply to a message
    /// </summary>
    public async void StartReply(string fromEmail, string toEmail, string toName, string originalSubject, string originalBody, DateTime originalDate, bool isHtml = false)
    {
        ClearForm();
        IsComposing = true;

        From = fromEmail;
        To = toEmail;
        Subject = originalSubject.StartsWith("RE:", StringComparison.OrdinalIgnoreCase)
            ? originalSubject
            : "RE: " + originalSubject;

        // Build reply body with original message quote
        var quotedBody = BuildQuotedBody(toName, toEmail, originalDate, originalSubject, originalBody, isHtml);
        Body = quotedBody;

        // Load signatures
        await LoadSignaturesAsync();

        _autoSaveTimer.Start();
    }

    /// <summary>
    /// Start composing a reply-all to a message
    /// </summary>
    public async void StartReplyAll(string fromEmail, string toEmail, string toName, string originalCc, string originalSubject, string originalBody, DateTime originalDate, bool isHtml = false)
    {
        ClearForm();
        IsComposing = true;

        From = fromEmail;
        To = toEmail;

        // Add CC recipients if any
        if (!string.IsNullOrWhiteSpace(originalCc))
        {
            Cc = originalCc;
            ShowCc = true;
        }

        Subject = originalSubject.StartsWith("RE:", StringComparison.OrdinalIgnoreCase)
            ? originalSubject
            : "RE: " + originalSubject;

        // Build reply body with original message quote
        var quotedBody = BuildQuotedBody(toName, toEmail, originalDate, originalSubject, originalBody, isHtml);
        Body = quotedBody;

        // Load signatures
        await LoadSignaturesAsync();

        _autoSaveTimer.Start();
    }

    /// <summary>
    /// Start composing a forwarded message
    /// </summary>
    public async void StartForward(string fromEmail, string originalFrom, string originalFromEmail, string originalTo, string originalSubject, string originalBody, DateTime originalDate, List<AttachmentInfo>? attachments = null, bool isHtml = false)
    {
        ClearForm();
        IsComposing = true;

        From = fromEmail;
        // To field is empty for forward - user needs to specify recipient
        To = string.Empty;

        Subject = originalSubject.StartsWith("FW:", StringComparison.OrdinalIgnoreCase)
            ? originalSubject
            : "FW: " + originalSubject;

        // Build forwarded message body
        var forwardBody = BuildForwardedBody(originalFrom, originalFromEmail, originalTo, originalDate, originalSubject, originalBody, isHtml);
        Body = forwardBody;

        // Include original attachments
        if (attachments != null && attachments.Count > 0)
        {
            foreach (var attachment in attachments)
            {
                Attachments.Add(attachment);
            }
        }

        // Load signatures
        await LoadSignaturesAsync();

        _autoSaveTimer.Start();
    }

    private string BuildQuotedBody(string senderName, string senderEmail, DateTime sentDate, string subject, string originalBody, bool isHtml)
    {
        if (isHtml)
        {
            return $@"<br/><br/>
<div style='border-left: 2px solid #ccc; padding-left: 10px; margin-left: 5px; color: #666;'>
{originalBody}
</div>";
        }
        else
        {
            return $@"


-------- Original Message --------

{originalBody}";
        }
    }

    private string BuildForwardedBody(string senderName, string senderEmail, string originalTo, DateTime sentDate, string subject, string originalBody, bool isHtml)
    {
        if (isHtml)
        {
            return $@"<br/><br/>
<div style='border-top: 1px solid #ccc; padding-top: 10px;'>
<p><b>---------- Forwarded message ----------</b></p>
{originalBody}
</div>";
        }
        else
        {
            return $@"


---------- Forwarded message ----------

{originalBody}";
        }
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
    public List<EmbeddedImageData> EmbeddedImages { get; set; } = new();
}

public class EmbeddedImageData
{
    public string ContentId { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
}

public class SaveDraftEventArgs : EventArgs
{
    public string? DraftId { get; set; }
    public string From { get; set; } = string.Empty;
    public List<string> To { get; set; } = new();
    public List<string> Cc { get; set; } = new();
    public List<string> Bcc { get; set; } = new();
    public string Subject { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public List<AttachmentData> Attachments { get; set; } = new();
    public List<EmbeddedImageData> EmbeddedImages { get; set; } = new();
}
