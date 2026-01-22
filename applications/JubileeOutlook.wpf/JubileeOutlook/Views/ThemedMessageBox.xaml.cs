using System.Windows;
using System.Windows.Input;
using System.Windows.Media;

namespace JubileeOutlook.Views;

/// <summary>
/// Custom themed message box matching the JubileeOutlook dark theme
/// </summary>
public partial class ThemedMessageBox : Window
{
    public MessageBoxResult Result { get; private set; } = MessageBoxResult.None;

    private ThemedMessageBox()
    {
        InitializeComponent();
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
        Result = MessageBoxResult.Cancel;
        Close();
    }

    private void OkButton_Click(object sender, RoutedEventArgs e)
    {
        Result = MessageBoxResult.OK;
        Close();
    }

    private void YesButton_Click(object sender, RoutedEventArgs e)
    {
        Result = MessageBoxResult.Yes;
        Close();
    }

    private void NoButton_Click(object sender, RoutedEventArgs e)
    {
        Result = MessageBoxResult.No;
        Close();
    }

    private void CancelButton_Click(object sender, RoutedEventArgs e)
    {
        Result = MessageBoxResult.Cancel;
        Close();
    }

    private void SetupIcon(MessageBoxImage image)
    {
        switch (image)
        {
            case MessageBoxImage.Error:
                IconBorder.Background = new SolidColorBrush(Color.FromRgb(0xDC, 0x36, 0x45)); // Red
                IconText.Text = "\ue000"; // Error icon
                IconText.Foreground = Brushes.White;
                break;

            case MessageBoxImage.Warning:
                IconBorder.Background = new SolidColorBrush(Color.FromRgb(0xFF, 0xB8, 0x4D)); // Gold/Orange
                IconText.Text = "\ue002"; // Warning icon
                IconText.Foreground = new SolidColorBrush(Color.FromRgb(0x1E, 0x1E, 0x1E));
                break;

            case MessageBoxImage.Information:
                IconBorder.Background = new SolidColorBrush(Color.FromRgb(0x00, 0x78, 0xD4)); // Blue
                IconText.Text = "\ue88e"; // Info icon
                IconText.Foreground = Brushes.White;
                break;

            case MessageBoxImage.Question:
                IconBorder.Background = new SolidColorBrush(Color.FromRgb(0x00, 0x78, 0xD4)); // Blue
                IconText.Text = "\ue887"; // Help/Question icon
                IconText.Foreground = Brushes.White;
                break;

            default:
                IconBorder.Visibility = Visibility.Collapsed;
                break;
        }
    }

    private void SetupButtons(MessageBoxButton button)
    {
        switch (button)
        {
            case MessageBoxButton.OK:
                OkButton.Visibility = Visibility.Visible;
                break;

            case MessageBoxButton.OKCancel:
                OkButton.Visibility = Visibility.Visible;
                CancelButton.Visibility = Visibility.Visible;
                break;

            case MessageBoxButton.YesNo:
                YesButton.Visibility = Visibility.Visible;
                NoButton.Visibility = Visibility.Visible;
                break;

            case MessageBoxButton.YesNoCancel:
                YesButton.Visibility = Visibility.Visible;
                NoButton.Visibility = Visibility.Visible;
                CancelButton.Visibility = Visibility.Visible;
                break;
        }
    }

    /// <summary>
    /// Shows a themed message box with the specified message
    /// </summary>
    public static MessageBoxResult Show(string message)
    {
        return Show(message, "Message", MessageBoxButton.OK, MessageBoxImage.None);
    }

    /// <summary>
    /// Shows a themed message box with the specified message and title
    /// </summary>
    public static MessageBoxResult Show(string message, string title)
    {
        return Show(message, title, MessageBoxButton.OK, MessageBoxImage.None);
    }

    /// <summary>
    /// Shows a themed message box with the specified message, title, and button
    /// </summary>
    public static MessageBoxResult Show(string message, string title, MessageBoxButton button)
    {
        return Show(message, title, button, MessageBoxImage.None);
    }

    /// <summary>
    /// Shows a themed message box with the specified message, title, button, and icon
    /// </summary>
    public static MessageBoxResult Show(string message, string title, MessageBoxButton button, MessageBoxImage image)
    {
        var msgBox = new ThemedMessageBox
        {
            Owner = Application.Current.MainWindow
        };

        msgBox.TitleText.Text = title;
        msgBox.MessageText.Text = message;
        msgBox.SetupIcon(image);
        msgBox.SetupButtons(button);

        msgBox.ShowDialog();
        return msgBox.Result;
    }

    /// <summary>
    /// Shows a themed message box with the specified owner window
    /// </summary>
    public static MessageBoxResult Show(Window owner, string message, string title, MessageBoxButton button, MessageBoxImage image)
    {
        var msgBox = new ThemedMessageBox
        {
            Owner = owner
        };

        msgBox.TitleText.Text = title;
        msgBox.MessageText.Text = message;
        msgBox.SetupIcon(image);
        msgBox.SetupButtons(button);

        msgBox.ShowDialog();
        return msgBox.Result;
    }
}
