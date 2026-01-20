using System.Text.RegularExpressions;
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
    private bool _isPasswordVisible = false;
    private bool _isSignUpPasswordVisible = false;
    private bool _isConfirmPasswordVisible = false;
    private bool _isShownAsDialog = false;
    private bool _isAutoLogin = false;

    /// <summary>
    /// Indicates whether authentication was successful
    /// </summary>
    public bool AuthenticationSuccessful { get; private set; }

    /// <summary>
    /// Event raised when authentication succeeds, before the window closes.
    /// This allows the caller to prepare the next window for a seamless transition.
    /// </summary>
    public event EventHandler? AuthenticationCompleted;

    public AuthenticationWindow()
    {
        InitializeComponent();

        _authManager = new AuthenticationManager();
        _secureStorage = new SecureStorageService();

        // Subscribe to session changes
        _authManager.SessionChanged += OnSessionChanged;

        // Try to auto-login with stored credentials after a brief delay
        // This allows ShowDialog() to be called first
        Loaded += async (s, e) =>
        {
            // Brief delay to let ShowDialog() establish the dialog context
            await System.Threading.Tasks.Task.Delay(50);
            _isShownAsDialog = true;
            await TryAutoLoginAsync();
        };
    }

    /// <summary>
    /// Safely sets DialogResult only if window is shown as a dialog
    /// </summary>
    private void SafeSetDialogResult(bool? result)
    {
        if (_isShownAsDialog)
        {
            try
            {
                DialogResult = result;
            }
            catch (InvalidOperationException)
            {
                // Window not shown as dialog - just close it
                Close();
            }
        }
        else
        {
            // Not shown as dialog yet, just close
            Close();
        }
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

            // If already signed in from stored tokens, close the dialog
            // Don't raise AuthenticationCompleted during auto-login - let the fallback handle MainWindow creation
            // This avoids timing issues and duplicate MainWindow creation
            if (_authManager.Session.IsAuthenticated)
            {
                System.Diagnostics.Debug.WriteLine("[AuthWindow] Auto-login successful from stored tokens");
                AuthenticationSuccessful = true;
                SafeSetDialogResult(true);
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
                        _isAutoLogin = true;
                        await PerformSignInAsync();
                        _isAutoLogin = false;
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
                SafeSetDialogResult(true);
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

        // Update subtitle and navigation links based on panel
        switch (panel)
        {
            case AuthPanel.SignIn:
                SubtitleText.Text = "Sign in to sync your email across devices";
                SignUpLinkPanel.Visibility = Visibility.Visible;
                break;
            case AuthPanel.SignUp:
                SubtitleText.Text = "Create an account to get started";
                SignUpLinkPanel.Visibility = Visibility.Collapsed;
                break;
            case AuthPanel.ForgotPassword:
                SubtitleText.Text = "Reset your password";
                SignUpLinkPanel.Visibility = Visibility.Collapsed;
                break;
        }

        // Clear all fields and error messages when switching panels
        ClearAllFields(panel);
        ClearAllErrors();
    }

    /// <summary>
    /// Clears all input fields for the target panel
    /// </summary>
    private void ClearAllFields(AuthPanel targetPanel)
    {
        switch (targetPanel)
        {
            case AuthPanel.SignIn:
                // Clear Sign In fields
                EmailTextBox.Text = string.Empty;
                PasswordBox.Password = string.Empty;
                PasswordTextBox.Text = string.Empty;
                // Reset password visibility
                _isPasswordVisible = false;
                PasswordBox.Visibility = Visibility.Visible;
                PasswordTextBox.Visibility = Visibility.Collapsed;
                PasswordVisibilityIcon.Text = "\ue8f4";
                // Show placeholders
                EmailPlaceholder.Visibility = Visibility.Visible;
                PasswordPlaceholder.Visibility = Visibility.Visible;
                break;

            case AuthPanel.SignUp:
                // Clear Sign Up fields
                FullNameTextBox.Text = string.Empty;
                SignUpEmailTextBox.Text = string.Empty;
                SignUpPasswordBox.Password = string.Empty;
                SignUpPasswordTextBox.Text = string.Empty;
                ConfirmPasswordBox.Password = string.Empty;
                ConfirmPasswordTextBox.Text = string.Empty;
                NewsletterCheckBox.IsChecked = false;
                // Reset password visibility
                _isSignUpPasswordVisible = false;
                _isConfirmPasswordVisible = false;
                SignUpPasswordBox.Visibility = Visibility.Visible;
                SignUpPasswordTextBox.Visibility = Visibility.Collapsed;
                SignUpPasswordVisibilityIcon.Text = "\ue8f4";
                ConfirmPasswordBox.Visibility = Visibility.Visible;
                ConfirmPasswordTextBox.Visibility = Visibility.Collapsed;
                ConfirmPasswordVisibilityIcon.Text = "\ue8f4";
                // Show placeholders
                FullNamePlaceholder.Visibility = Visibility.Visible;
                SignUpEmailPlaceholder.Visibility = Visibility.Visible;
                SignUpPasswordPlaceholder.Visibility = Visibility.Visible;
                ConfirmPasswordPlaceholder.Visibility = Visibility.Visible;
                break;

            case AuthPanel.ForgotPassword:
                // Clear Forgot Password fields
                ForgotEmailTextBox.Text = string.Empty;
                break;
        }
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

    #region Validation

    private static readonly Regex EmailRegex = new(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled);

    private void ClearAllErrors()
    {
        EmailErrorText.Visibility = Visibility.Collapsed;
        PasswordErrorText.Visibility = Visibility.Collapsed;
        FullNameErrorText.Visibility = Visibility.Collapsed;
        SignUpEmailErrorText.Visibility = Visibility.Collapsed;
        SignUpPasswordErrorText.Visibility = Visibility.Collapsed;
        ConfirmPasswordErrorText.Visibility = Visibility.Collapsed;
    }

    private void ShowError(TextBlock errorBlock, string message)
    {
        errorBlock.Text = message;
        errorBlock.Visibility = Visibility.Visible;
    }

    private void HideError(TextBlock errorBlock)
    {
        errorBlock.Visibility = Visibility.Collapsed;
    }

    private bool ValidateSignIn()
    {
        bool isValid = true;
        var email = EmailTextBox.Text?.Trim();
        var password = PasswordBox.Password;

        // Validate email
        if (string.IsNullOrWhiteSpace(email))
        {
            ShowError(EmailErrorText, "Email address is required");
            isValid = false;
        }
        else if (!EmailRegex.IsMatch(email))
        {
            ShowError(EmailErrorText, "Please enter a valid email address");
            isValid = false;
        }
        else
        {
            HideError(EmailErrorText);
        }

        // Validate password
        if (string.IsNullOrWhiteSpace(password))
        {
            ShowError(PasswordErrorText, "Password is required");
            isValid = false;
        }
        else
        {
            HideError(PasswordErrorText);
        }

        return isValid;
    }

    private bool ValidateSignUp()
    {
        bool isValid = true;
        var fullName = FullNameTextBox.Text?.Trim();
        var email = SignUpEmailTextBox.Text?.Trim();
        var password = SignUpPasswordBox.Password;
        var confirmPassword = ConfirmPasswordBox.Password;

        // Validate full name
        if (string.IsNullOrWhiteSpace(fullName))
        {
            ShowError(FullNameErrorText, "Full name is required");
            isValid = false;
        }
        else if (fullName.Length < 2)
        {
            ShowError(FullNameErrorText, "Name must be at least 2 characters");
            isValid = false;
        }
        else
        {
            HideError(FullNameErrorText);
        }

        // Validate email
        if (string.IsNullOrWhiteSpace(email))
        {
            ShowError(SignUpEmailErrorText, "Email address is required");
            isValid = false;
        }
        else if (!EmailRegex.IsMatch(email))
        {
            ShowError(SignUpEmailErrorText, "Please enter a valid email address");
            isValid = false;
        }
        else
        {
            HideError(SignUpEmailErrorText);
        }

        // Validate password
        if (string.IsNullOrWhiteSpace(password))
        {
            ShowError(SignUpPasswordErrorText, "Password is required");
            isValid = false;
        }
        else if (password.Length < 6)
        {
            ShowError(SignUpPasswordErrorText, "Password must be at least 6 characters");
            isValid = false;
        }
        else
        {
            HideError(SignUpPasswordErrorText);
        }

        // Validate confirm password
        if (string.IsNullOrWhiteSpace(confirmPassword))
        {
            ShowError(ConfirmPasswordErrorText, "Please confirm your password");
            isValid = false;
        }
        else if (password != confirmPassword)
        {
            ShowError(ConfirmPasswordErrorText, "Passwords do not match");
            isValid = false;
        }
        else
        {
            HideError(ConfirmPasswordErrorText);
        }

        return isValid;
    }

    // Real-time validation event handlers
    private void EmailTextBox_TextChanged(object sender, TextChangedEventArgs e)
    {
        if (EmailErrorText.Visibility == Visibility.Visible)
        {
            var email = EmailTextBox.Text?.Trim();
            if (!string.IsNullOrWhiteSpace(email) && EmailRegex.IsMatch(email))
            {
                HideError(EmailErrorText);
            }
        }
        // Update placeholder visibility (only show if empty AND not focused)
        if (!EmailTextBox.IsFocused)
        {
            EmailPlaceholder.Visibility = string.IsNullOrEmpty(EmailTextBox.Text)
                ? Visibility.Visible : Visibility.Collapsed;
        }
    }

    private void EmailTextBox_GotFocus(object sender, RoutedEventArgs e)
    {
        // Hide placeholder when focused
        EmailPlaceholder.Visibility = Visibility.Collapsed;
    }

    private void EmailTextBox_LostFocus(object sender, RoutedEventArgs e)
    {
        // Show placeholder if empty when losing focus
        EmailPlaceholder.Visibility = string.IsNullOrEmpty(EmailTextBox.Text)
            ? Visibility.Visible : Visibility.Collapsed;
    }

    private void PasswordBox_PasswordChanged(object sender, RoutedEventArgs e)
    {
        if (PasswordErrorText.Visibility == Visibility.Visible)
        {
            if (!string.IsNullOrWhiteSpace(PasswordBox.Password))
            {
                HideError(PasswordErrorText);
            }
        }
        // Update placeholder visibility (only show if empty AND not focused)
        if (!PasswordBox.IsFocused && !PasswordTextBox.IsFocused)
        {
            PasswordPlaceholder.Visibility = string.IsNullOrEmpty(PasswordBox.Password)
                ? Visibility.Visible : Visibility.Collapsed;
        }
        // Sync with visible textbox if password is shown
        if (_isPasswordVisible)
        {
            PasswordTextBox.Text = PasswordBox.Password;
        }
    }

    private void PasswordBox_GotFocus(object sender, RoutedEventArgs e)
    {
        // Hide placeholder when focused
        PasswordPlaceholder.Visibility = Visibility.Collapsed;
    }

    private void PasswordBox_LostFocus(object sender, RoutedEventArgs e)
    {
        // Show placeholder if empty when losing focus
        PasswordPlaceholder.Visibility = string.IsNullOrEmpty(PasswordBox.Password)
            ? Visibility.Visible : Visibility.Collapsed;
    }

    private void PasswordTextBox_GotFocus(object sender, RoutedEventArgs e)
    {
        // Hide placeholder when focused
        PasswordPlaceholder.Visibility = Visibility.Collapsed;
    }

    private void PasswordTextBox_LostFocus(object sender, RoutedEventArgs e)
    {
        // Show placeholder if empty when losing focus
        PasswordPlaceholder.Visibility = string.IsNullOrEmpty(PasswordTextBox.Text)
            ? Visibility.Visible : Visibility.Collapsed;
    }

    private void FullNameTextBox_TextChanged(object sender, TextChangedEventArgs e)
    {
        if (FullNameErrorText.Visibility == Visibility.Visible)
        {
            var name = FullNameTextBox.Text?.Trim();
            if (!string.IsNullOrWhiteSpace(name) && name.Length >= 2)
            {
                HideError(FullNameErrorText);
            }
        }
        // Update placeholder visibility (only show if empty AND not focused)
        if (!FullNameTextBox.IsFocused)
        {
            FullNamePlaceholder.Visibility = string.IsNullOrEmpty(FullNameTextBox.Text)
                ? Visibility.Visible : Visibility.Collapsed;
        }
    }

    private void FullNameTextBox_GotFocus(object sender, RoutedEventArgs e)
    {
        // Hide placeholder when focused
        FullNamePlaceholder.Visibility = Visibility.Collapsed;
    }

    private void FullNameTextBox_LostFocus(object sender, RoutedEventArgs e)
    {
        // Show placeholder if empty when losing focus
        FullNamePlaceholder.Visibility = string.IsNullOrEmpty(FullNameTextBox.Text)
            ? Visibility.Visible : Visibility.Collapsed;
    }

    private void SignUpEmailTextBox_TextChanged(object sender, TextChangedEventArgs e)
    {
        if (SignUpEmailErrorText.Visibility == Visibility.Visible)
        {
            var email = SignUpEmailTextBox.Text?.Trim();
            if (!string.IsNullOrWhiteSpace(email) && EmailRegex.IsMatch(email))
            {
                HideError(SignUpEmailErrorText);
            }
        }
        // Update placeholder visibility (only show if empty AND not focused)
        if (!SignUpEmailTextBox.IsFocused)
        {
            SignUpEmailPlaceholder.Visibility = string.IsNullOrEmpty(SignUpEmailTextBox.Text)
                ? Visibility.Visible : Visibility.Collapsed;
        }
    }

    private void SignUpEmailTextBox_GotFocus(object sender, RoutedEventArgs e)
    {
        // Hide placeholder when focused
        SignUpEmailPlaceholder.Visibility = Visibility.Collapsed;
    }

    private void SignUpEmailTextBox_LostFocus(object sender, RoutedEventArgs e)
    {
        // Show placeholder if empty when losing focus
        SignUpEmailPlaceholder.Visibility = string.IsNullOrEmpty(SignUpEmailTextBox.Text)
            ? Visibility.Visible : Visibility.Collapsed;
    }

    private void SignUpPasswordBox_PasswordChanged(object sender, RoutedEventArgs e)
    {
        if (SignUpPasswordErrorText.Visibility == Visibility.Visible)
        {
            if (!string.IsNullOrWhiteSpace(SignUpPasswordBox.Password) && SignUpPasswordBox.Password.Length >= 6)
            {
                HideError(SignUpPasswordErrorText);
            }
        }
        // Update placeholder visibility (only show if empty AND not focused)
        if (!SignUpPasswordBox.IsFocused && !SignUpPasswordTextBox.IsFocused)
        {
            SignUpPasswordPlaceholder.Visibility = string.IsNullOrEmpty(SignUpPasswordBox.Password)
                ? Visibility.Visible : Visibility.Collapsed;
        }
        // Sync with visible textbox if password is shown
        if (_isSignUpPasswordVisible)
        {
            SignUpPasswordTextBox.Text = SignUpPasswordBox.Password;
        }
    }

    private void SignUpPasswordBox_GotFocus(object sender, RoutedEventArgs e)
    {
        SignUpPasswordPlaceholder.Visibility = Visibility.Collapsed;
    }

    private void SignUpPasswordBox_LostFocus(object sender, RoutedEventArgs e)
    {
        SignUpPasswordPlaceholder.Visibility = string.IsNullOrEmpty(SignUpPasswordBox.Password)
            ? Visibility.Visible : Visibility.Collapsed;
    }

    private void ConfirmPasswordBox_PasswordChanged(object sender, RoutedEventArgs e)
    {
        if (ConfirmPasswordErrorText.Visibility == Visibility.Visible)
        {
            if (SignUpPasswordBox.Password == ConfirmPasswordBox.Password)
            {
                HideError(ConfirmPasswordErrorText);
            }
        }
        // Update placeholder visibility (only show if empty AND not focused)
        if (!ConfirmPasswordBox.IsFocused && !ConfirmPasswordTextBox.IsFocused)
        {
            ConfirmPasswordPlaceholder.Visibility = string.IsNullOrEmpty(ConfirmPasswordBox.Password)
                ? Visibility.Visible : Visibility.Collapsed;
        }
        // Sync with visible textbox if password is shown
        if (_isConfirmPasswordVisible)
        {
            ConfirmPasswordTextBox.Text = ConfirmPasswordBox.Password;
        }
    }

    private void ConfirmPasswordBox_GotFocus(object sender, RoutedEventArgs e)
    {
        ConfirmPasswordPlaceholder.Visibility = Visibility.Collapsed;
    }

    private void ConfirmPasswordBox_LostFocus(object sender, RoutedEventArgs e)
    {
        ConfirmPasswordPlaceholder.Visibility = string.IsNullOrEmpty(ConfirmPasswordBox.Password)
            ? Visibility.Visible : Visibility.Collapsed;
    }

    #endregion

    #region Sign In

    private async void SignInButton_Click(object sender, RoutedEventArgs e)
    {
        if (!ValidateSignIn())
            return;

        await PerformSignInAsync();
    }

    private async Task PerformSignInAsync()
    {
        var email = EmailTextBox.Text?.Trim();
        var password = PasswordBox.Password;

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
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

            // Mark as successful
            AuthenticationSuccessful = true;

            // Only raise event for manual sign-in (not auto-login) for seamless transition
            // Auto-login uses the fallback path to avoid timing issues
            if (!_isAutoLogin)
            {
                AuthenticationCompleted?.Invoke(this, EventArgs.Empty);
            }

            // Now close the dialog
            SafeSetDialogResult(true);
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
        if (!ValidateSignUp())
            return;

        var fullName = FullNameTextBox.Text?.Trim();
        var email = SignUpEmailTextBox.Text?.Trim();
        var password = SignUpPasswordBox.Password;

        try
        {
            SetLoading(true, "Creating account...");
            SignUpButton.IsEnabled = false;

            await _authManager.RegisterAsync(fullName!, email!, password, NewsletterCheckBox.IsChecked == true);

            // Save credentials for auto-login
            await _secureStorage.StoreAsync("signInCredentials", new SavedSignInCredentials
            {
                Email = email,
                EncryptedPassword = _secureStorage.EncryptPassword(password),
                RememberMe = true
            });

            // Mark as successful and raise event for seamless transition
            AuthenticationSuccessful = true;

            // Raise event to allow App to prepare MainWindow before this window closes
            AuthenticationCompleted?.Invoke(this, EventArgs.Empty);

            // Now close the dialog
            SafeSetDialogResult(true);
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

        if (!EmailRegex.IsMatch(email))
        {
            MessageDialog.ShowWarning(this, "Please enter a valid email address.", "Forgot Password");
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

    /// <summary>
    /// Shows or hides the full-screen preparing overlay that covers the auth card
    /// while MainWindow is being prepared. This provides a seamless transition experience.
    /// </summary>
    public void ShowPreparingOverlay(bool show, string? message = null)
    {
        PreparingMainWindowOverlay.Visibility = show ? Visibility.Visible : Visibility.Collapsed;

        if (show && !string.IsNullOrEmpty(message))
        {
            PreparingStatusText.Text = message;
        }
    }

    private void TogglePassword_Click(object sender, RoutedEventArgs e)
    {
        _isPasswordVisible = !_isPasswordVisible;

        if (_isPasswordVisible)
        {
            // Show password as plain text
            PasswordTextBox.Text = PasswordBox.Password;
            PasswordBox.Visibility = Visibility.Collapsed;
            PasswordTextBox.Visibility = Visibility.Visible;
            PasswordPlaceholder.Visibility = Visibility.Collapsed;
            PasswordVisibilityIcon.Text = "\ue8f5"; // visibility_off icon
            PasswordTextBox.Focus();
            PasswordTextBox.CaretIndex = PasswordTextBox.Text.Length;
        }
        else
        {
            // Hide password
            PasswordBox.Password = PasswordTextBox.Text;
            PasswordTextBox.Visibility = Visibility.Collapsed;
            PasswordBox.Visibility = Visibility.Visible;
            PasswordVisibilityIcon.Text = "\ue8f4"; // visibility icon
            // Restore placeholder if empty
            PasswordPlaceholder.Visibility = string.IsNullOrEmpty(PasswordBox.Password)
                ? Visibility.Visible : Visibility.Collapsed;
            PasswordBox.Focus();
        }
    }

    private void ToggleSignUpPassword_Click(object sender, RoutedEventArgs e)
    {
        _isSignUpPasswordVisible = !_isSignUpPasswordVisible;

        if (_isSignUpPasswordVisible)
        {
            // Show password as plain text
            SignUpPasswordTextBox.Text = SignUpPasswordBox.Password;
            SignUpPasswordBox.Visibility = Visibility.Collapsed;
            SignUpPasswordTextBox.Visibility = Visibility.Visible;
            SignUpPasswordPlaceholder.Visibility = Visibility.Collapsed;
            SignUpPasswordVisibilityIcon.Text = "\ue8f5"; // visibility_off icon
            SignUpPasswordTextBox.Focus();
            SignUpPasswordTextBox.CaretIndex = SignUpPasswordTextBox.Text.Length;
        }
        else
        {
            // Hide password
            SignUpPasswordBox.Password = SignUpPasswordTextBox.Text;
            SignUpPasswordTextBox.Visibility = Visibility.Collapsed;
            SignUpPasswordBox.Visibility = Visibility.Visible;
            SignUpPasswordVisibilityIcon.Text = "\ue8f4"; // visibility icon
            // Restore placeholder if empty
            SignUpPasswordPlaceholder.Visibility = string.IsNullOrEmpty(SignUpPasswordBox.Password)
                ? Visibility.Visible : Visibility.Collapsed;
            SignUpPasswordBox.Focus();
        }
    }

    private void ToggleConfirmPassword_Click(object sender, RoutedEventArgs e)
    {
        _isConfirmPasswordVisible = !_isConfirmPasswordVisible;

        if (_isConfirmPasswordVisible)
        {
            // Show password as plain text
            ConfirmPasswordTextBox.Text = ConfirmPasswordBox.Password;
            ConfirmPasswordBox.Visibility = Visibility.Collapsed;
            ConfirmPasswordTextBox.Visibility = Visibility.Visible;
            ConfirmPasswordPlaceholder.Visibility = Visibility.Collapsed;
            ConfirmPasswordVisibilityIcon.Text = "\ue8f5"; // visibility_off icon
            ConfirmPasswordTextBox.Focus();
            ConfirmPasswordTextBox.CaretIndex = ConfirmPasswordTextBox.Text.Length;
        }
        else
        {
            // Hide password
            ConfirmPasswordBox.Password = ConfirmPasswordTextBox.Text;
            ConfirmPasswordTextBox.Visibility = Visibility.Collapsed;
            ConfirmPasswordBox.Visibility = Visibility.Visible;
            ConfirmPasswordVisibilityIcon.Text = "\ue8f4"; // visibility icon
            // Restore placeholder if empty
            ConfirmPasswordPlaceholder.Visibility = string.IsNullOrEmpty(ConfirmPasswordBox.Password)
                ? Visibility.Visible : Visibility.Collapsed;
            ConfirmPasswordBox.Focus();
        }
    }

    private void SignUpPasswordTextBox_TextChanged(object sender, TextChangedEventArgs e)
    {
        // Sync with password box when text box is visible
        if (_isSignUpPasswordVisible)
        {
            SignUpPasswordBox.Password = SignUpPasswordTextBox.Text;
        }
    }

    private void ConfirmPasswordTextBox_TextChanged(object sender, TextChangedEventArgs e)
    {
        // Sync with password box when text box is visible
        if (_isConfirmPasswordVisible)
        {
            ConfirmPasswordBox.Password = ConfirmPasswordTextBox.Text;
        }
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
        if (e.ClickCount == 2)
        {
            // Double-click to toggle maximize/restore
            MaximizeRestoreButton_Click(sender, e);
        }
        else if (e.ClickCount == 1)
        {
            DragMove();
        }
    }

    private void MinimizeButton_Click(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState.Minimized;
    }

    private void MaximizeRestoreButton_Click(object sender, RoutedEventArgs e)
    {
        if (WindowState == WindowState.Maximized)
        {
            WindowState = WindowState.Normal;
        }
        else
        {
            WindowState = WindowState.Maximized;
        }
        UpdateMaximizeRestoreIcon();
    }

    private void UpdateMaximizeRestoreIcon()
    {
        if (MaximizeRestoreIcon != null)
        {
            // \ue5d0 = maximize icon (filter_none), \ue5d1 = restore icon (crop_square)
            MaximizeRestoreIcon.Text = WindowState == WindowState.Maximized ? "\ue5d1" : "\ue5d0";
            MaximizeRestoreButton.ToolTip = WindowState == WindowState.Maximized ? "Restore" : "Maximize";
        }
    }

    protected override void OnStateChanged(EventArgs e)
    {
        base.OnStateChanged(e);
        UpdateMaximizeRestoreIcon();
    }

    private void CloseButton_Click(object sender, RoutedEventArgs e)
    {
        AuthenticationSuccessful = false;
        SafeSetDialogResult(false);
    }

    #endregion
}
