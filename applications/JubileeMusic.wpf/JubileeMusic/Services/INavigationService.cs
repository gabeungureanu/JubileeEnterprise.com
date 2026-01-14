namespace JubileeMusic.Services;

public interface INavigationService
{
    string CurrentView { get; }
    void NavigateTo(string viewName);
    void NavigateBack();
    bool CanNavigateBack { get; }
    event EventHandler<NavigationEventArgs>? NavigationChanged;
}

public class NavigationEventArgs : EventArgs
{
    public string? PreviousView { get; set; }
    public string CurrentView { get; set; } = string.Empty;
}
