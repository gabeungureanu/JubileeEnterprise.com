using System.Windows;
using System.Windows.Input;
using System.Windows.Media;

namespace JubileeOutlook.Views;

/// <summary>
/// A themed message dialog that replaces the standard Windows MessageBox
/// to match the JubileeOutlook dark theme.
/// </summary>
public partial class MessageDialog : Window
{
    public enum DialogIcon
    {
        None,
        Information,
        Warning,
        Error,
        Success,
        Question
    }

    public enum DialogButtons
    {
        OK,
        OKCancel,
        YesNo,
        YesNoCancel
    }

    public enum MessageDialogResult
    {
        None,
        OK,
        Cancel,
        Yes,
        No
    }

    public MessageDialogResult Result { get; private set; } = MessageDialogResult.None;

    public MessageDialog()
    {
        InitializeComponent();
    }

    private MessageDialog(string message, string title, DialogIcon icon, DialogButtons buttons)
        : this()
    {
        TitleText.Text = title;
        Title = title;
        MessageText.Text = message;

        ConfigureIcon(icon);
        ConfigureButtons(buttons);
    }

    private void ConfigureIcon(DialogIcon icon)
    {
        // Material Icons unicode characters
        // Error: e000 (error), Warning: e002 (warning), Info: e88e (info), Success: e876 (check_circle), Question: e8fd (help)
        switch (icon)
        {
            case DialogIcon.Error:
                IconText.Text = "\ue000";
                IconText.Foreground = new SolidColorBrush(Color.FromRgb(0xE5, 0x39, 0x35)); // Red
                IconBorder.Background = new SolidColorBrush(Color.FromArgb(0x33, 0xE5, 0x39, 0x35));
                break;

            case DialogIcon.Warning:
                IconText.Text = "\ue002";
                IconText.Foreground = new SolidColorBrush(Color.FromRgb(0xFF, 0xB3, 0x00)); // Amber
                IconBorder.Background = new SolidColorBrush(Color.FromArgb(0x33, 0xFF, 0xB3, 0x00));
                break;

            case DialogIcon.Information:
                IconText.Text = "\ue88e";
                IconText.Foreground = new SolidColorBrush(Color.FromRgb(0x29, 0xB6, 0xF6)); // Light Blue
                IconBorder.Background = new SolidColorBrush(Color.FromArgb(0x33, 0x29, 0xB6, 0xF6));
                break;

            case DialogIcon.Success:
                IconText.Text = "\ue876";
                IconText.Foreground = new SolidColorBrush(Color.FromRgb(0x66, 0xBB, 0x6A)); // Green
                IconBorder.Background = new SolidColorBrush(Color.FromArgb(0x33, 0x66, 0xBB, 0x6A));
                break;

            case DialogIcon.Question:
                IconText.Text = "\ue8fd";
                IconText.Foreground = new SolidColorBrush(Color.FromRgb(0xBA, 0x68, 0xC8)); // Purple
                IconBorder.Background = new SolidColorBrush(Color.FromArgb(0x33, 0xBA, 0x68, 0xC8));
                break;

            case DialogIcon.None:
            default:
                IconBorder.Visibility = Visibility.Collapsed;
                break;
        }
    }

    private void ConfigureButtons(DialogButtons buttons)
    {
        switch (buttons)
        {
            case DialogButtons.OK:
                PrimaryButton.Content = "OK";
                SecondaryButton.Visibility = Visibility.Collapsed;
                break;

            case DialogButtons.OKCancel:
                PrimaryButton.Content = "OK";
                SecondaryButton.Content = "Cancel";
                SecondaryButton.Visibility = Visibility.Visible;
                break;

            case DialogButtons.YesNo:
                PrimaryButton.Content = "Yes";
                SecondaryButton.Content = "No";
                SecondaryButton.Visibility = Visibility.Visible;
                break;

            case DialogButtons.YesNoCancel:
                PrimaryButton.Content = "Yes";
                SecondaryButton.Content = "No";
                SecondaryButton.Visibility = Visibility.Visible;
                break;
        }
    }

    private void TitleBar_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ClickCount == 1)
        {
            DragMove();
        }
    }

    private void CloseButton_Click(object sender, RoutedEventArgs e)
    {
        Result = MessageDialogResult.Cancel;
        Close();
    }

    private void PrimaryButton_Click(object sender, RoutedEventArgs e)
    {
        var buttonText = PrimaryButton.Content?.ToString() ?? "OK";
        Result = buttonText switch
        {
            "Yes" => MessageDialogResult.Yes,
            _ => MessageDialogResult.OK
        };
        Close();
    }

    private void SecondaryButton_Click(object sender, RoutedEventArgs e)
    {
        var buttonText = SecondaryButton.Content?.ToString() ?? "Cancel";
        Result = buttonText switch
        {
            "No" => MessageDialogResult.No,
            _ => MessageDialogResult.Cancel
        };
        Close();
    }

    #region Static Show Methods

    /// <summary>
    /// Shows a themed message dialog with a single OK button.
    /// </summary>
    public static void Show(string message, string title = "Message", DialogIcon icon = DialogIcon.Information)
    {
        var dialog = new MessageDialog(message, title, icon, DialogButtons.OK);
        dialog.ShowDialog();
    }

    /// <summary>
    /// Shows a themed message dialog with a single OK button, owned by a parent window.
    /// </summary>
    public static void Show(Window? owner, string message, string title = "Message", DialogIcon icon = DialogIcon.Information)
    {
        var dialog = new MessageDialog(message, title, icon, DialogButtons.OK);
        if (owner != null && IsWindowValid(owner))
        {
            dialog.Owner = owner;
        }
        dialog.ShowDialog();
    }

    /// <summary>
    /// Checks if a window is valid for use as an owner (loaded, visible, not closed).
    /// </summary>
    private static bool IsWindowValid(Window? window)
    {
        if (window == null) return false;

        try
        {
            // Check if window is loaded, visible, and not being closed
            return window.IsLoaded && window.IsVisible && !window.Dispatcher.HasShutdownStarted;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Shows a themed message dialog and returns the user's choice.
    /// </summary>
    public static MessageDialogResult ShowDialog(string message, string title, DialogIcon icon, DialogButtons buttons)
    {
        var dialog = new MessageDialog(message, title, icon, buttons);
        dialog.ShowDialog();
        return dialog.Result;
    }

    /// <summary>
    /// Shows a themed message dialog with an owner window and returns the user's choice.
    /// </summary>
    public static MessageDialogResult ShowDialog(Window? owner, string message, string title, DialogIcon icon, DialogButtons buttons)
    {
        var dialog = new MessageDialog(message, title, icon, buttons);
        if (owner != null && IsWindowValid(owner))
        {
            dialog.Owner = owner;
        }
        dialog.ShowDialog();
        return dialog.Result;
    }

    /// <summary>
    /// Shows an error message dialog.
    /// </summary>
    public static void ShowError(string message, string title = "Error")
    {
        Show(message, title, DialogIcon.Error);
    }

    /// <summary>
    /// Shows an error message dialog with an owner window.
    /// </summary>
    public static void ShowError(Window? owner, string message, string title = "Error")
    {
        Show(owner, message, title, DialogIcon.Error);
    }

    /// <summary>
    /// Shows a warning message dialog.
    /// </summary>
    public static void ShowWarning(string message, string title = "Warning")
    {
        Show(message, title, DialogIcon.Warning);
    }

    /// <summary>
    /// Shows a warning message dialog with an owner window.
    /// </summary>
    public static void ShowWarning(Window? owner, string message, string title = "Warning")
    {
        Show(owner, message, title, DialogIcon.Warning);
    }

    /// <summary>
    /// Shows an information message dialog.
    /// </summary>
    public static void ShowInfo(string message, string title = "Information")
    {
        Show(message, title, DialogIcon.Information);
    }

    /// <summary>
    /// Shows an information message dialog with an owner window.
    /// </summary>
    public static void ShowInfo(Window? owner, string message, string title = "Information")
    {
        Show(owner, message, title, DialogIcon.Information);
    }

    /// <summary>
    /// Shows a success message dialog.
    /// </summary>
    public static void ShowSuccess(string message, string title = "Success")
    {
        Show(message, title, DialogIcon.Success);
    }

    /// <summary>
    /// Shows a success message dialog with an owner window.
    /// </summary>
    public static void ShowSuccess(Window? owner, string message, string title = "Success")
    {
        Show(owner, message, title, DialogIcon.Success);
    }

    /// <summary>
    /// Shows a Yes/No question dialog and returns true if Yes was clicked.
    /// </summary>
    public static bool AskQuestion(string message, string title = "Question")
    {
        var result = ShowDialog(message, title, DialogIcon.Question, DialogButtons.YesNo);
        return result == MessageDialogResult.Yes;
    }

    /// <summary>
    /// Shows a Yes/No question dialog with an owner window and returns true if Yes was clicked.
    /// </summary>
    public static bool AskQuestion(Window? owner, string message, string title = "Question")
    {
        var result = ShowDialog(owner, message, title, DialogIcon.Question, DialogButtons.YesNo);
        return result == MessageDialogResult.Yes;
    }

    #endregion
}
