using CommunityToolkit.Mvvm.ComponentModel;

namespace JubileeVibes.ViewModels;

public abstract partial class ViewModelBase : ObservableObject
{
    [ObservableProperty]
    private bool _isLoading;

    [ObservableProperty]
    private string? _errorMessage;

    [ObservableProperty]
    private bool _hasError;

    partial void OnErrorMessageChanged(string? value)
    {
        HasError = !string.IsNullOrEmpty(value);
    }

    public virtual Task InitializeAsync() => Task.CompletedTask;

    public virtual Task OnNavigatedTo(object? parameter) => Task.CompletedTask;

    public virtual Task OnNavigatedFrom() => Task.CompletedTask;

    protected void ClearError() => ErrorMessage = null;

    protected void SetError(string message) => ErrorMessage = message;
}
