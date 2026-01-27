using System.Windows;
using System.Windows.Input;
using JubileeOutlook.Services;

namespace JubileeOutlook.Views;

/// <summary>
/// Dialog for managing email signatures
/// </summary>
public partial class SignatureManagementDialog : Window
{
    private readonly EmailSignatureService _signatureService;
    private EmailSignature? _currentSignature;
    private bool _isNewSignature = false;

    public SignatureManagementDialog()
    {
        InitializeComponent();
        _signatureService = EmailSignatureService.Instance;

        Loaded += SignatureManagementDialog_Loaded;
    }

    private async void SignatureManagementDialog_Loaded(object sender, RoutedEventArgs e)
    {
        await _signatureService.LoadAsync();
        RefreshSignatureList();
    }

    private void RefreshSignatureList()
    {
        var signatures = _signatureService.GetSignatures();
        SignatureList.ItemsSource = signatures;

        if (_currentSignature != null)
        {
            SignatureList.SelectedItem = signatures.FirstOrDefault(s => s.Id == _currentSignature.Id);
        }
    }

    private void TitleBar_MouseDown(object sender, MouseButtonEventArgs e)
    {
        if (e.LeftButton == MouseButtonState.Pressed)
        {
            DragMove();
        }
    }

    private void CloseButton_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = true;
        Close();
    }

    private void SignatureList_SelectionChanged(object sender, System.Windows.Controls.SelectionChangedEventArgs e)
    {
        if (SignatureList.SelectedItem is EmailSignature signature)
        {
            _currentSignature = signature;
            _isNewSignature = false;
            LoadSignatureToEditor(signature);
            ShowEditor(true);
        }
    }

    private void LoadSignatureToEditor(EmailSignature signature)
    {
        SignatureNameBox.Text = signature.Name;
        SignatureContentBox.Text = signature.Content;
        IsDefaultCheckBox.IsChecked = signature.IsDefault;
    }

    private void ShowEditor(bool show)
    {
        EditorPanel.Visibility = show ? Visibility.Visible : Visibility.Collapsed;
        NoSelectionPanel.Visibility = show ? Visibility.Collapsed : Visibility.Visible;
    }

    private void AddSignature_Click(object sender, RoutedEventArgs e)
    {
        _isNewSignature = true;
        _currentSignature = null;
        SignatureList.SelectedItem = null;

        SignatureNameBox.Text = "New Signature";
        SignatureContentBox.Text = @"<p style=""color: #666; font-family: Arial, sans-serif; font-size: 12px;"">
Best regards,<br/>
<b style=""color: #000;"">Your Name</b><br/>
<span style=""color: #888;"">Your Title</span><br/>
<span style=""color: #888;"">Your Company</span>
</p>";
        IsDefaultCheckBox.IsChecked = false;

        ShowEditor(true);
        SignatureNameBox.Focus();
        SignatureNameBox.SelectAll();
    }

    private async void SaveSignature_Click(object sender, RoutedEventArgs e)
    {
        var name = SignatureNameBox.Text.Trim();
        var content = SignatureContentBox.Text;
        var isDefault = IsDefaultCheckBox.IsChecked ?? false;

        if (string.IsNullOrWhiteSpace(name))
        {
            ThemedMessageBox.Show(this, "Please enter a signature name.", "Validation", MessageBoxButton.OK, MessageBoxImage.Warning);
            SignatureNameBox.Focus();
            return;
        }

        try
        {
            if (_isNewSignature)
            {
                var newSignature = await _signatureService.AddSignatureAsync(name, content, isDefault);
                _currentSignature = newSignature;
                _isNewSignature = false;
                NotificationService.Instance.ShowSuccess("Signature created");
            }
            else if (_currentSignature != null)
            {
                await _signatureService.UpdateSignatureAsync(_currentSignature.Id, name, content, isDefault);
                NotificationService.Instance.ShowSuccess("Signature saved");
            }

            RefreshSignatureList();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SignatureManagementDialog] Error saving signature: {ex.Message}");
            ThemedMessageBox.Show(this, $"Failed to save signature: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private async void DeleteSignature_Click(object sender, RoutedEventArgs e)
    {
        if (_currentSignature == null) return;

        var result = ThemedMessageBox.Show(this,
            $"Are you sure you want to delete the signature '{_currentSignature.Name}'?",
            "Delete Signature",
            MessageBoxButton.YesNo,
            MessageBoxImage.Question);

        if (result == MessageBoxResult.Yes)
        {
            try
            {
                await _signatureService.DeleteSignatureAsync(_currentSignature.Id);
                _currentSignature = null;
                _isNewSignature = false;
                ShowEditor(false);
                RefreshSignatureList();
                NotificationService.Instance.ShowSuccess("Signature deleted");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[SignatureManagementDialog] Error deleting signature: {ex.Message}");
                ThemedMessageBox.Show(this, $"Failed to delete signature: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
    }
}
