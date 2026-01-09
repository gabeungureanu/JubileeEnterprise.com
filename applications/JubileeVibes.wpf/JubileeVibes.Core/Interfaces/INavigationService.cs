using JubileeVibes.Core.Enums;

namespace JubileeVibes.Core.Interfaces;

public interface INavigationService
{
    NavigationTarget CurrentPage { get; }
    object? CurrentParameter { get; }
    bool CanGoBack { get; }
    bool CanGoForward { get; }

    event EventHandler<NavigationEventArgs>? Navigated;

    void NavigateTo(NavigationTarget target, object? parameter = null);
    void NavigateToAlbum(string albumId);
    void NavigateToArtist(string artistId);
    void NavigateToPlaylist(string playlistId);
    void GoBack();
    void GoForward();
}

public class NavigationEventArgs : EventArgs
{
    public NavigationTarget Target { get; }
    public object? Parameter { get; }
    public NavigationTarget? PreviousTarget { get; }

    public NavigationEventArgs(NavigationTarget target, object? parameter = null, NavigationTarget? previousTarget = null)
    {
        Target = target;
        Parameter = parameter;
        PreviousTarget = previousTarget;
    }
}
