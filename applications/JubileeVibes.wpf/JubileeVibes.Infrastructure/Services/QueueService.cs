using JubileeVibes.Core.Interfaces;
using JubileeVibes.Core.Models;

namespace JubileeVibes.Infrastructure.Services;

public class QueueService : IQueueService
{
    private readonly List<QueueItem> _queue = new();
    private readonly List<QueueItem> _history = new();
    private readonly List<QueueItem> _originalQueue = new();

    private int _currentIndex = -1;
    private bool _isShuffled;
    private readonly Random _random = new();

    public IReadOnlyList<QueueItem> Queue => _queue.Skip(_currentIndex + 1).ToList().AsReadOnly();
    public IReadOnlyList<QueueItem> History => _history.AsReadOnly();
    public QueueItem? CurrentItem => _currentIndex >= 0 && _currentIndex < _queue.Count ? _queue[_currentIndex] : null;
    public int CurrentIndex => _currentIndex;
    public bool IsShuffled => _isShuffled;

    public event EventHandler? QueueChanged;
    public event EventHandler<QueueItem?>? CurrentItemChanged;

    public void SetQueue(IEnumerable<Track> tracks, int startIndex = 0)
    {
        _queue.Clear();
        _originalQueue.Clear();
        _history.Clear();

        foreach (var track in tracks)
        {
            var item = new QueueItem { Track = track };
            _queue.Add(item);
            _originalQueue.Add(item);
        }

        _currentIndex = startIndex - 1; // Will be incremented by GetNext()

        if (_isShuffled)
        {
            ShuffleFromIndex(startIndex);
        }

        QueueChanged?.Invoke(this, EventArgs.Empty);
    }

    public void AddToQueue(Track track)
    {
        var item = new QueueItem { Track = track, IsUserAdded = true };
        _queue.Add(item);
        _originalQueue.Add(item);
        QueueChanged?.Invoke(this, EventArgs.Empty);
    }

    public void AddToQueue(IEnumerable<Track> tracks)
    {
        foreach (var track in tracks)
        {
            AddToQueue(track);
        }
    }

    public void AddNext(Track track)
    {
        var item = new QueueItem { Track = track, IsUserAdded = true };
        var insertIndex = _currentIndex + 1;
        if (insertIndex <= _queue.Count)
        {
            _queue.Insert(insertIndex, item);
            _originalQueue.Add(item);
        }
        else
        {
            _queue.Add(item);
            _originalQueue.Add(item);
        }
        QueueChanged?.Invoke(this, EventArgs.Empty);
    }

    public void RemoveFromQueue(int index)
    {
        var actualIndex = _currentIndex + 1 + index;
        if (actualIndex >= 0 && actualIndex < _queue.Count)
        {
            _queue.RemoveAt(actualIndex);
            QueueChanged?.Invoke(this, EventArgs.Empty);
        }
    }

    public void ClearQueue()
    {
        // Keep only items up to and including current
        var toRemove = _queue.Skip(_currentIndex + 1).ToList();
        foreach (var item in toRemove)
        {
            _queue.Remove(item);
        }
        QueueChanged?.Invoke(this, EventArgs.Empty);
    }

    public void MoveItem(int fromIndex, int toIndex)
    {
        var actualFromIndex = _currentIndex + 1 + fromIndex;
        var actualToIndex = _currentIndex + 1 + toIndex;

        if (actualFromIndex >= 0 && actualFromIndex < _queue.Count &&
            actualToIndex >= 0 && actualToIndex < _queue.Count)
        {
            var item = _queue[actualFromIndex];
            _queue.RemoveAt(actualFromIndex);
            _queue.Insert(actualToIndex, item);
            QueueChanged?.Invoke(this, EventArgs.Empty);
        }
    }

    public Track? GetNext()
    {
        if (_currentIndex + 1 >= _queue.Count)
            return null;

        // Move current to history
        if (_currentIndex >= 0 && _currentIndex < _queue.Count)
        {
            var current = _queue[_currentIndex];
            current.IsCurrentlyPlaying = false;
            _history.Add(current);
        }

        _currentIndex++;

        if (_currentIndex < _queue.Count)
        {
            var next = _queue[_currentIndex];
            next.IsCurrentlyPlaying = true;
            CurrentItemChanged?.Invoke(this, next);
            QueueChanged?.Invoke(this, EventArgs.Empty);
            return next.Track;
        }

        CurrentItemChanged?.Invoke(this, null);
        return null;
    }

    public Track? GetPrevious()
    {
        if (_history.Count == 0)
            return null;

        // Move current back to queue
        if (_currentIndex >= 0 && _currentIndex < _queue.Count)
        {
            _queue[_currentIndex].IsCurrentlyPlaying = false;
        }

        var previous = _history[^1];
        _history.RemoveAt(_history.Count - 1);
        _currentIndex--;

        if (_currentIndex >= 0 && _currentIndex < _queue.Count)
        {
            _queue[_currentIndex].IsCurrentlyPlaying = true;
            CurrentItemChanged?.Invoke(this, _queue[_currentIndex]);
        }

        QueueChanged?.Invoke(this, EventArgs.Empty);
        return previous.Track;
    }

    public Track? PeekNext()
    {
        return _currentIndex + 1 < _queue.Count ? _queue[_currentIndex + 1].Track : null;
    }

    public void EnableShuffle()
    {
        if (_isShuffled) return;
        _isShuffled = true;
        ShuffleFromIndex(_currentIndex + 1);
        QueueChanged?.Invoke(this, EventArgs.Empty);
    }

    public void DisableShuffle()
    {
        if (!_isShuffled) return;
        _isShuffled = false;

        // Restore original order for remaining items
        var currentItem = CurrentItem;
        var remaining = _queue.Skip(_currentIndex + 1).ToList();
        _queue.RemoveRange(_currentIndex + 1, remaining.Count);

        foreach (var item in _originalQueue)
        {
            if (remaining.Contains(item))
            {
                _queue.Add(item);
            }
        }

        QueueChanged?.Invoke(this, EventArgs.Empty);
    }

    public void RestartQueue()
    {
        _history.Clear();
        _currentIndex = -1;

        foreach (var item in _queue)
        {
            item.IsCurrentlyPlaying = false;
        }

        if (_isShuffled)
        {
            ShuffleFromIndex(0);
        }

        QueueChanged?.Invoke(this, EventArgs.Empty);
    }

    private void ShuffleFromIndex(int startIndex)
    {
        if (startIndex >= _queue.Count) return;

        var toShuffle = _queue.Skip(startIndex).ToList();
        _queue.RemoveRange(startIndex, toShuffle.Count);

        // Fisher-Yates shuffle
        for (int i = toShuffle.Count - 1; i > 0; i--)
        {
            int j = _random.Next(i + 1);
            (toShuffle[i], toShuffle[j]) = (toShuffle[j], toShuffle[i]);
        }

        _queue.AddRange(toShuffle);
    }
}
