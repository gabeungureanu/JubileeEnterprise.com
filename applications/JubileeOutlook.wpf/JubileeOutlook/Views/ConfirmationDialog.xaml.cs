using System.Windows;
using System.Windows.Input;

namespace JubileeOutlook.Views;

public partial class ConfirmationDialog : Window
{
    public enum DialogType
    {
        Warning,
        Info,
        Error,
        Question
    }

    public bool Result { get; private set; }

    public ConfirmationDialog()
    {
        InitializeComponent();
    }

    public ConfirmationDialog(string title, string message, string yesText = "Yes", string noText = "No", DialogType type = DialogType.Warning)
        : this()
    {
        TitleText.Text = title;
        MessageText.Text = message;
        YesButton.Content = yesText;
        NoButton.Content = noText;
        Title = title;
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
        Result = false;
        DialogResult = false;
        Close();
    }

    private void YesButton_Click(object sender, RoutedEventArgs e)
    {
        Result = true;
        DialogResult = true;
        Close();
    }

    private void NoButton_Click(object sender, RoutedEventArgs e)
    {
        Result = false;
        DialogResult = false;
        Close();
    }

    /// <summary>
    /// Static helper method to show a confirmation dialog
    /// </summary>
    /// <param name="owner">The owner window</param>
    /// <param name="title">Dialog title</param>
    /// <param name="message">Message to display</param>
    /// <param name="yesText">Text for the confirm button</param>
    /// <param name="noText">Text for the cancel button</param>
    /// <param name="type">Type of dialog (affects icon)</param>
    /// <returns>True if confirmed, false otherwise</returns>
    public static bool Show(Window? owner, string title, string message, string yesText = "Yes", string noText = "No", DialogType type = DialogType.Warning)
    {
        var dialog = new ConfirmationDialog(title, message, yesText, noText, type);

        if (owner != null)
        {
            dialog.Owner = owner;
        }

        dialog.ShowDialog();
        return dialog.Result;
    }

    /// <summary>
    /// Static helper method to show a delete confirmation dialog
    /// </summary>
    public static bool ShowDeleteConfirmation(Window? owner, string itemName)
    {
        return Show(
            owner,
            "Delete Event",
            $"Are you sure you want to delete the event '{itemName}'?\n\nThis action cannot be undone.",
            "Delete",
            "Cancel",
            DialogType.Warning
        );
    }
}
