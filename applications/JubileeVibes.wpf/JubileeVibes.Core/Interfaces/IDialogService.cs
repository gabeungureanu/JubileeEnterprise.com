namespace JubileeVibes.Core.Interfaces;

public interface IDialogService
{
    Task<bool> ShowConfirmationAsync(string title, string message);
    Task ShowErrorAsync(string title, string message);
    Task ShowInfoAsync(string title, string message);
    Task<string?> ShowInputAsync(string title, string message, string? defaultValue = null);
    Task<string?> ShowOpenFileDialogAsync(string title, string filter);
    Task<string?> ShowSaveFolderDialogAsync(string title);
    Task<T?> ShowDialogAsync<T>(object viewModel) where T : class;
}
