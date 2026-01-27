using System.Windows;
using System.Windows.Input;

namespace JubileeOutlook.Views;

/// <summary>
/// Dialog for text input (folder name, etc.)
/// </summary>
public partial class InputDialog : Window
{
    /// <summary>
    /// Gets the input value entered by the user
    /// </summary>
    public string InputValue => InputBox.Text;

    /// <summary>
    /// Creates a new input dialog
    /// </summary>
    /// <param name="title">Dialog title</param>
    /// <param name="prompt">Prompt text</param>
    /// <param name="defaultValue">Default value for the input box</param>
    public InputDialog(string title, string prompt, string defaultValue = "")
    {
        InitializeComponent();

        TitleText.Text = title;
        Title = title;
        PromptText.Text = prompt;
        InputBox.Text = defaultValue;

        // Focus and select all text when loaded
        Loaded += (s, e) =>
        {
            InputBox.Focus();
            InputBox.SelectAll();
        };
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
        DialogResult = false;
        Close();
    }

    private void CancelButton_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
        Close();
    }

    private void OkButton_Click(object sender, RoutedEventArgs e)
    {
        if (string.IsNullOrWhiteSpace(InputBox.Text))
        {
            MessageBox.Show("Please enter a value.", "Input Required", MessageBoxButton.OK, MessageBoxImage.Warning);
            InputBox.Focus();
            return;
        }

        DialogResult = true;
        Close();
    }

    private void InputBox_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter)
        {
            OkButton_Click(sender, e);
        }
        else if (e.Key == Key.Escape)
        {
            CancelButton_Click(sender, e);
        }
    }
}
