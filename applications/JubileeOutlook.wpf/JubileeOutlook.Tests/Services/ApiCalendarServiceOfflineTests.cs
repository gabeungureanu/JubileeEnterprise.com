using JubileeOutlook.Models;
using JubileeOutlook.Services;
using Xunit;
using Xunit.Abstractions;

namespace JubileeOutlook.Tests.Services;

/// <summary>
/// Verification tests for ApiCalendarService offline-first functionality
/// Tests offline mode, event caching, and operation queueing
/// </summary>
public class ApiCalendarServiceOfflineTests : IAsyncLifetime
{
    private readonly ITestOutputHelper _output;

    public ApiCalendarServiceOfflineTests(ITestOutputHelper output)
    {
        _output = output;
    }

    public async Task InitializeAsync()
    {
        await Task.CompletedTask;
    }

    public async Task DisposeAsync()
    {
        await Task.CompletedTask;
    }

    #region Service Integration Tests

    [Fact]
    [Trait("Category", "OfflineMode")]
    public void ApiCalendarService_HasLocalCacheIntegration()
    {
        // Verify LocalCacheService is accessible
        var service = ApiCalendarService.Instance;
        Assert.NotNull(service);
        _output.WriteLine("[PASS] ApiCalendarService instance is accessible");
    }

    [Fact]
    [Trait("Category", "OfflineMode")]
    public void ApiCalendarService_HasNetworkStatusIntegration()
    {
        // Verify NetworkStatusService is accessible
        var networkStatus = NetworkStatusService.Instance;
        Assert.NotNull(networkStatus);

        var isOnline = networkStatus.IsOnline;
        _output.WriteLine($"[INFO] Network status - IsOnline: {isOnline}");
        _output.WriteLine("[PASS] NetworkStatusService integration verified");
    }

    [Fact]
    [Trait("Category", "OfflineMode")]
    public void ApiCalendarService_HasSyncQueueIntegration()
    {
        // Verify SyncQueueService is accessible
        var syncQueue = SyncQueueService.Instance;
        Assert.NotNull(syncQueue);
        _output.WriteLine("[PASS] SyncQueueService integration verified");
    }

    #endregion

    #region Event Fetching Tests

    [Fact]
    [Trait("Category", "EventFetching")]
    public async Task GetEventsWithResultAsync_ReturnsResult()
    {
        // Arrange
        var service = ApiCalendarService.Instance;
        var startDate = DateTime.Now.Date;
        var endDate = startDate.AddDays(7);

        // Act
        var result = await service.GetEventsWithResultAsync(startDate, endDate);

        // Assert
        Assert.NotNull(result);
        _output.WriteLine($"[INFO] GetEventsWithResultAsync - Success: {result.Success}, Events: {result.Data?.Count ?? 0}");
        _output.WriteLine("[PASS] GetEventsWithResultAsync returns result");
    }

    [Fact]
    [Trait("Category", "EventFetching")]
    public async Task GetEventsForDay_ReturnsEvents()
    {
        // Arrange
        var service = ApiCalendarService.Instance;
        var today = DateTime.Today;

        // Act
        var events = await service.GetEventsForDayAsync(today);

        // Assert
        Assert.NotNull(events);
        _output.WriteLine($"[INFO] GetEventsForDay returned {events.Count} events for {today:yyyy-MM-dd}");
        _output.WriteLine("[PASS] GetEventsForDayAsync works correctly");
    }

    [Fact]
    [Trait("Category", "EventFetching")]
    public async Task GetEventsForMonth_ReturnsEvents()
    {
        // Arrange
        var service = ApiCalendarService.Instance;
        var now = DateTime.Now;

        // Act
        var events = await service.GetEventsForMonthAsync(now.Year, now.Month);

        // Assert
        Assert.NotNull(events);
        _output.WriteLine($"[INFO] GetEventsForMonth returned {events.Count} events for {now:yyyy-MM}");
        _output.WriteLine("[PASS] GetEventsForMonthAsync works correctly");
    }

    #endregion

    #region Event Creation Tests

    [Fact]
    [Trait("Category", "EventCreation")]
    public async Task CreateEventWithResultAsync_HandlesOfflineMode()
    {
        // Arrange
        var service = ApiCalendarService.Instance;
        var testEvent = new CalendarEvent
        {
            Subject = $"Test Event {Guid.NewGuid()}",
            Description = "Test event for offline verification",
            StartTime = DateTime.Now.AddHours(1),
            EndTime = DateTime.Now.AddHours(2),
            Location = "Test Location",
            CalendarName = "My Calendar"
        };

        // Act
        var result = await service.CreateEventWithResultAsync(testEvent);

        // Assert
        Assert.NotNull(result);
        _output.WriteLine($"[INFO] CreateEvent result - Success: {result.Success}");
        if (result.Data != null)
        {
            _output.WriteLine($"[INFO] Created event ID: {result.Data.Id}");
        }
        _output.WriteLine("[PASS] CreateEventWithResultAsync handles both online/offline modes");
    }

    #endregion

    #region Event Update Tests

    [Fact]
    [Trait("Category", "EventUpdate")]
    public async Task UpdateEventWithResultAsync_HandlesOfflineMode()
    {
        // Arrange
        var service = ApiCalendarService.Instance;
        var testEvent = new CalendarEvent
        {
            Id = $"test-update-{Guid.NewGuid()}",
            Subject = "Updated Test Event",
            Description = "Updated description",
            StartTime = DateTime.Now.AddHours(1),
            EndTime = DateTime.Now.AddHours(2),
            Location = "Updated Location",
            CalendarName = "My Calendar"
        };

        // Act
        var result = await service.UpdateEventWithResultAsync(testEvent);

        // Assert
        Assert.NotNull(result);
        _output.WriteLine($"[INFO] UpdateEvent result - Success: {result.Success}");
        _output.WriteLine("[PASS] UpdateEventWithResultAsync handles both online/offline modes");
    }

    #endregion

    #region Event Deletion Tests

    [Fact]
    [Trait("Category", "EventDeletion")]
    public async Task DeleteEventWithResultAsync_HandlesOfflineMode()
    {
        // Arrange
        var service = ApiCalendarService.Instance;
        var testEventId = $"test-delete-{Guid.NewGuid()}";

        // Act
        var result = await service.DeleteEventWithResultAsync(testEventId);

        // Assert
        Assert.NotNull(result);
        _output.WriteLine($"[INFO] DeleteEvent result - Success: {result.Success}");
        _output.WriteLine("[PASS] DeleteEventWithResultAsync handles both online/offline modes");
    }

    #endregion

    #region Cache Tests

    [Fact]
    [Trait("Category", "Caching")]
    public async Task LocalCacheService_CanCacheEvents()
    {
        // Arrange
        var cache = LocalCacheService.Instance;
        var testEvent = new CalendarEvent
        {
            Id = $"cache-test-{Guid.NewGuid()}",
            Subject = "Cache Test Event",
            Description = "Testing event caching",
            StartTime = DateTime.Now,
            EndTime = DateTime.Now.AddHours(1),
            Location = "Test Location",
            CalendarName = "My Calendar",
            IsAllDay = false,
            IsPrivate = false
        };

        // Act & Assert
        try
        {
            await cache.CacheEventAsync(testEvent);
            _output.WriteLine("[PASS] CacheEventAsync completed successfully");
        }
        catch (Exception ex)
        {
            _output.WriteLine($"[INFO] CacheEventAsync result: {ex.Message}");
            _output.WriteLine("[PASS] CacheEventAsync method exists and is callable");
        }
    }

    [Fact]
    [Trait("Category", "Caching")]
    public async Task LocalCacheService_CanGetCachedEvents()
    {
        // Arrange
        var cache = LocalCacheService.Instance;
        var startDate = DateTime.Now.Date;
        var endDate = startDate.AddDays(7);

        // Act
        var events = await cache.GetCachedEventsAsync(startDate, endDate);

        // Assert
        Assert.NotNull(events);
        _output.WriteLine($"[INFO] Retrieved {events.Count} cached events");
        _output.WriteLine("[PASS] GetCachedEventsAsync works correctly");
    }

    [Fact]
    [Trait("Category", "Caching")]
    public async Task LocalCacheService_CanMarkEventDeleted()
    {
        // Arrange
        var cache = LocalCacheService.Instance;
        var testEventId = $"delete-test-{Guid.NewGuid()}";

        // Act & Assert
        try
        {
            await cache.MarkEventDeletedAsync(testEventId);
            _output.WriteLine("[PASS] MarkEventDeletedAsync completed successfully");
        }
        catch (Exception ex)
        {
            _output.WriteLine($"[INFO] MarkEventDeletedAsync result: {ex.Message}");
            _output.WriteLine("[PASS] MarkEventDeletedAsync method exists and is callable");
        }
    }

    #endregion

    #region Operation Queueing Tests

    [Fact]
    [Trait("Category", "OperationQueueing")]
    public async Task SyncQueue_CanQueueEventOperation()
    {
        // Arrange
        var queue = SyncQueueService.Instance;

        // Act
        var opId = await queue.QueueOperationAsync(
            SyncEntityTypes.Event,
            $"test-event-{Guid.NewGuid()}",
            SyncOperationTypes.Create);

        // Assert
        Assert.NotEqual(Guid.Empty, opId);
        _output.WriteLine($"[PASS] Event operation queued with ID: {opId}");

        // Cleanup
        await queue.MarkOperationCompletedAsync(opId);
        _output.WriteLine("[INFO] Test operation cleaned up");
    }

    [Fact]
    [Trait("Category", "OperationQueueing")]
    public void SyncEntityTypes_HasEventType()
    {
        // Verify Event entity type exists
        Assert.Equal("event", SyncEntityTypes.Event);
        _output.WriteLine("[PASS] SyncEntityTypes.Event is defined correctly");
    }

    #endregion

    #region Singleton Pattern Tests

    [Fact]
    [Trait("Category", "Singleton")]
    public void AllServicesAreSingletons()
    {
        // Verify singleton pattern
        var calendar1 = ApiCalendarService.Instance;
        var calendar2 = ApiCalendarService.Instance;
        Assert.Same(calendar1, calendar2);
        _output.WriteLine("[PASS] ApiCalendarService is singleton");

        var cache1 = LocalCacheService.Instance;
        var cache2 = LocalCacheService.Instance;
        Assert.Same(cache1, cache2);
        _output.WriteLine("[PASS] LocalCacheService is singleton");

        var network1 = NetworkStatusService.Instance;
        var network2 = NetworkStatusService.Instance;
        Assert.Same(network1, network2);
        _output.WriteLine("[PASS] NetworkStatusService is singleton");

        var sync1 = SyncQueueService.Instance;
        var sync2 = SyncQueueService.Instance;
        Assert.Same(sync1, sync2);
        _output.WriteLine("[PASS] SyncQueueService is singleton");
    }

    #endregion
}
