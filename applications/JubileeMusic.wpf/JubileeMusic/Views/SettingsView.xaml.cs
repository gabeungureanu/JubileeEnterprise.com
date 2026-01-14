using System.Windows;
using System.Windows.Controls;
using JubileeMusic.ViewModels;

namespace JubileeMusic.Views;

public partial class SettingsView : UserControl
{
    public SettingsView()
    {
        InitializeComponent();
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        if (DataContext is SettingsViewModel viewModel)
        {
            await viewModel.LoadSettingsCommand.ExecuteAsync(null);

            // Set password placeholder if credentials exist
            if (viewModel.HasStoredCredentials)
            {
                PasswordBox.Password = "********";
            }
        }
    }

    private void OnPasswordChanged(object sender, RoutedEventArgs e)
    {
        if (DataContext is SettingsViewModel viewModel)
        {
            // Use reflection or a helper to set the password
            // This is needed because PasswordBox.Password is not bindable
            var password = PasswordBox.Password;
            if (password != "********")
            {
                viewModel.GetType().GetProperty("Password")?.SetValue(viewModel, password);
            }
        }
    }
}
