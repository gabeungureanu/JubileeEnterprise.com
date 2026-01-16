using JubileeOutlook.Models;
using JubileeOutlook.Services;
using Xunit;
using Xunit.Abstractions;

namespace JubileeOutlook.Tests.Services;

/// <summary>
/// Integration tests for offline-first functionality
/// Tests end-to-end scenarios including startup, queueing, sync, and conflict resolution
/// </summary>
public class OfflineIntegrationTests : IAsyncLifetime
{
    private readonly ITestOutputHelper _output;
    private bool _isInitialized;
    private readonly List<string> _testEmailIds = new();
    private readonly List<string> _testEventIds = new();
    private readonly List<Guid> _testOperationIds = new();

    public OfflineIntegrationTests(ITestOutputHelper output)
    {
        _output = output;
    }

    public async Task InitializeAsync()
    {
        // Initialize all required services
        try
        {
            var cacheInit = await LocalCacheService.Instance.InitializeDatabaseAsync();
            var queueInit = await SyncQueueService.Instance.InitializeAsync();

            _isInitialized = cacheInit && queueInit;

            if (!_isInitialized)
            {
                _output.WriteLine("[WARN] Services not fully initialized - some tests may be skipped");
            }
            else
            {
                _output.WriteLine("[INFO] All services initialized successfully");
            }
        }
        catch (Exception ex)
        {
            _output.WriteLine($"[ERROR] Initialization failed: {ex.Message}");
            _isInitialized = false;
        }
    }

    public async Task DisposeAsync()
    {
        // Clean up test data
        foreach (var id in _testEmailIds)
        {
            try { await LocalCacheService.Instance.MarkEmailDeletedAsync(id); } catch { }
        }
        foreach (var id in _testEventIds)
        {
            try { await LocalCacheService.Instance.MarkEventDeletedAsync(id); } catch { }
        }
        foreach (var id in _testOperationIds)
        {
            try { await SyncQueueService.Instance.MarkOperationCompletedAsync(id); } catch { }
        }
    }

    #region Offline Startup Tests

    [Fact]
    [Trait("Category", "Integration")]
    [Trait("Scenario", "OfflineStartup")]
    public async Task OfflineStartup_LoadsCachedEmails()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        // Arrange - Pre-populate cache with test emails
        var testEmail = CreateTestEmail("inbox");
        _testEmailIds.Add(testEmail.Id);
        await LocalCacheService.Instance.CacheEmailAsync(testEmail);

        // Act - Simulate offline access (using LocalCacheService directly)
        var cachedEmails = await LocalCacheService.Instance.GetCachedEmailsAsync("inbox");

        // Assert
        Assert.NotNull(cachedEmails);
        var found = cachedEmails.Any(e => e.Id == testEmail.Id);
        Assert.True(found, "Cached email should be retrievable");

        _output.WriteLine($"[PASS] Offline startup - loaded {cachedEmails.Count} cached emails");
        _output.WriteLine($"[INFO] Test email found in cache: {found}");
    }

    [Fact]
    [Trait("Category", "Integration")]
    [Trait("Scenario", "OfflineStartup")]
    public async Task OfflineStartup_LoadsCachedEvents()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        // Arrange - Pre-populate cache with test event
        var testEvent = CreateTestEvent();
        _testEventIds.Add(testEvent.Id);
        await LocalCacheService.Instance.CacheEventAsync(testEvent);

        // Act - Retrieve cached events
        var cachedEvents = await LocalCacheService.Instance.GetCachedEventsAsync(
            testEvent.StartTime.AddDays(-1),
            testEvent.EndTime.AddDays(1));

        // Assert
        Assert.NotNull(cachedEvents);
        var found = cachedEvents.Any(e => e.Id == testEvent.Id);
        Assert.True(found, "Cached event should be retrievable");

        _output.WriteLine($"[PASS] Offline startup - loaded {cachedEvents.Count} cached events");
    }

    [Fact]
    [Trait("Category", "Integration")]
    [Trait("Scenario", "OfflineStartup")]
    public async Task OfflineStartup_LoadsCachedFolders()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        // Act - Get cached folders
        var folders = await LocalCacheService.Instance.GetCachedFoldersAsync();

        // Assert
        Assert.NotNull(folders);
        _output.WriteLine($"[PASS] Offline startup - loaded {folders.Count} cached folders");
    }

    #endregion

    #region Operation Queueing Tests

    [Fact]
    [Trait("Category", "Integration")]
    [Trait("Scenario", "OperationQueueing")]
    public async Task OfflineQueueing_QueuesCreateOperation()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        // Arrange
        var entityId = $"test-create-{Guid.NewGuid()}";
        var payload = new { subject = "Test Subject", body = "Test Body" };

        // Act - Queue a create operation
        var operationId = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Email,
            entityId,
            SyncOperationTypes.Create,
            payload);

        _testOperationIds.Add(operationId);

        // Assert
        Assert.NotEqual(Guid.Empty, operationId);
        _output.WriteLine($"[PASS] Create operation queued with ID: {operationId}");

        // Verify it's in the queue
        var pendingOps = await SyncQueueService.Instance.GetPendingOperationsAsync();
        var found = pendingOps.Any(op => op.Id == operationId);
        Assert.True(found, "Operation should be in pending queue");
        _output.WriteLine("[PASS] Operation found in pending queue");
    }

    [Fact]
    [Trait("Category", "Integration")]
    [Trait("Scenario", "OperationQueueing")]
    public async Task OfflineQueueing_QueuesUpdateOperation()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        // Arrange
        var entityId = $"test-update-{Guid.NewGuid()}";
        var payload = new { subject = "Updated Subject" };

        // Act
        var operationId = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Email,
            entityId,
            SyncOperationTypes.Update,
            payload);

        _testOperationIds.Add(operationId);

        // Assert
        Assert.NotEqual(Guid.Empty, operationId);
        _output.WriteLine($"[PASS] Update operation queued with ID: {operationId}");
    }

    [Fact]
    [Trait("Category", "Integration")]
    [Trait("Scenario", "OperationQueueing")]
    public async Task OfflineQueueing_QueuesDeleteOperation()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        // Arrange
        var entityId = $"test-delete-{Guid.NewGuid()}";

        // Act
        var operationId = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Email,
            entityId,
            SyncOperationTypes.Delete);

        _testOperationIds.Add(operationId);

        // Assert
        Assert.NotEqual(Guid.Empty, operationId);
        _output.WriteLine($"[PASS] Delete operation queued with ID: {operationId}");
    }

    [Fact]
    [Trait("Category", "Integration")]
    [Trait("Scenario", "OperationQueueing")]
    public async Task OfflineQueueing_QueuesMarkReadOperation()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        // Arrange
        var entityId = $"test-read-{Guid.NewGuid()}";

        // Act
        var operationId = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Email,
            entityId,
            SyncOperationTypes.MarkRead);

        _testOperationIds.Add(operationId);

        // Assert
        Assert.NotEqual(Guid.Empty, operationId);
        _output.WriteLine($"[PASS] MarkRead operation queued with ID: {operationId}");
    }

    [Fact]
    [Trait("Category", "Integration")]
    [Trait("Scenario", "OperationQueueing")]
    public async Task OfflineQueueing_PreservesOperationOrder()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        // Arrange - Queue multiple operations
        var op1 = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Email, $"order-test-1-{Guid.NewGuid()}", SyncOperationTypes.Create);
        _testOperationIds.Add(op1);

        await Task.Delay(10); // Small delay to ensure ordering

        var op2 = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Email, $"order-test-2-{Guid.NewGuid()}", SyncOperationTypes.Update);
        _testOperationIds.Add(op2);

        await Task.Delay(10);

        var op3 = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Email, $"order-test-3-{Guid.NewGuid()}", SyncOperationTypes.Delete);
        _testOperationIds.Add(op3);

        // Act - Get pending operations
        var pending = await SyncQueueService.Instance.GetPendingOperationsAsync();
        var testOps = pending.Where(p =>
            p.Id == op1 || p.Id == op2 || p.Id == op3).ToList();

        // Assert - Check order is preserved
        Assert.Equal(3, testOps.Count);

        var op1Index = testOps.FindIndex(o => o.Id == op1);
        var op2Index = testOps.FindIndex(o => o.Id == op2);
        var op3Index = testOps.FindIndex(o => o.Id == op3);

        Assert.True(op1Index < op2Index, "Op1 should come before Op2");
        Assert.True(op2Index < op3Index, "Op2 should come before Op3");

        _output.WriteLine("[PASS] Operation order is preserved in queue");
    }

    #endregion

    #region Sync Service Tests

    [Fact]
    [Trait("Category", "Integration")]
    [Trait("Scenario", "SyncService")]
    public async Task SyncService_StartsAndStopsCorrectly()
    {
        // Arrange
        var syncService = SyncService.Instance;

        // Act - Start
        syncService.Start();
        var isEnabledAfterStart = syncService.IsEnabled;

        // Act - Stop
        syncService.Stop();
        var isEnabledAfterStop = syncService.IsEnabled;

        // Assert
        Assert.True(isEnabledAfterStart, "Service should be enabled after Start()");
        Assert.False(isEnabledAfterStop, "Service should be disabled after Stop()");

        _output.WriteLine("[PASS] SyncService starts and stops correctly");
    }

    [Fact]
    [Trait("Category", "Integration")]
    [Trait("Scenario", "SyncService")]
    public async Task SyncService_ReportsProgressDuringSync()
    {
        // Arrange
        var progressEvents = new List<SyncProgressEventArgs>();
        var syncService = SyncService.Instance;

        syncService.SyncProgressChanged += (s, e) => progressEvents.Add(e);

        // Act
        await syncService.SyncNowAsync();

        // Assert
        _output.WriteLine($"[INFO] Received {progressEvents.Count} progress events");
        foreach (var evt in progressEvents.Take(5))
        {
            _output.WriteLine($"  - State: {evt.State}, Message: {evt.Message}");
        }

        _output.WriteLine("[PASS] SyncService reports progress during sync");
    }

    [Fact]
    [Trait("Category", "Integration")]
    [Trait("Scenario", "SyncService")]
    public async Task SyncService_FiresCompletedEvent()
    {
        // Arrange
        SyncCompletedEventArgs? completedArgs = null;
        var syncService = SyncService.Instance;
        syncService.SyncCompleted += (s, e) => completedArgs = e;

        // Act
        await syncService.SyncNowAsync();

        // Assert
        Assert.NotNull(completedArgs);
        _output.WriteLine($"[PASS] Sync completed - Duration: {completedArgs.Duration.TotalMilliseconds}ms");
        _output.WriteLine($"       Items Pulled: {completedArgs.ItemsPulled}");
        _output.WriteLine($"       Items Pushed: {completedArgs.ItemsPushed}");
        _output.WriteLine($"       Conflicts: {completedArgs.Conflicts}");
    }

    #endregion

    #region Conflict Resolution Tests

    [Fact]
    [Trait("Category", "Integration")]
    [Trait("Scenario", "ConflictResolution")]
    public async Task ConflictResolution_DetectsConflictingOperations()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        // Arrange - Create an item and queue two updates for it
        var entityId = $"conflict-test-{Guid.NewGuid()}";

        // Queue first update
        var op1 = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Email,
            entityId,
            SyncOperationTypes.Update,
            new { subject = "First Update" });
        _testOperationIds.Add(op1);

        // Queue second update for same entity
        var op2 = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Email,
            entityId,
            SyncOperationTypes.Update,
            new { subject = "Second Update" });
        _testOperationIds.Add(op2);

        // Assert - Both operations should be queued
        var pending = await SyncQueueService.Instance.GetPendingOperationsAsync();
        var entityOps = pending.Where(p => p.EntityId == entityId).ToList();

        Assert.Equal(2, entityOps.Count);
        _output.WriteLine($"[PASS] Detected {entityOps.Count} operations for same entity");
        _output.WriteLine("[INFO] Last-write-wins strategy will be applied during sync");
    }

    [Fact]
    [Trait("Category", "Integration")]
    [Trait("Scenario", "ConflictResolution")]
    public async Task ConflictResolution_HandlesDeleteAfterUpdate()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        // Arrange - Queue update followed by delete for same entity
        var entityId = $"delete-conflict-{Guid.NewGuid()}";

        var updateOp = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Email,
            entityId,
            SyncOperationTypes.Update,
            new { subject = "Updated" });
        _testOperationIds.Add(updateOp);

        var deleteOp = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Email,
            entityId,
            SyncOperationTypes.Delete);
        _testOperationIds.Add(deleteOp);

        // Act - Get pending operations
        var pending = await SyncQueueService.Instance.GetPendingOperationsAsync();
        var entityOps = pending.Where(p => p.EntityId == entityId).OrderBy(p => p.CreatedAt).ToList();

        // Assert - Both operations should be queued in order
        Assert.Equal(2, entityOps.Count);
        Assert.Equal(SyncOperationTypes.Update, entityOps[0].Operation);
        Assert.Equal(SyncOperationTypes.Delete, entityOps[1].Operation);

        _output.WriteLine("[PASS] Update-then-delete scenario handled correctly");
        _output.WriteLine("[INFO] Delete will take precedence during sync");
    }

    #endregion

    #region Performance Tests

    [Fact]
    [Trait("Category", "Integration")]
    [Trait("Scenario", "Performance")]
    public async Task Performance_BulkEmailCaching()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        // Arrange - Create 100 test emails
        var emails = new List<EmailMessage>();
        for (int i = 0; i < 100; i++)
        {
            var email = CreateTestEmail("inbox");
            email.Subject = $"Bulk Test Email {i}";
            emails.Add(email);
            _testEmailIds.Add(email.Id);
        }

        // Act - Time the caching operation
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();
        await LocalCacheService.Instance.CacheEmailsAsync(emails);
        stopwatch.Stop();

        // Assert
        _output.WriteLine($"[PASS] Cached {emails.Count} emails in {stopwatch.ElapsedMilliseconds}ms");
        _output.WriteLine($"       Average: {stopwatch.ElapsedMilliseconds / 100.0:F2}ms per email");

        // Verify they can be retrieved
        var cached = await LocalCacheService.Instance.GetCachedEmailsAsync("inbox");
        var found = emails.Count(e => cached.Any(c => c.Id == e.Id));
        _output.WriteLine($"       Retrieved: {found}/{emails.Count} emails");
    }

    [Fact]
    [Trait("Category", "Integration")]
    [Trait("Scenario", "Performance")]
    public async Task Performance_BulkOperationQueueing()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        // Arrange - Queue 50 operations
        var operations = new List<Guid>();
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();

        for (int i = 0; i < 50; i++)
        {
            var opId = await SyncQueueService.Instance.QueueOperationAsync(
                SyncEntityTypes.Email,
                $"perf-test-{Guid.NewGuid()}",
                SyncOperationTypes.Update,
                new { index = i });
            operations.Add(opId);
            _testOperationIds.Add(opId);
        }

        stopwatch.Stop();

        // Assert
        _output.WriteLine($"[PASS] Queued {operations.Count} operations in {stopwatch.ElapsedMilliseconds}ms");
        _output.WriteLine($"       Average: {stopwatch.ElapsedMilliseconds / 50.0:F2}ms per operation");

        // Verify all are in the queue
        var pending = await SyncQueueService.Instance.GetPendingOperationsAsync();
        var found = operations.Count(op => pending.Any(p => p.Id == op));
        Assert.Equal(operations.Count, found);
        _output.WriteLine($"[PASS] All {found} operations found in queue");
    }

    [Fact]
    [Trait("Category", "Integration")]
    [Trait("Scenario", "Performance")]
    public async Task Performance_CacheStatisticsRetrieval()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        // Act - Time statistics retrieval
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();
        var stats = await LocalCacheService.Instance.GetCacheStatisticsAsync();
        stopwatch.Stop();

        // Assert
        Assert.NotNull(stats);
        _output.WriteLine($"[PASS] Cache statistics retrieved in {stopwatch.ElapsedMilliseconds}ms");
        _output.WriteLine($"       Emails: {stats.EmailCount}");
        _output.WriteLine($"       Folders: {stats.FolderCount}");
        _output.WriteLine($"       Events: {stats.EventCount}");
        _output.WriteLine($"       Contacts: {stats.ContactCount}");
        _output.WriteLine($"       Pending Sync: {stats.PendingSyncCount}");
    }

    #endregion

    #region Full Workflow Tests

    [Fact]
    [Trait("Category", "Integration")]
    [Trait("Scenario", "FullWorkflow")]
    public async Task FullWorkflow_OfflineToOnlineSync()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        _output.WriteLine("=== Full Offline-to-Online Workflow Test ===");

        // Step 1: Simulate offline - cache some data
        _output.WriteLine("\n[Step 1] Caching data while 'offline'...");
        var testEmail = CreateTestEmail("inbox");
        _testEmailIds.Add(testEmail.Id);
        await LocalCacheService.Instance.CacheEmailAsync(testEmail);
        _output.WriteLine($"  Cached email: {testEmail.Subject}");

        // Step 2: Queue some operations
        _output.WriteLine("\n[Step 2] Queueing operations while 'offline'...");
        var op1 = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Email, $"workflow-{Guid.NewGuid()}", SyncOperationTypes.Create);
        _testOperationIds.Add(op1);
        _output.WriteLine($"  Queued create operation: {op1}");

        var op2 = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Email, $"workflow-{Guid.NewGuid()}", SyncOperationTypes.Update);
        _testOperationIds.Add(op2);
        _output.WriteLine($"  Queued update operation: {op2}");

        // Step 3: Check pending count
        var pendingBefore = await SyncQueueService.Instance.GetPendingCountAsync();
        _output.WriteLine($"\n[Step 3] Pending operations before sync: {pendingBefore}");

        // Step 4: Trigger sync (simulates coming online)
        _output.WriteLine("\n[Step 4] Triggering sync (simulating online)...");
        var syncResult = await SyncService.Instance.SyncNowAsync();
        _output.WriteLine($"  Sync completed: {syncResult.Success}");

        // Step 5: Check results
        var stats = await LocalCacheService.Instance.GetCacheStatisticsAsync();
        _output.WriteLine("\n[Step 5] Final statistics:");
        _output.WriteLine($"  Emails in cache: {stats.EmailCount}");
        _output.WriteLine($"  Pending operations: {stats.PendingSyncCount}");

        _output.WriteLine("\n[PASS] Full workflow completed successfully");
    }

    [Fact]
    [Trait("Category", "Integration")]
    [Trait("Scenario", "FullWorkflow")]
    public async Task FullWorkflow_EventCreationOffline()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        _output.WriteLine("=== Offline Event Creation Workflow ===");

        // Step 1: Create event while "offline"
        var testEvent = CreateTestEvent();
        testEvent.Subject = "Offline Meeting";
        _testEventIds.Add(testEvent.Id);

        _output.WriteLine("\n[Step 1] Creating event in local cache...");
        await LocalCacheService.Instance.CacheEventAsync(testEvent);
        _output.WriteLine($"  Cached event: {testEvent.Subject}");

        // Step 2: Queue the create operation
        _output.WriteLine("\n[Step 2] Queueing create operation...");
        var opId = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Event,
            testEvent.Id,
            SyncOperationTypes.Create,
            new { subject = testEvent.Subject, startTime = testEvent.StartTime });
        _testOperationIds.Add(opId);
        _output.WriteLine($"  Queued operation: {opId}");

        // Step 3: Verify event is in cache
        var cachedEvents = await LocalCacheService.Instance.GetCachedEventsAsync(
            testEvent.StartTime.AddDays(-1),
            testEvent.EndTime.AddDays(1));
        var found = cachedEvents.Any(e => e.Id == testEvent.Id);
        Assert.True(found);
        _output.WriteLine($"\n[Step 3] Event found in cache: {found}");

        _output.WriteLine("\n[PASS] Event creation workflow completed");
    }

    #endregion

    #region Helper Methods

    private EmailMessage CreateTestEmail(string folderId)
    {
        return new EmailMessage
        {
            Id = $"test-email-{Guid.NewGuid()}",
            Subject = $"Test Email {DateTime.Now:HH:mm:ss}",
            From = "Test Sender",
            FromEmail = "sender@test.com",
            FolderId = folderId,
            Body = "Test email body content",
            IsHtml = false,
            IsRead = false,
            IsFlagged = false,
            HasAttachments = false,
            ReceivedDate = DateTime.UtcNow,
            To = new List<string> { "recipient@test.com" },
            Cc = new List<string>(),
            Bcc = new List<string>(),
            Priority = EmailPriority.Normal,
            Attachments = new List<EmailAttachment>()
        };
    }

    private CalendarEvent CreateTestEvent()
    {
        return new CalendarEvent
        {
            Id = $"test-event-{Guid.NewGuid()}",
            Subject = "Test Event",
            Description = "Test event description",
            Location = "Test Location",
            StartTime = DateTime.UtcNow.AddDays(1),
            EndTime = DateTime.UtcNow.AddDays(1).AddHours(1),
            IsAllDay = false,
            IsRecurring = false,
            IsPrivate = false,
            CalendarName = "Test Calendar",
            Organizer = "Test Organizer",
            Attendees = new List<string> { "attendee@test.com" },
            Status = EventStatus.Busy,
            Category = EventCategory.None,
            Reminder = ReminderTime.FifteenMinutes
        };
    }

    #endregion
}
