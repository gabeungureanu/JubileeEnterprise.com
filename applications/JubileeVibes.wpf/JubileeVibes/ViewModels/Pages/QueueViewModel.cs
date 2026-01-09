using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JubileeVibes.Core.Interfaces;
using JubileeVibes.Core.Models;

namespace JubileeVibes.ViewModels.Pages;

public partial class QueueViewModel : ViewModelBase
{
    private readonly IQueueService _queueService;
    private readonly IAudioPlaybackService _playbackService;
    private readonly INavigationService _navigationService;

    [ObservableProperty]
    private Track? _currentTrack;

    [ObservableProperty]
    private ObservableCollection<QueueItem> _queue = new();

    [ObservableProperty]
    private ObservableCollection<QueueItem> _history = new();

    public QueueViewModel(
        IQueueService queueService,
        IAudioPlaybackService playbackService,
        INavigationService navigationService)
    {
        _queueService = queueService;
        _playbackService = playbackService;
        _navigationService = navigationService;

        _queueService.QueueChanged += OnQueueChanged;
        _playbackService.TrackChanged += OnTrackChanged;
    }

    public override Task InitializeAsync()
    {
        LoadQueue();
        return Task.CompletedTask;
    }

    private void OnQueueChanged(object? sender, EventArgs e)
    {
        LoadQueue();
    }

    private void OnTrackChanged(object? sender, Core.Events.TrackChangedEventArgs e)
    {
        CurrentTrack = e.CurrentTrack;
        LoadQueue();
    }

    private void LoadQueue()
    {
        CurrentTrack = _playbackService.CurrentTrack;
        Queue = new ObservableCollection<QueueItem>(_queueService.Queue);
        History = new ObservableCollection<QueueItem>(_queueService.History);
    }

    [RelayCommand]
    private async Task PlayItem(QueueItem item)
    {
        await _playbackService.PlayAsync(item.Track);
    }

    [RelayCommand]
    private void RemoveFromQueue(int index)
    {
        _queueService.RemoveFromQueue(index);
    }

    [RelayCommand]
    private void ClearQueue()
    {
        _queueService.ClearQueue();
    }

    [RelayCommand]
    private void MoveUp(int index)
    {
        if (index > 0)
        {
            _queueService.MoveItem(index, index - 1);
        }
    }

    [RelayCommand]
    private void MoveDown(int index)
    {
        if (index < Queue.Count - 1)
        {
            _queueService.MoveItem(index, index + 1);
        }
    }

    [RelayCommand]
    private void GoBack()
    {
        _navigationService.GoBack();
    }
}
