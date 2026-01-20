using System.Windows;
using System.Windows.Input;

namespace JubileeOutlook.Views;

/// <summary>
/// Dialog for entering email password or app password
/// </summary>
public partial class PasswordInputDialog : Window
{
    public string Password => PasswordBox.Password;

    public PasswordInputDialog(string emailAddress, string providerName, bool isAppPassword, string helpText)
    {
        InitializeComponent();

        EmailText.Text = $"Enter password for: {emailAddress}";
        ProviderText.Text = $"Provider: {providerName}";

        if (isAppPassword)
        {
            PasswordLabel.Text = "App Password:";
            Title = "App Password Required";
        }
        else
        {
            PasswordLabel.Text = "Password:";
            Title = "Password Required";
        }

        HelpText.Text = helpText;

        // Focus password box when loaded
        Loaded += (s, e) => PasswordBox.Focus();
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

    private void ConfirmButton_Click(object sender, RoutedEventArgs e)
    {
        if (string.IsNullOrWhiteSpace(PasswordBox.Password))
        {
            MessageBox.Show("Please enter your password.", "Password Required", MessageBoxButton.OK, MessageBoxImage.Warning);
            PasswordBox.Focus();
            return;
        }

        DialogResult = true;
        Close();
    }

    private void PasswordBox_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter)
        {
            ConfirmButton_Click(sender, e);
        }
        else if (e.Key == Key.Escape)
        {
            CancelButton_Click(sender, e);
        }
    }
}
