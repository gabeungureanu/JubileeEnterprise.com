using System.Text.RegularExpressions;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using JubileeOutlook.Models;
using JubileeOutlook.Models.EmailSync;
using JubileeOutlook.Services;
using JubileeOutlook.Services.EmailSync;

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

            // Load detected email accounts for the Sync Email tab
            await LoadDetectedEmailAccountsAsync();

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

    private async void GoToSyncExisting_Click(object sender, MouseButtonEventArgs e)
    {
        // Switch to Sync Email panel (hide Login Email panel, show Sync Email panel)
        LoginEmailPanel.Visibility = Visibility.Collapsed;
        SyncEmailPanel.Visibility = Visibility.Visible;

        // Reload detected email accounts when navigating back to Sync
        await LoadDetectedEmailAccountsAsync();
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

    #region Tab Navigation

    private void SyncEmailTab_Checked(object sender, RoutedEventArgs e)
    {
        if (SyncEmailPanel != null && LoginEmailPanel != null)
        {
            SyncEmailPanel.Visibility = Visibility.Visible;
            LoginEmailPanel.Visibility = Visibility.Collapsed;
        }
    }

    private void LoginEmailTab_Checked(object sender, RoutedEventArgs e)
    {
        if (SyncEmailPanel != null && LoginEmailPanel != null)
        {
            SyncEmailPanel.Visibility = Visibility.Collapsed;
            LoginEmailPanel.Visibility = Visibility.Visible;
        }
    }

    #endregion

    #region Sync Email Tab Events

    // Track which emails are already synced in JubileeOutlook
    private HashSet<string> _syncedEmails = new(StringComparer.OrdinalIgnoreCase);

    private async Task LoadDetectedEmailAccountsAsync()
    {
        try
        {
            var detectedEmails = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            _syncedEmails.Clear();
            System.Diagnostics.Debug.WriteLine("[AuthWindow] Starting email detection...");

            // PRIORITY: Load previously synced JubileeOutlook email accounts first
            try
            {
                var storagePath = System.IO.Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "JubileeOutlook",
                    "SecureStorage"
                );

                if (System.IO.Directory.Exists(storagePath))
                {
                    var accountFiles = System.IO.Directory.GetFiles(storagePath, "account_*.dat");
                    System.Diagnostics.Debug.WriteLine($"[AuthWindow] Found {accountFiles.Length} synced account files");

                    foreach (var file in accountFiles)
                    {
                        try
                        {
                            var fileName = System.IO.Path.GetFileNameWithoutExtension(file);
                            var account = await _secureStorage.RetrieveAsync<Models.EmailSync.SyncedEmailAccount>(fileName);
                            if (account != null && !string.IsNullOrEmpty(account.EmailAddress))
                            {
                                detectedEmails.Add(account.EmailAddress);
                                _syncedEmails.Add(account.EmailAddress);
                                System.Diagnostics.Debug.WriteLine($"[AuthWindow] Found synced JubileeOutlook account: {account.EmailAddress}");
                            }
                        }
                        catch (Exception ex)
                        {
                            System.Diagnostics.Debug.WriteLine($"[AuthWindow] Failed to load account from {file}: {ex.Message}");
                        }
                    }
                }
            }
            catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"[AuthWindow] JubileeOutlook accounts check failed: {ex.Message}"); }

            // 1. Check Windows logged-in Microsoft Account
            try
            {
                using var identityKey = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(
                    @"Software\Microsoft\IdentityCRL\UserExtendedProperties");
                if (identityKey != null)
                {
                    foreach (var subKeyName in identityKey.GetSubKeyNames())
                    {
                        if (subKeyName.Contains("@"))
                        {
                            detectedEmails.Add(subKeyName);
                            System.Diagnostics.Debug.WriteLine($"[AuthWindow] Found Microsoft Account: {subKeyName}");
                        }
                    }
                }
            }
            catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"[AuthWindow] Microsoft Account check failed: {ex.Message}"); }

            // 2. Check Windows Account Picture provider (often has email)
            try
            {
                using var accountKey = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(
                    @"Software\Microsoft\Windows\CurrentVersion\AccountPicture\Users");
                if (accountKey != null)
                {
                    foreach (var subKeyName in accountKey.GetSubKeyNames())
                    {
                        using var subKey = accountKey.OpenSubKey(subKeyName);
                        var email = subKey?.GetValue("UserName") as string;
                        if (!string.IsNullOrEmpty(email) && email.Contains("@"))
                        {
                            detectedEmails.Add(email);
                            System.Diagnostics.Debug.WriteLine($"[AuthWindow] Found Account Picture email: {email}");
                        }
                    }
                }
            }
            catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"[AuthWindow] Account Picture check failed: {ex.Message}"); }

            // 3. Check Microsoft Office profiles (various versions)
            string[] outlookVersions = { "16.0", "15.0", "14.0" };
            foreach (var version in outlookVersions)
            {
                try
                {
                    using var profilesKey = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(
                        $@"Software\Microsoft\Office\{version}\Outlook\Profiles");
                    if (profilesKey != null)
                    {
                        foreach (var profileName in profilesKey.GetSubKeyNames())
                        {
                            using var profileKey = profilesKey.OpenSubKey(profileName);
                            if (profileKey != null)
                            {
                                SearchOutlookProfileForEmails(profileKey, detectedEmails);
                            }
                        }
                    }
                }
                catch { /* Outlook version not installed */ }
            }

            // 4. Check Windows Mail and Calendar app
            try
            {
                var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                var commsPath = System.IO.Path.Combine(localAppData, "Comms", "Unistore", "data");
                if (System.IO.Directory.Exists(commsPath))
                {
                    // Check for account settings files
                    foreach (var dir in System.IO.Directory.GetDirectories(commsPath))
                    {
                        var dirName = System.IO.Path.GetFileName(dir);
                        if (dirName.Contains("@"))
                        {
                            detectedEmails.Add(dirName);
                            System.Diagnostics.Debug.WriteLine($"[AuthWindow] Found Windows Mail account: {dirName}");
                        }
                    }
                }
            }
            catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"[AuthWindow] Windows Mail check failed: {ex.Message}"); }

            // 5. Check Thunderbird profiles
            try
            {
                var thunderbirdPath = System.IO.Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    "Thunderbird", "Profiles");
                if (System.IO.Directory.Exists(thunderbirdPath))
                {
                    foreach (var profileDir in System.IO.Directory.GetDirectories(thunderbirdPath))
                    {
                        var prefsFile = System.IO.Path.Combine(profileDir, "prefs.js");
                        if (System.IO.File.Exists(prefsFile))
                        {
                            var content = System.IO.File.ReadAllText(prefsFile);
                            var emailMatches = System.Text.RegularExpressions.Regex.Matches(
                                content, @"useremail"",\s*""([^""]+@[^""]+)""");
                            foreach (System.Text.RegularExpressions.Match match in emailMatches)
                            {
                                var email = match.Groups[1].Value;
                                detectedEmails.Add(email);
                                System.Diagnostics.Debug.WriteLine($"[AuthWindow] Found Thunderbird email: {email}");
                            }
                        }
                    }
                }
            }
            catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"[AuthWindow] Thunderbird check failed: {ex.Message}"); }

            // 6. Check Windows Credential Manager via Registry (Passport/Live credentials)
            try
            {
                using var credManagerKey = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(
                    @"Software\Microsoft\Windows\CurrentVersion\Internet Settings\Passport\LowDAMap");
                if (credManagerKey != null)
                {
                    foreach (var valueName in credManagerKey.GetValueNames())
                    {
                        if (valueName.Contains("@"))
                        {
                            detectedEmails.Add(valueName);
                            System.Diagnostics.Debug.WriteLine($"[AuthWindow] Found Passport credential: {valueName}");
                        }
                    }
                }
            }
            catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"[AuthWindow] Passport check failed: {ex.Message}"); }

            // 7. Check Azure AD / Work Account identities
            try
            {
                using var aadKey = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(
                    @"Software\Microsoft\Windows\CurrentVersion\AAD\Storage");
                if (aadKey != null)
                {
                    foreach (var subKeyName in aadKey.GetSubKeyNames())
                    {
                        using var subKey = aadKey.OpenSubKey(subKeyName);
                        var upn = subKey?.GetValue("upn") as string
                               ?? subKey?.GetValue("UserPrincipalName") as string;
                        if (!string.IsNullOrEmpty(upn) && upn.Contains("@"))
                        {
                            detectedEmails.Add(upn);
                            System.Diagnostics.Debug.WriteLine($"[AuthWindow] Found AAD account: {upn}");
                        }
                    }
                }
            }
            catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"[AuthWindow] AAD check failed: {ex.Message}"); }

            // 8. Check for cached Windows user identity
            try
            {
                using var cloudKey = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(
                    @"SOFTWARE\Microsoft\IdentityStore\Cache");
                if (cloudKey != null)
                {
                    SearchRegistryForEmails(cloudKey, detectedEmails);
                }
            }
            catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"[AuthWindow] Identity Store check failed: {ex.Message}"); }

            // 9. Check for any previously used JubileeOutlook sign-in credentials
            try
            {
                var savedCreds = await _secureStorage.RetrieveAsync<SavedSignInCredentials>("signInCredentials");
                if (savedCreds != null && !string.IsNullOrEmpty(savedCreds.Email))
                {
                    detectedEmails.Add(savedCreds.Email);
                    System.Diagnostics.Debug.WriteLine($"[AuthWindow] Found JubileeOutlook saved email: {savedCreds.Email}");
                }
            }
            catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"[AuthWindow] JubileeOutlook creds check failed: {ex.Message}"); }

            // Populate the ComboBox - synced accounts first, then others
            SyncEmailComboBox.Items.Clear();
            System.Diagnostics.Debug.WriteLine($"[AuthWindow] Total detected emails before populating: {detectedEmails.Count}");

            if (detectedEmails.Count > 0)
            {
                // Sort emails - synced accounts first, then others alphabetically
                var sortedEmails = new List<string>();

                // Add synced accounts first
                foreach (var email in detectedEmails.OrderBy(e => e))
                {
                    if (_syncedEmails.Contains(email))
                    {
                        sortedEmails.Insert(0, email); // Add at beginning
                    }
                    else
                    {
                        sortedEmails.Add(email); // Add at end
                    }
                }

                foreach (var email in sortedEmails)
                {
                    SyncEmailComboBox.Items.Add(email);
                    System.Diagnostics.Debug.WriteLine($"[AuthWindow] Added to ComboBox: {email}");
                }

                SyncEmailComboBox.SelectedIndex = 0;
                System.Diagnostics.Debug.WriteLine($"[AuthWindow] Populated ComboBox with {sortedEmails.Count} email(s)");
            }
            else
            {
                // Add placeholder text if no accounts found
                SyncEmailComboBox.Text = "";
                System.Diagnostics.Debug.WriteLine("[AuthWindow] No email accounts detected");
            }

            System.Diagnostics.Debug.WriteLine($"[AuthWindow] Email detection complete. Found {detectedEmails.Count} account(s)");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[AuthWindow] Error detecting email accounts: {ex.Message}");
        }
    }

    /// <summary>
    /// Recursively search Outlook profile registry keys for email addresses
    /// </summary>
    private void SearchOutlookProfileForEmails(Microsoft.Win32.RegistryKey key, HashSet<string> emails)
    {
        try
        {
            // Check current key values for email
            foreach (var valueName in key.GetValueNames())
            {
                var value = key.GetValue(valueName);
                if (value is byte[] bytes)
                {
                    // Try to decode as UTF-16 string (common for Outlook)
                    try
                    {
                        var str = System.Text.Encoding.Unicode.GetString(bytes).TrimEnd('\0');
                        if (str.Contains("@") && str.Contains(".") && !str.Contains(" ") && str.Length < 100)
                        {
                            emails.Add(str);
                            System.Diagnostics.Debug.WriteLine($"[AuthWindow] Found Outlook email (bytes): {str}");
                        }
                    }
                    catch { }
                }
                else if (value is string str && str.Contains("@") && str.Contains(".") && !str.Contains(" "))
                {
                    emails.Add(str);
                    System.Diagnostics.Debug.WriteLine($"[AuthWindow] Found Outlook email (string): {str}");
                }
            }

            // Recursively search subkeys
            foreach (var subKeyName in key.GetSubKeyNames())
            {
                using var subKey = key.OpenSubKey(subKeyName);
                if (subKey != null)
                {
                    SearchOutlookProfileForEmails(subKey, emails);
                }
            }
        }
        catch { /* Ignore access errors */ }
    }

    /// <summary>
    /// Search registry key recursively for email patterns
    /// </summary>
    private void SearchRegistryForEmails(Microsoft.Win32.RegistryKey key, HashSet<string> emails)
    {
        try
        {
            // Check value names that might be emails
            foreach (var valueName in key.GetValueNames())
            {
                if (valueName.Contains("@") && valueName.Contains("."))
                {
                    emails.Add(valueName);
                    System.Diagnostics.Debug.WriteLine($"[AuthWindow] Found registry email (name): {valueName}");
                }

                var value = key.GetValue(valueName) as string;
                if (!string.IsNullOrEmpty(value) && value.Contains("@") && value.Contains(".") && !value.Contains(" ") && value.Length < 100)
                {
                    emails.Add(value);
                    System.Diagnostics.Debug.WriteLine($"[AuthWindow] Found registry email (value): {value}");
                }
            }

            // Check subkey names
            foreach (var subKeyName in key.GetSubKeyNames())
            {
                if (subKeyName.Contains("@") && subKeyName.Contains("."))
                {
                    emails.Add(subKeyName);
                    System.Diagnostics.Debug.WriteLine($"[AuthWindow] Found registry email (subkey): {subKeyName}");
                }

                using var subKey = key.OpenSubKey(subKeyName);
                if (subKey != null)
                {
                    SearchRegistryForEmails(subKey, emails);
                }
            }
        }
        catch { /* Ignore access errors */ }
    }

    private void SyncEmailComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        // Optional: Handle selection change if needed
    }

    private void LearnMoreLink_Click(object sender, MouseButtonEventArgs e)
    {
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = "https://support.microsoft.com/outlook",
                UseShellExecute = true
            });
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[AuthWindow] Failed to open Learn More link: {ex.Message}");
        }
    }

    private void CreateOutlookAccountLink_Click(object sender, MouseButtonEventArgs e)
    {
        // Switch to Sign Up panel - directly manage visibility since tabs are hidden
        SyncEmailPanel.Visibility = Visibility.Collapsed;
        LoginEmailPanel.Visibility = Visibility.Visible;
        ShowPanel(AuthPanel.SignUp);
    }

    private async void SyncContinueButton_Click(object sender, RoutedEventArgs e)
    {
        var email = SyncEmailComboBox.Text?.Trim();

        if (string.IsNullOrWhiteSpace(email))
        {
            MessageDialog.ShowWarning(this, "Please enter your email address.", "Email Required");
            return;
        }

        if (!EmailRegex.IsMatch(email))
        {
            MessageDialog.ShowWarning(this, "Please enter a valid email address.", "Invalid Email");
            return;
        }

        try
        {
            SyncLoadingPanel.Visibility = Visibility.Visible;
            SyncContinueButton.IsEnabled = false;

            // Check if this email is already synced and has valid credentials
            if (_syncedEmails.Contains(email))
            {
                SyncStatusText.Text = "Checking existing account...";
                System.Diagnostics.Debug.WriteLine($"[SyncButton] Account {email} is already synced, checking credentials...");

                // Find the existing account
                var existingAccount = await FindExistingAccountAsync(email);
                if (existingAccount != null)
                {
                    // Check if credentials exist
                    var credentials = await _secureStorage.RetrieveAsync<Models.EmailSync.EmailAccountCredentials>($"credentials_{existingAccount.Id}");
                    if (credentials != null)
                    {
                        // Credentials exist - use existing account directly
                        System.Diagnostics.Debug.WriteLine($"[SyncButton] Using existing credentials for {email}");
                        SyncStatusText.Text = "Resolving user identity...";

                        // Resolve user identity in Codex database so contacts/events load correctly
                        await ResolveUserIdentityAsync(email, existingAccount.ProviderType.ToString().ToLower());

                        // Store that we have synced accounts
                        await _secureStorage.StoreAsync("has_synced_accounts", true);

                        MessageDialog.ShowInfo(this,
                            $"Email account '{email}' is already connected!\n\n" +
                            $"Provider: {existingAccount.ProviderType}\n\n" +
                            "Your emails will be loaded from the previous sync.",
                            "Account Ready");

                        // Close the authentication window and open main window
                        AuthenticationSuccessful = true;
                        AuthenticationCompleted?.Invoke(this, EventArgs.Empty);

                        if (_isShownAsDialog)
                        {
                            DialogResult = true;
                        }
                        Close();
                        return;
                    }
                    else
                    {
                        System.Diagnostics.Debug.WriteLine($"[SyncButton] Credentials not found for {email}, will re-authenticate");
                    }
                }
            }

            SyncStatusText.Text = "Detecting email provider...";

            // Use the EmailSyncCoordinator to add and sync the account
            var syncCoordinator = new EmailSyncCoordinator();

            // Subscribe to progress events
            syncCoordinator.SyncStatusChanged += (s, args) =>
            {
                Dispatcher.Invoke(() =>
                {
                    SyncStatusText.Text = args.Message;
                });
            };

            syncCoordinator.SyncProgress += (s, args) =>
            {
                Dispatcher.Invoke(() =>
                {
                    SyncStatusText.Text = args.Message;
                });
            };

            // Handle password required event for non-OAuth providers
            syncCoordinator.PasswordRequired += (s, args) =>
            {
                Dispatcher.Invoke(() =>
                {
                    // Show password dialog
                    var passwordDialog = new PasswordInputDialog(
                        args.EmailAddress,
                        args.ProviderName,
                        args.IsAppPassword,
                        args.HelpText);
                    passwordDialog.Owner = this;

                    if (passwordDialog.ShowDialog() == true)
                    {
                        args.Password = passwordDialog.Password;
                    }
                });
            };

            SyncStatusText.Text = "Starting authentication...";

            // Add the account (this will trigger OAuth or password flow)
            var result = await Task.Run(() => syncCoordinator.AddAccountAsync(email));

            if (result.Success && result.Account != null)
            {
                SyncStatusText.Text = "Resolving user identity...";

                // Ensure user identity is resolved in Codex for contacts/events
                await ResolveUserIdentityAsync(email, result.Account.ProviderType.ToString().ToLower());

                SyncStatusText.Text = "Email account synced successfully!";

                MessageDialog.ShowInfo(this,
                    $"Email account '{email}' has been successfully connected!\n\n" +
                    $"Folders discovered: {result.Folders.Count}\n" +
                    $"Provider: {result.Account.ProviderType}\n\n" +
                    "Your emails are now being synchronized.",
                    "Sync Successful");

                // Store that we have synced accounts
                await _secureStorage.StoreAsync("has_synced_accounts", true);

                // Close the authentication window and open main window
                AuthenticationSuccessful = true;
                AuthenticationCompleted?.Invoke(this, EventArgs.Empty);

                if (_isShownAsDialog)
                {
                    DialogResult = true;
                }
                Close();
            }
            else
            {
                SyncStatusText.Text = "Sync failed";

                var errorMessage = result.ErrorMessage ?? "Unknown error occurred during email sync.";

                // Check if it's an OAuth cancellation
                if (errorMessage.Contains("cancelled") || errorMessage.Contains("canceled"))
                {
                    MessageDialog.ShowWarning(this,
                        "Authentication was cancelled. Please try again to connect your email account.",
                        "Authentication Cancelled");
                }
                else
                {
                    MessageDialog.ShowError(this,
                        $"Failed to sync email account:\n\n{errorMessage}",
                        "Sync Failed");
                }
            }
        }
        catch (Exception ex)
        {
            SyncStatusText.Text = "Error occurred";
            System.Diagnostics.Debug.WriteLine($"[SyncButton] Error: {ex}");
            MessageDialog.ShowError(this, $"An error occurred: {ex.Message}", "Error");
        }
        finally
        {
            SyncLoadingPanel.Visibility = Visibility.Collapsed;
            SyncContinueButton.IsEnabled = true;
            SyncStatusText.Text = "";
        }
    }

    /// <summary>
    /// Find an existing synced account by email address
    /// </summary>
    private async Task<Models.EmailSync.SyncedEmailAccount?> FindExistingAccountAsync(string email)
    {
        try
        {
            var storagePath = System.IO.Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "JubileeOutlook",
                "SecureStorage"
            );

            if (!System.IO.Directory.Exists(storagePath))
                return null;

            var accountFiles = System.IO.Directory.GetFiles(storagePath, "account_*.dat");
            foreach (var file in accountFiles)
            {
                try
                {
                    var fileName = System.IO.Path.GetFileNameWithoutExtension(file);
                    var account = await _secureStorage.RetrieveAsync<Models.EmailSync.SyncedEmailAccount>(fileName);
                    if (account != null && string.Equals(account.EmailAddress, email, StringComparison.OrdinalIgnoreCase))
                    {
                        return account;
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[AuthWindow] Failed to check account {file}: {ex.Message}");
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[AuthWindow] Error finding existing account: {ex.Message}");
        }

        return null;
    }

    /// <summary>
    /// Resolves the user's identity in the Codex database by calling oauth-register.
    /// This ensures ServiceConfiguration.UserId is set to the correct user after Sync Email login.
    /// </summary>
    private async Task ResolveUserIdentityAsync(string email, string provider = "google")
    {
        try
        {
            System.Diagnostics.Debug.WriteLine($"[AuthWindow] Resolving user identity for {email} (provider: {provider})");

            var oauthService = new OAuth2AuthenticationService(_secureStorage);
            var result = await oauthService.RegisterOAuthUserAsync(
                email: email,
                displayName: email.Split('@')[0],
                provider: provider,
                providerId: null,
                avatarUrl: null
            );

            if (result.Success)
            {
                System.Diagnostics.Debug.WriteLine($"[AuthWindow] User identity resolved: {result.UserId} ({result.Email})");
            }
            else
            {
                System.Diagnostics.Debug.WriteLine($"[AuthWindow] Failed to resolve user identity: {result.ErrorMessage}");
            }
        }
        catch (Exception ex)
        {
            // Non-blocking - don't prevent login if identity resolution fails
            System.Diagnostics.Debug.WriteLine($"[AuthWindow] Error resolving user identity: {ex.Message}");
        }
    }

    private string DetectEmailProvider(string email)
    {
        var domain = email.Split('@').LastOrDefault()?.ToLower() ?? "";

        if (domain.Contains("gmail") || domain.Contains("google"))
            return "Gmail";
        if (domain.Contains("outlook") || domain.Contains("hotmail") || domain.Contains("live") || domain.Contains("msn"))
            return "Microsoft 365";
        if (domain.Contains("yahoo"))
            return "Yahoo";
        if (domain.Contains("icloud") || domain.Contains("me.com") || domain.Contains("mac.com"))
            return "iCloud";

        return "IMAP/POP";
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
