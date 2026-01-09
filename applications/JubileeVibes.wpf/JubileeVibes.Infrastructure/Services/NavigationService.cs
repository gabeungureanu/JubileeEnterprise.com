using JubileeVibes.Core.Enums;
using JubileeVibes.Core.Interfaces;

namespace JubileeVibes.Infrastructure.Services;

public class NavigationService : INavigationService
{
    private readonly Stack<NavigationEntry> _backStack = new();
    private readonly Stack<NavigationEntry> _forwardStack = new();

    private NavigationTarget _currentPage = NavigationTarget.None;
    private object? _currentParameter;

    public NavigationTarget CurrentPage => _currentPage;
    public object? CurrentParameter => _currentParameter;
    public bool CanGoBack => _backStack.Count > 0;
    public bool CanGoForward => _forwardStack.Count > 0;

    public event EventHandler<NavigationEventArgs>? Navigated;

    public void NavigateTo(NavigationTarget target, object? parameter = null)
    {
        if (_currentPage == target && Equals(_currentParameter, parameter))
            return;

        var previousTarget = _currentPage;

        if (_currentPage != NavigationTarget.None)
        {
            _backStack.Push(new NavigationEntry(_currentPage, _currentParameter));
        }
        _forwardStack.Clear();

        _currentPage = target;
        _currentParameter = parameter;

        Navigated?.Invoke(this, new NavigationEventArgs(target, parameter, previousTarget));
    }

    public void NavigateToAlbum(string albumId)
        => NavigateTo(NavigationTarget.Album, albumId);

    public void NavigateToArtist(string artistId)
        => NavigateTo(NavigationTarget.Artist, artistId);

    public void NavigateToPlaylist(string playlistId)
        => NavigateTo(NavigationTarget.Playlist, playlistId);

    public void GoBack()
    {
        if (!CanGoBack) return;

        _forwardStack.Push(new NavigationEntry(_currentPage, _currentParameter));

        var entry = _backStack.Pop();
        var previousTarget = _currentPage;
        _currentPage = entry.Target;
        _currentParameter = entry.Parameter;

        Navigated?.Invoke(this, new NavigationEventArgs(_currentPage, _currentParameter, previousTarget));
    }

    public void GoForward()
    {
        if (!CanGoForward) return;

        _backStack.Push(new NavigationEntry(_currentPage, _currentParameter));

        var entry = _forwardStack.Pop();
        var previousTarget = _currentPage;
        _currentPage = entry.Target;
        _currentParameter = entry.Parameter;

        Navigated?.Invoke(this, new NavigationEventArgs(_currentPage, _currentParameter, previousTarget));
    }

    private record NavigationEntry(NavigationTarget Target, object? Parameter);
}
