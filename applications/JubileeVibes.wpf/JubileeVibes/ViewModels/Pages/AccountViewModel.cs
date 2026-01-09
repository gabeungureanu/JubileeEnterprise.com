using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JubileeVibes.Core.Interfaces;
using JubileeVibes.Core.Models;

namespace JubileeVibes.ViewModels.Pages;

public partial class AccountViewModel : ViewModelBase
{
    private readonly IAuthenticationService _authenticationService;
    private readonly IDialogService _dialogService;
    private readonly INavigationService _navigationService;

    [ObservableProperty]
    private User? _user;

    [ObservableProperty]
    private bool _isLoggedIn;

    [ObservableProperty]
    private string _email = string.Empty;

    [ObservableProperty]
    private string _password = string.Empty;

    [ObservableProperty]
    private string? _loginError;

    public AccountViewModel(
        IAuthenticationService authenticationService,
        IDialogService dialogService,
        INavigationService navigationService)
    {
        _authenticationService = authenticationService;
        _dialogService = dialogService;
        _navigationService = navigationService;

        _authenticationService.AuthStateChanged += OnAuthStateChanged;
    }

    public override Task InitializeAsync()
    {
        UpdateAuthState();
        return Task.CompletedTask;
    }

    private void OnAuthStateChanged(object? sender, Core.Events.AuthStateChangedEventArgs e)
    {
        UpdateAuthState();
    }

    private void UpdateAuthState()
    {
        IsLoggedIn = _authenticationService.IsAuthenticated;
        User = _authenticationService.CurrentUser;
    }

    [RelayCommand]
    private async Task Login()
    {
        if (string.IsNullOrWhiteSpace(Email) || string.IsNullOrWhiteSpace(Password))
        {
            LoginError = "Please enter email and password";
            return;
        }

        IsLoading = true;
        LoginError = null;

        try
        {
            var result = await _authenticationService.SignInAsync(Email, Password);
            if (result.Success)
            {
                Password = string.Empty;
                Email = string.Empty;
            }
            else
            {
                LoginError = result.ErrorMessage ?? "Login failed";
            }
        }
        catch (Exception ex)
        {
            LoginError = $"Login error: {ex.Message}";
        }
        finally
        {
            IsLoading = false;
        }
    }

    [RelayCommand]
    private async Task Logout()
    {
        var confirmed = await _dialogService.ShowConfirmationAsync(
            "Sign Out",
            "Are you sure you want to sign out?");

        if (confirmed)
        {
            await _authenticationService.SignOutAsync();
        }
    }

    [RelayCommand]
    private async Task EditProfile()
    {
        await _dialogService.ShowInfoAsync("Edit Profile", "Profile editing coming soon!");
    }

    [RelayCommand]
    private async Task ChangePassword()
    {
        await _dialogService.ShowInfoAsync("Change Password", "Password change coming soon!");
    }
}
