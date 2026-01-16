using System;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media.Animation;

namespace JubileeBrowser;

/// <summary>
/// Custom themed dialog for sign-in failures with Demo Mode option.
/// Matches the Jubilee Browser visual design language.
/// </summary>
public partial class SignInFailedDialog : Window
{
    /// <summary>
    /// Gets whether the user chose to continue in Demo Mode.
    /// </summary>
    public bool ContinueInDemoMode { get; private set; }

    /// <summary>
    /// Creates a new SignInFailedDialog with the default error message.
    /// </summary>
    public SignInFailedDialog()
    {
        InitializeComponent();
        ContinueInDemoMode = false;

        // Set up keyboard navigation
        PreviewKeyDown += Dialog_PreviewKeyDown;

        // Focus the Yes button by default for quick demo mode entry
        Loaded += (s, e) =>
        {
            YesButton.Focus();
            PlayOpenAnimation();
        };
    }

    /// <summary>
    /// Creates a new SignInFailedDialog with a custom error message.
    /// </summary>
    /// <param name="errorMessage">The primary error message to display.</param>
    public SignInFailedDialog(string errorMessage) : this()
    {
        if (!string.IsNullOrWhiteSpace(errorMessage))
        {
            ErrorMessageText.Text = errorMessage;
        }
    }

    private void PlayOpenAnimation()
    {
        // Fade in animation
        var fadeIn = new DoubleAnimation
        {
            From = 0,
            To = 1,
            Duration = TimeSpan.FromMilliseconds(150),
            EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseOut }
        };

        // Scale animation for subtle pop effect
        var scaleX = new DoubleAnimation
        {
            From = 0.95,
            To = 1,
            Duration = TimeSpan.FromMilliseconds(200),
            EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseOut }
        };

        var scaleY = new DoubleAnimation
        {
            From = 0.95,
            To = 1,
            Duration = TimeSpan.FromMilliseconds(200),
            EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseOut }
        };

        // Apply scale transform if not exists
        if (RenderTransform == null || RenderTransform is not System.Windows.Media.ScaleTransform)
        {
            RenderTransform = new System.Windows.Media.ScaleTransform(1, 1);
            RenderTransformOrigin = new Point(0.5, 0.5);
        }

        BeginAnimation(OpacityProperty, fadeIn);
        ((System.Windows.Media.ScaleTransform)RenderTransform).BeginAnimation(System.Windows.Media.ScaleTransform.ScaleXProperty, scaleX);
        ((System.Windows.Media.ScaleTransform)RenderTransform).BeginAnimation(System.Windows.Media.ScaleTransform.ScaleYProperty, scaleY);
    }

    private void PlayCloseAnimation(Action onComplete)
    {
        var fadeOut = new DoubleAnimation
        {
            From = 1,
            To = 0,
            Duration = TimeSpan.FromMilliseconds(100),
            EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseIn }
        };

        fadeOut.Completed += (s, e) => onComplete();
        BeginAnimation(OpacityProperty, fadeOut);
    }

    private void Dialog_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Escape)
        {
            e.Handled = true;
            CloseWithResult(false);
        }
        else if (e.Key == Key.Enter)
        {
            // Enter confirms the focused button or defaults to Yes
            if (NoButton.IsFocused)
            {
                CloseWithResult(false);
            }
            else
            {
                CloseWithResult(true);
            }
            e.Handled = true;
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
        CloseWithResult(false);
    }

    private void YesButton_Click(object sender, RoutedEventArgs e)
    {
        CloseWithResult(true);
    }

    private void NoButton_Click(object sender, RoutedEventArgs e)
    {
        CloseWithResult(false);
    }

    private void CloseWithResult(bool continueInDemoMode)
    {
        ContinueInDemoMode = continueInDemoMode;
        PlayCloseAnimation(() =>
        {
            try
            {
                DialogResult = continueInDemoMode;
            }
            catch (InvalidOperationException)
            {
                // DialogResult can only be set when window is shown via ShowDialog()
            }
            Close();
        });
    }

    /// <summary>
    /// Shows the Sign In Failed dialog and returns whether the user chose Demo Mode.
    /// </summary>
    /// <param name="owner">The owner window for proper centering.</param>
    /// <param name="errorMessage">Optional custom error message.</param>
    /// <returns>True if user chose to continue in Demo Mode, false otherwise.</returns>
    public static bool Show(Window owner, string errorMessage = "Invalid email or password")
    {
        var dialog = new SignInFailedDialog(errorMessage)
        {
            Owner = owner
        };

        dialog.ShowDialog();
        return dialog.ContinueInDemoMode;
    }
}
