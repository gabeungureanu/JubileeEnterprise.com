using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using System.Collections.ObjectModel;

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

    public ObservableCollection<AttachmentInfo> Attachments { get; } = new();

    public event EventHandler? MailSent;
    public event EventHandler? ComposeCancelled;
    public event EventHandler? AttachmentRequested;

    [RelayCommand]
    private void Send()
    {
        // TODO: Implement actual email sending logic
        MailSent?.Invoke(this, EventArgs.Empty);
        ClearForm();
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
        Attachments.Clear();
    }

    public void StartComposing()
    {
        IsComposing = true;
    }
}

public class AttachmentInfo
{
    public string FileName { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public string FileSize { get; set; } = string.Empty;
}
