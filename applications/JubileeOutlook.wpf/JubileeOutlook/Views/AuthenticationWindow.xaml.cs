using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using JubileeOutlook.Models;
using JubileeOutlook.Services;

namespace JubileeOutlook.Views;

/// <summary>
/// Authentication landing page that acts as a mandatory access gate.
/// Users must sign in or sign up before accessing JubileeOutlook.
/// </summary>
public partial class AuthenticationWindow : Window
{
    private readonly AuthenticationManager _authManager;
    private readonly SecureStorageService _secureStorage;
    private enum AuthPanel { SignIn, SignUp, ForgotPassword }
    private AuthPanel _currentPanel = AuthPanel.SignIn;

    /// <summary>
    /// Indicates whether authentication was successful
    /// </summary>
    public bool AuthenticationSuccessful { get; private set; }

    public AuthenticationWindow()
    {
        InitializeComponent();

        _authManager = new AuthenticationManager();
        _secureStorage = new SecureStorageService();

        // Subscribe to session changes
        _authManager.SessionChanged += OnSessionChanged;

        // Try to auto-login with stored credentials
        Loaded += async (s, e) => await TryAutoLoginAsync();
    }

    /// <summary>
    /// Attempts auto-login using stored credentials
    /// </summary>
    private async Task TryAutoLoginAsync()
    {
        try
        {
            SetLoading(true, "Checking credentials...");

            // First, try to initialize from stored tokens
            await _authManager.InitializeAsync();

            // If already signed in from stored tokens, close auth window
            if (_authManager.Session.IsAuthenticated)
            {
                System.Diagnostics.Debug.WriteLine("[AuthWindow] Auto-login successful from stored tokens");
                AuthenticationSuccessful = true;
                DialogResult = true;
                Close();
                return;
            }

            // Try to load saved sign-in credentials
            var savedCredentials = await _secureStorage.RetrieveAsync<SavedSignInCredentials>("signInCredentials");
            if (savedCredentials != null && savedCredentials.RememberMe && !string.IsNullOrEmpty(savedCredentials.Email))
            {
                EmailTextBox.Text = savedCredentials.Email;

                // Try to decrypt and auto-fill password
                if (!string.IsNullOrEmpty(savedCredentials.EncryptedPassword))
                {
                    var password = _secureStorage.DecryptPassword(savedCredentials.EncryptedPassword);
                    if (!string.IsNullOrEmpty(password))
                    {
                        PasswordBox.Password = password;
                        RememberMeCheckBox.IsChecked = true;

                        // Auto-login if we have both email and password
                        System.Diagnostics.Debug.WriteLine("[AuthWindow] Attempting auto-login with saved credentials");
                        await PerformSignInAsync();
                        return;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[AuthWindow] Auto-login failed: {ex.Message}");
        }
        finally
        {
            SetLoading(false);
        }
    }

    /// <summary>
    /// Handle session changes from AuthenticationManager
    /// </summary>
    private void OnSessionChanged(object? sender, Models.AuthSession session)
    {
        Dispatcher.Invoke(() =>
        {
            if (session.IsAuthenticated)
            {
                AuthenticationSuccessful = true;
                DialogResult = true;
                Close();
            }
        });
    }

    #region Panel Navigation

    private void ShowPanel(AuthPanel panel)
    {
        _currentPanel = panel;

        SignInPanel.Visibility = panel == AuthPanel.SignIn ? Visibility.Visible : Visibility.Collapsed;
        SignUpPanel.Visibility = panel == AuthPanel.SignUp ? Visibility.Visible : Visibility.Collapsed;
        ForgotPasswordPanel.Visibility = panel == AuthPanel.ForgotPassword ? Visibility.Visible : Visibility.Collapsed;

        // Update header text based on panel
        // The Sign Up link visibility is controlled by the panel
    }

    private void SignUpLink_Click(object sender, MouseButtonEventArgs e)
    {
        ShowPanel(AuthPanel.SignUp);
    }

    private void BackToSignIn_Click(object sender, MouseButtonEventArgs e)
    {
        ShowPanel(AuthPanel.SignIn);
    }

    private void ForgotPassword_Click(object sender, MouseButtonEventArgs e)
    {
        ShowPanel(AuthPanel.ForgotPassword);
        ForgotEmailTextBox.Text = EmailTextBox.Text; // Pre-fill email
    }

    #endregion

    #region Sign In

    private async void SignInButton_Click(object sender, RoutedEventArgs e)
    {
        await PerformSignInAsync();
    }

    private async Task PerformSignInAsync()
    {
        var email = EmailTextBox.Text?.Trim();
        var password = PasswordBox.Password;

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            MessageDialog.ShowWarning(this, "Please enter your email and password.", "Sign In");
            return;
        }

        try
        {
            SetLoading(true, "Signing in...");
            SignInButton.IsEnabled = false;

            await _authManager.SignInAsync(email, password, RememberMeCheckBox.IsChecked == true);

            // Save credentials if remember me is checked
            if (RememberMeCheckBox.IsChecked == true)
            {
                await _secureStorage.StoreAsync("signInCredentials", new SavedSignInCredentials
                {
                    Email = email,
                    EncryptedPassword = _secureStorage.EncryptPassword(password),
                    RememberMe = true
                });
            }
            else
            {
                // Clear saved credentials if remember me is unchecked
                await _secureStorage.DeleteAsync("signInCredentials");
            }

            // Success - session changed event will close the window
            AuthenticationSuccessful = true;
            DialogResult = true;
            Close();
        }
        catch (Exception ex)
        {
            MessageDialog.ShowError(this, ex.Message, "Sign In Failed");
            SignInButton.IsEnabled = true;
        }
        finally
        {
            SetLoading(false);
        }
    }

    #endregion

    #region Sign Up

    private async void SignUpButton_Click(object sender, RoutedEventArgs e)
    {
        var fullName = FullNameTextBox.Text?.Trim();
        var email = SignUpEmailTextBox.Text?.Trim();
        var password = SignUpPasswordBox.Password;
        var confirmPassword = ConfirmPasswordBox.Password;

        if (string.IsNullOrWhiteSpace(fullName) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            MessageDialog.ShowWarning(this, "Please fill in all fields.", "Create Account");
            return;
        }

        if (password != confirmPassword)
        {
            MessageDialog.ShowWarning(this, "Passwords do not match.", "Create Account");
            return;
        }

        if (password.Length < 6)
        {
            MessageDialog.ShowWarning(this, "Password must be at least 6 characters long.", "Create Account");
            return;
        }

        try
        {
            SetLoading(true, "Creating account...");
            SignUpButton.IsEnabled = false;

            await _authManager.RegisterAsync(fullName, email, password, NewsletterCheckBox.IsChecked == true);

            // Save credentials for auto-login
            await _secureStorage.StoreAsync("signInCredentials", new SavedSignInCredentials
            {
                Email = email,
                EncryptedPassword = _secureStorage.EncryptPassword(password),
                RememberMe = true
            });

            // Success - session changed event will close the window
            AuthenticationSuccessful = true;
            DialogResult = true;
            Close();
        }
        catch (Exception ex)
        {
            MessageDialog.ShowError(this, ex.Message, "Registration Failed");
            SignUpButton.IsEnabled = true;
        }
        finally
        {
            SetLoading(false);
        }
    }

    #endregion

    #region Forgot Password

    private async void SendResetButton_Click(object sender, RoutedEventArgs e)
    {
        var email = ForgotEmailTextBox.Text?.Trim();

        if (string.IsNullOrWhiteSpace(email))
        {
            MessageDialog.ShowWarning(this, "Please enter your email address.", "Forgot Password");
            return;
        }

        try
        {
            SetLoading(true, "Sending reset link...");
            SendResetButton.IsEnabled = false;

            var success = await _authManager.RequestPasswordResetAsync(email);

            // Always show success message to prevent email enumeration
            MessageDialog.ShowSuccess(this, "If an account exists with this email, you will receive password reset instructions shortly.", "Email Sent");
            ShowPanel(AuthPanel.SignIn);
        }
        catch (Exception ex)
        {
            MessageDialog.ShowError(this, ex.Message, "Error");
        }
        finally
        {
            SendResetButton.IsEnabled = true;
            SetLoading(false);
        }
    }

    #endregion

    #region UI Helpers

    private void SetLoading(bool isLoading, string? message = null)
    {
        LoadingPanel.Visibility = isLoading ? Visibility.Visible : Visibility.Collapsed;

        if (isLoading && !string.IsNullOrEmpty(message))
        {
            var loadingText = LoadingPanel.Children.OfType<System.Windows.Controls.TextBlock>().FirstOrDefault();
            if (loadingText != null)
            {
                loadingText.Text = message;
            }
        }
    }

    private void TogglePassword_Click(object sender, RoutedEventArgs e)
    {
        // Note: WPF PasswordBox doesn't support showing password directly
        // This would require a custom control or overlay TextBox
        // For now, we'll just toggle the icon as a placeholder
    }

    private void Input_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter)
        {
            switch (_currentPanel)
            {
                case AuthPanel.SignIn:
                    SignInButton_Click(sender, e);
                    break;
                case AuthPanel.SignUp:
                    SignUpButton_Click(sender, e);
                    break;
                case AuthPanel.ForgotPassword:
                    SendResetButton_Click(sender, e);
                    break;
            }
        }
    }

    #endregion

    #region Window Chrome

    private void TitleBar_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ClickCount == 1)
        {
            DragMove();
        }
    }

    private void MinimizeButton_Click(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState.Minimized;
    }

    private void CloseButton_Click(object sender, RoutedEventArgs e)
    {
        AuthenticationSuccessful = false;
        DialogResult = false;
        Close();
    }

    #endregion
}
