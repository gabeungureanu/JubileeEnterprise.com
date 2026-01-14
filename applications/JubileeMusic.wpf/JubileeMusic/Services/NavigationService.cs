using System;
using System.Collections.Generic;
using Microsoft.Extensions.Logging;

namespace JubileeMusic.Services;

public class NavigationService : INavigationService
{
    private readonly ILogger<NavigationService> _logger;
    private readonly Stack<string> _navigationHistory = new();
    private string _currentView = "Browser";

    public string CurrentView => _currentView;
    public bool CanNavigateBack => _navigationHistory.Count > 0;

    public event EventHandler<NavigationEventArgs>? NavigationChanged;

    public NavigationService(ILogger<NavigationService> logger)
    {
        _logger = logger;
    }

    public void NavigateTo(string viewName)
    {
        if (string.IsNullOrWhiteSpace(viewName))
        {
            _logger.LogWarning("Attempted to navigate to empty view name");
            return;
        }

        if (_currentView == viewName)
        {
            _logger.LogDebug("Already on view {View}, skipping navigation", viewName);
            return;
        }

        var previousView = _currentView;

        // Push current view to history before navigating
        if (!string.IsNullOrEmpty(_currentView))
        {
            _navigationHistory.Push(_currentView);
        }

        _currentView = viewName;

        _logger.LogInformation("Navigated from {Previous} to {Current}", previousView, viewName);

        NavigationChanged?.Invoke(this, new NavigationEventArgs
        {
            PreviousView = previousView,
            CurrentView = viewName
        });
    }

    public void NavigateBack()
    {
        if (!CanNavigateBack)
        {
            _logger.LogWarning("Cannot navigate back - history is empty");
            return;
        }

        var previousView = _currentView;
        _currentView = _navigationHistory.Pop();

        _logger.LogInformation("Navigated back from {Previous} to {Current}", previousView, _currentView);

        NavigationChanged?.Invoke(this, new NavigationEventArgs
        {
            PreviousView = previousView,
            CurrentView = _currentView
        });
    }
}
