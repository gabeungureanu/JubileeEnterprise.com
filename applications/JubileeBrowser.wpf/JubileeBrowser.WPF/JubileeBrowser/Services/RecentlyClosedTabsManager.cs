using JubileeBrowser.Models;

namespace JubileeBrowser.Services;

/// <summary>
/// Manages a stack of recently closed tabs for restoration.
/// </summary>
public class RecentlyClosedTabsManager
{
    private readonly Stack<ClosedTabInfo> _closedTabs = new();
    private const int MaxClosedTabs = 25;

    /// <summary>
    /// Information about a closed tab that can be restored.
    /// </summary>
    public class ClosedTabInfo
    {
        public string Url { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public BrowserMode Mode { get; set; }
        public string? Favicon { get; set; }
        public DateTime ClosedAt { get; set; }
        public List<string> NavigationHistory { get; set; } = new();
        public int HistoryIndex { get; set; }
        public string? GroupId { get; set; }
        public bool WasPinned { get; set; }
    }

    /// <summary>
    /// Records a tab as closed, storing its state for potential restoration.
    /// </summary>
    public void RecordClosedTab(TabState tab, List<string>? navigationHistory = null, int historyIndex = 0)
    {
        var closedTab = new ClosedTabInfo
        {
            Url = tab.Url,
            Title = tab.Title,
            Mode = tab.Mode,
            Favicon = tab.Favicon,
            ClosedAt = DateTime.UtcNow,
            NavigationHistory = navigationHistory ?? new List<string> { tab.Url },
            HistoryIndex = historyIndex,
            GroupId = tab.GroupId,
            WasPinned = tab.IsPinned
        };

        _closedTabs.Push(closedTab);

        // Trim old entries if we exceed the limit
        while (_closedTabs.Count > MaxClosedTabs)
        {
            var tempStack = new Stack<ClosedTabInfo>();
            for (int i = 0; i < MaxClosedTabs; i++)
            {
                tempStack.Push(_closedTabs.Pop());
            }
            _closedTabs.Clear();
            while (tempStack.Count > 0)
            {
                _closedTabs.Push(tempStack.Pop());
            }
        }
    }

    /// <summary>
    /// Pops and returns the most recently closed tab, or null if none available.
    /// </summary>
    public ClosedTabInfo? PopClosedTab()
    {
        return _closedTabs.Count > 0 ? _closedTabs.Pop() : null;
    }

    /// <summary>
    /// Peeks at the most recently closed tab without removing it.
    /// </summary>
    public ClosedTabInfo? PeekClosedTab()
    {
        return _closedTabs.Count > 0 ? _closedTabs.Peek() : null;
    }

    /// <summary>
    /// Gets the count of closed tabs available for restoration.
    /// </summary>
    public int Count => _closedTabs.Count;

    /// <summary>
    /// Returns whether there are any closed tabs to restore.
    /// </summary>
    public bool HasClosedTabs => _closedTabs.Count > 0;

    /// <summary>
    /// Gets a list of all recently closed tabs (for display in a menu).
    /// </summary>
    public IReadOnlyList<ClosedTabInfo> GetRecentlyClosedTabs(int limit = 10)
    {
        return _closedTabs.Take(limit).ToList();
    }

    /// <summary>
    /// Clears all closed tab history.
    /// </summary>
    public void Clear()
    {
        _closedTabs.Clear();
    }
}
