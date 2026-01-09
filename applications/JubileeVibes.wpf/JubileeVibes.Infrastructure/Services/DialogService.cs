using System.Windows;
using Microsoft.Win32;
using JubileeVibes.Core.Interfaces;

namespace JubileeVibes.Infrastructure.Services;

public class DialogService : IDialogService
{
    public Task<bool> ShowConfirmationAsync(string title, string message)
    {
        var result = System.Windows.MessageBox.Show(
            message,
            title,
            MessageBoxButton.YesNo,
            MessageBoxImage.Question);

        return Task.FromResult(result == MessageBoxResult.Yes);
    }

    public Task ShowErrorAsync(string title, string message)
    {
        System.Windows.MessageBox.Show(message, title, MessageBoxButton.OK, MessageBoxImage.Error);
        return Task.CompletedTask;
    }

    public Task ShowInfoAsync(string title, string message)
    {
        System.Windows.MessageBox.Show(message, title, MessageBoxButton.OK, MessageBoxImage.Information);
        return Task.CompletedTask;
    }

    public Task<string?> ShowInputAsync(string title, string message, string? defaultValue = null)
    {
        // In production would use custom WPF dialog
        // For now, returning default value as placeholder
        return Task.FromResult(defaultValue);
    }

    public Task<string?> ShowOpenFileDialogAsync(string title, string filter)
    {
        var dialog = new OpenFileDialog
        {
            Title = title,
            Filter = filter
        };

        return Task.FromResult(dialog.ShowDialog() == true ? dialog.FileName : null);
    }

    public Task<string?> ShowSaveFolderDialogAsync(string title)
    {
        var dialog = new OpenFolderDialog
        {
            Title = title
        };

        return Task.FromResult(dialog.ShowDialog() == true ? dialog.FolderName : null);
    }

    public Task<T?> ShowDialogAsync<T>(object viewModel) where T : class
    {
        // Would create and show dialog window
        return Task.FromResult<T?>(null);
    }
}
