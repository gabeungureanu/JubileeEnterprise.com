using JubileeVibes.Core.Models;

namespace JubileeVibes.Core.Interfaces;

public interface IQueueService
{
    IReadOnlyList<QueueItem> Queue { get; }
    IReadOnlyList<QueueItem> History { get; }
    QueueItem? CurrentItem { get; }
    int CurrentIndex { get; }
    bool IsShuffled { get; }

    event EventHandler? QueueChanged;
    event EventHandler<QueueItem?>? CurrentItemChanged;

    void SetQueue(IEnumerable<Track> tracks, int startIndex = 0);
    void AddToQueue(Track track);
    void AddToQueue(IEnumerable<Track> tracks);
    void AddNext(Track track);
    void RemoveFromQueue(int index);
    void ClearQueue();
    void MoveItem(int fromIndex, int toIndex);

    Track? GetNext();
    Track? GetPrevious();
    Track? PeekNext();

    void EnableShuffle();
    void DisableShuffle();
    void RestartQueue();
}

public class QueueItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public Track Track { get; set; } = null!;
    public bool IsCurrentlyPlaying { get; set; }
    public bool IsUserAdded { get; set; }
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;
}
