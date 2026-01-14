using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace JubileeMusic.ViewModels;

public abstract partial class BaseViewModel : ObservableObject
{
    [ObservableProperty]
    private bool _isBusy;

    [ObservableProperty]
    private string _statusMessage = string.Empty;

    [ObservableProperty]
    private bool _hasError;

    [ObservableProperty]
    private string _errorMessage = string.Empty;

    protected void SetError(string message)
    {
        ErrorMessage = message;
        HasError = true;
        StatusMessage = message;
    }

    protected void ClearError()
    {
        ErrorMessage = string.Empty;
        HasError = false;
    }

    protected void SetStatus(string message)
    {
        StatusMessage = message;
        ClearError();
    }

    protected async Task ExecuteWithBusyIndicator(Func<Task> action, string? statusMessage = null)
    {
        if (IsBusy) return;

        try
        {
            IsBusy = true;
            ClearError();

            if (!string.IsNullOrEmpty(statusMessage))
            {
                StatusMessage = statusMessage;
            }

            await action();
        }
        catch (Exception ex)
        {
            SetError(ex.Message);
        }
        finally
        {
            IsBusy = false;
        }
    }
}
