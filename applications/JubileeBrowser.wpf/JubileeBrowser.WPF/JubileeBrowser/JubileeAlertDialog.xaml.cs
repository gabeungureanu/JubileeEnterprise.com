using System;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;

namespace JubileeBrowser;

/// <summary>
/// Alert dialog types that determine the icon and color scheme.
/// </summary>
public enum AlertType
{
    Info,
    Warning,
    Error,
    Success
}

/// <summary>
/// Custom themed alert dialog that matches Jubilee Browser's visual design.
/// Replaces system MessageBox for a cohesive in-app experience.
/// </summary>
public partial class JubileeAlertDialog : Window
{
    /// <summary>
    /// Creates a new JubileeAlertDialog with the specified title and message.
    /// </summary>
    public JubileeAlertDialog(string title, string message, AlertType alertType = AlertType.Warning)
    {
        InitializeComponent();

        TitleText.Text = title;
        MessageText.Text = message;
        Title = title;

        ConfigureAlertType(alertType);

        // Set up keyboard navigation
        PreviewKeyDown += Dialog_PreviewKeyDown;

        // Focus the OK button and play animation on load
        Loaded += (s, e) =>
        {
            OkButton.Focus();
            PlayOpenAnimation();
        };
    }

    private void ConfigureAlertType(AlertType alertType)
    {
        string icon;
        Color iconColor;
        Color iconBackground;

        switch (alertType)
        {
            case AlertType.Info:
                icon = "\uE946"; // Info icon
                iconColor = Color.FromRgb(90, 200, 250); // #5AC8FA - Blue
                iconBackground = Color.FromRgb(35, 45, 60);
                break;

            case AlertType.Warning:
                icon = "\uE7BA"; // Warning icon
                iconColor = Color.FromRgb(230, 172, 0); // #E6AC00 - Gold
                iconBackground = Color.FromRgb(50, 45, 35);
                break;

            case AlertType.Error:
                icon = "\uEA39"; // Error/X icon
                iconColor = Color.FromRgb(255, 107, 107); // #FF6B6B - Red
                iconBackground = Color.FromRgb(55, 35, 40);
                break;

            case AlertType.Success:
                icon = "\uE73E"; // Checkmark icon
                iconColor = Color.FromRgb(67, 209, 122); // #43D17A - Green
                iconBackground = Color.FromRgb(35, 50, 45);
                break;

            default:
                icon = "\uE7BA";
                iconColor = Color.FromRgb(230, 172, 0);
                iconBackground = Color.FromRgb(42, 42, 67);
                break;
        }

        IconText.Text = icon;
        IconText.Foreground = new SolidColorBrush(iconColor);
        IconContainer.Background = new SolidColorBrush(iconBackground);
    }

    private void PlayOpenAnimation()
    {
        var fadeIn = new DoubleAnimation
        {
            From = 0,
            To = 1,
            Duration = TimeSpan.FromMilliseconds(120),
            EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseOut }
        };

        var scaleX = new DoubleAnimation
        {
            From = 0.96,
            To = 1,
            Duration = TimeSpan.FromMilliseconds(150),
            EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseOut }
        };

        var scaleY = new DoubleAnimation
        {
            From = 0.96,
            To = 1,
            Duration = TimeSpan.FromMilliseconds(150),
            EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseOut }
        };

        if (RenderTransform == null || RenderTransform is not ScaleTransform)
        {
            RenderTransform = new ScaleTransform(1, 1);
            RenderTransformOrigin = new Point(0.5, 0.5);
        }

        BeginAnimation(OpacityProperty, fadeIn);
        ((ScaleTransform)RenderTransform).BeginAnimation(ScaleTransform.ScaleXProperty, scaleX);
        ((ScaleTransform)RenderTransform).BeginAnimation(ScaleTransform.ScaleYProperty, scaleY);
    }

    private void PlayCloseAnimation(Action onComplete)
    {
        var fadeOut = new DoubleAnimation
        {
            From = 1,
            To = 0,
            Duration = TimeSpan.FromMilliseconds(80),
            EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseIn }
        };

        fadeOut.Completed += (s, e) => onComplete();
        BeginAnimation(OpacityProperty, fadeOut);
    }

    private void Dialog_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Escape || e.Key == Key.Enter)
        {
            e.Handled = true;
            CloseDialog();
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
        CloseDialog();
    }

    private void OkButton_Click(object sender, RoutedEventArgs e)
    {
        CloseDialog();
    }

    private void CloseDialog()
    {
        PlayCloseAnimation(() =>
        {
            try
            {
                DialogResult = true;
            }
            catch (InvalidOperationException)
            {
                // DialogResult can only be set when window is shown via ShowDialog()
                // If shown via Show(), just close directly
            }
            Close();
        });
    }

    /// <summary>
    /// Shows a warning alert dialog with the specified title and message.
    /// </summary>
    public static void ShowWarning(Window owner, string title, string message)
    {
        Show(owner, title, message, AlertType.Warning);
    }

    /// <summary>
    /// Shows an info alert dialog with the specified title and message.
    /// </summary>
    public static void ShowInfo(Window owner, string title, string message)
    {
        Show(owner, title, message, AlertType.Info);
    }

    /// <summary>
    /// Shows an error alert dialog with the specified title and message.
    /// </summary>
    public static void ShowError(Window owner, string title, string message)
    {
        Show(owner, title, message, AlertType.Error);
    }

    /// <summary>
    /// Shows a success alert dialog with the specified title and message.
    /// </summary>
    public static void ShowSuccess(Window owner, string title, string message)
    {
        Show(owner, title, message, AlertType.Success);
    }

    /// <summary>
    /// Shows an alert dialog with the specified parameters.
    /// </summary>
    public static void Show(Window owner, string title, string message, AlertType alertType = AlertType.Warning)
    {
        var dialog = new JubileeAlertDialog(title, message, alertType);

        if (owner != null)
        {
            dialog.Owner = owner;
        }

        dialog.ShowDialog();
    }
}
