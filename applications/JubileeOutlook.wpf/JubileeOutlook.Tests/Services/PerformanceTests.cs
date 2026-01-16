using System.Diagnostics;
using JubileeOutlook.Models;
using JubileeOutlook.Services;
using Xunit;
using Xunit.Abstractions;

namespace JubileeOutlook.Tests.Services;

/// <summary>
/// Performance tests for cache operations and sync functionality
/// Measures load times, search performance, memory usage, and queue processing
/// </summary>
public class PerformanceTests : IAsyncLifetime
{
    private readonly ITestOutputHelper _output;
    private bool _isInitialized;
    private readonly List<string> _testEmailIds = new();
    private readonly List<string> _testEventIds = new();
    private readonly List<string> _testContactIds = new();
    private readonly List<Guid> _testOperationIds = new();

    // Performance thresholds (in milliseconds)
    private const int MaxSingleEmailCacheMs = 50;
    private const int MaxBulkEmailCacheMs = 5000; // For 100 emails
    private const int MaxEmailRetrievalMs = 100;
    private const int MaxSearchMs = 500;
    private const int MaxQueueOperationMs = 50;

    public PerformanceTests(ITestOutputHelper output)
    {
        _output = output;
    }

    public async Task InitializeAsync()
    {
        try
        {
            var cacheInit = await LocalCacheService.Instance.InitializeDatabaseAsync();
            var queueInit = await SyncQueueService.Instance.InitializeAsync();
            _isInitialized = cacheInit && queueInit;

            if (!_isInitialized)
            {
                _output.WriteLine("[WARN] Services not fully initialized - some tests may be skipped");
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

    #region Email Cache Performance Tests

    [Fact]
    [Trait("Category", "Performance")]
    [Trait("Scenario", "EmailCache")]
    public async Task Performance_SingleEmailCache()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        var email = CreateTestEmail();
        _testEmailIds.Add(email.Id);

        var sw = Stopwatch.StartNew();
        await LocalCacheService.Instance.CacheEmailAsync(email);
        sw.Stop();

        _output.WriteLine($"[RESULT] Single email cache time: {sw.ElapsedMilliseconds}ms");
        Assert.True(sw.ElapsedMilliseconds < MaxSingleEmailCacheMs,
            $"Single email cache took {sw.ElapsedMilliseconds}ms, expected < {MaxSingleEmailCacheMs}ms");
    }

    [Fact]
    [Trait("Category", "Performance")]
    [Trait("Scenario", "EmailCache")]
    public async Task Performance_BulkEmailCache_100()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        var emails = new List<EmailMessage>();
        for (int i = 0; i < 100; i++)
        {
            var email = CreateTestEmail();
            email.Subject = $"Bulk Test Email {i}";
            emails.Add(email);
            _testEmailIds.Add(email.Id);
        }

        var sw = Stopwatch.StartNew();
        await LocalCacheService.Instance.CacheEmailsAsync(emails);
        sw.Stop();

        var avgPerEmail = sw.ElapsedMilliseconds / 100.0;
        _output.WriteLine($"[RESULT] Bulk cache 100 emails: {sw.ElapsedMilliseconds}ms");
        _output.WriteLine($"[RESULT] Average per email: {avgPerEmail:F2}ms");

        Assert.True(sw.ElapsedMilliseconds < MaxBulkEmailCacheMs,
            $"Bulk cache took {sw.ElapsedMilliseconds}ms, expected < {MaxBulkEmailCacheMs}ms");
    }

    [Fact]
    [Trait("Category", "Performance")]
    [Trait("Scenario", "EmailCache")]
    public async Task Performance_BulkEmailCache_500()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        var emails = new List<EmailMessage>();
        for (int i = 0; i < 500; i++)
        {
            var email = CreateTestEmail();
            email.Subject = $"Large Batch Email {i}";
            emails.Add(email);
            _testEmailIds.Add(email.Id);
        }

        var sw = Stopwatch.StartNew();
        await LocalCacheService.Instance.CacheEmailsAsync(emails);
        sw.Stop();

        var avgPerEmail = sw.ElapsedMilliseconds / 500.0;
        _output.WriteLine($"[RESULT] Bulk cache 500 emails: {sw.ElapsedMilliseconds}ms");
        _output.WriteLine($"[RESULT] Average per email: {avgPerEmail:F2}ms");
        _output.WriteLine($"[RESULT] Throughput: {500000.0 / sw.ElapsedMilliseconds:F1} emails/sec");
    }

    [Fact]
    [Trait("Category", "Performance")]
    [Trait("Scenario", "EmailCache")]
    public async Task Performance_EmailRetrieval()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        // Pre-populate with test emails
        var folderId = $"perf-folder-{Guid.NewGuid()}";
        for (int i = 0; i < 50; i++)
        {
            var email = CreateTestEmail();
            email.FolderId = folderId;
            await LocalCacheService.Instance.CacheEmailAsync(email);
            _testEmailIds.Add(email.Id);
        }

        // Measure retrieval time
        var sw = Stopwatch.StartNew();
        var emails = await LocalCacheService.Instance.GetCachedEmailsAsync(folderId);
        sw.Stop();

        _output.WriteLine($"[RESULT] Retrieved {emails.Count} emails in {sw.ElapsedMilliseconds}ms");
        Assert.True(sw.ElapsedMilliseconds < MaxEmailRetrievalMs,
            $"Email retrieval took {sw.ElapsedMilliseconds}ms, expected < {MaxEmailRetrievalMs}ms");
    }

    [Fact]
    [Trait("Category", "Performance")]
    [Trait("Scenario", "EmailCache")]
    public async Task Performance_EmailRetrievalById()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        // Create and cache an email
        var email = CreateTestEmail();
        _testEmailIds.Add(email.Id);
        await LocalCacheService.Instance.CacheEmailAsync(email);

        // Measure retrieval time
        var sw = Stopwatch.StartNew();
        var retrieved = await LocalCacheService.Instance.GetCachedEmailByIdAsync(email.Id);
        sw.Stop();

        Assert.NotNull(retrieved);
        _output.WriteLine($"[RESULT] Single email retrieval by ID: {sw.ElapsedMilliseconds}ms");
        Assert.True(sw.ElapsedMilliseconds < 150, $"Single email retrieval took {sw.ElapsedMilliseconds}ms");
    }

    #endregion

    #region Search Performance Tests

    [Fact]
    [Trait("Category", "Performance")]
    [Trait("Scenario", "Search")]
    public async Task Performance_EmailSearch()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        // Pre-populate with searchable emails
        var searchTerm = $"SearchTerm{Guid.NewGuid():N}";
        for (int i = 0; i < 50; i++)
        {
            var email = CreateTestEmail();
            if (i % 5 == 0)
            {
                email.Subject = $"Email with {searchTerm} keyword";
            }
            await LocalCacheService.Instance.CacheEmailAsync(email);
            _testEmailIds.Add(email.Id);
        }

        // Measure search time
        var sw = Stopwatch.StartNew();
        var results = await LocalCacheService.Instance.SearchCachedEmailsAsync(searchTerm);
        sw.Stop();

        _output.WriteLine($"[RESULT] Search for '{searchTerm}' found {results.Count} results in {sw.ElapsedMilliseconds}ms");
        Assert.True(sw.ElapsedMilliseconds < MaxSearchMs,
            $"Search took {sw.ElapsedMilliseconds}ms, expected < {MaxSearchMs}ms");
    }

    [Fact]
    [Trait("Category", "Performance")]
    [Trait("Scenario", "Search")]
    public async Task Performance_ContactSearch()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        // Pre-populate with contacts
        for (int i = 0; i < 100; i++)
        {
            var contact = CreateTestContact();
            contact.DisplayName = $"Contact {i}";
            contact.FirstName = $"First{i}";
            contact.LastName = $"Last{i}";
            await LocalCacheService.Instance.CacheContactAsync(contact);
        }

        // Measure search time
        var sw = Stopwatch.StartNew();
        var results = await LocalCacheService.Instance.SearchContactsAsync("Contact");
        sw.Stop();

        _output.WriteLine($"[RESULT] Contact search found {results.Count} results in {sw.ElapsedMilliseconds}ms");
        Assert.True(sw.ElapsedMilliseconds < MaxSearchMs,
            $"Contact search took {sw.ElapsedMilliseconds}ms, expected < {MaxSearchMs}ms");
    }

    #endregion

    #region Event Cache Performance Tests

    [Fact]
    [Trait("Category", "Performance")]
    [Trait("Scenario", "EventCache")]
    public async Task Performance_EventCaching()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        var events = new List<CalendarEvent>();
        for (int i = 0; i < 100; i++)
        {
            var evt = CreateTestEvent();
            evt.Subject = $"Event {i}";
            evt.StartTime = DateTime.UtcNow.AddDays(i);
            evt.EndTime = evt.StartTime.AddHours(1);
            events.Add(evt);
            _testEventIds.Add(evt.Id);
        }

        var sw = Stopwatch.StartNew();
        foreach (var evt in events)
        {
            await LocalCacheService.Instance.CacheEventAsync(evt);
        }
        sw.Stop();

        _output.WriteLine($"[RESULT] Cached 100 events in {sw.ElapsedMilliseconds}ms");
        _output.WriteLine($"[RESULT] Average per event: {sw.ElapsedMilliseconds / 100.0:F2}ms");
    }

    [Fact]
    [Trait("Category", "Performance")]
    [Trait("Scenario", "EventCache")]
    public async Task Performance_EventRetrieval()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        // Pre-populate events
        var startDate = DateTime.UtcNow;
        for (int i = 0; i < 50; i++)
        {
            var evt = CreateTestEvent();
            evt.StartTime = startDate.AddDays(i);
            evt.EndTime = evt.StartTime.AddHours(1);
            await LocalCacheService.Instance.CacheEventAsync(evt);
            _testEventIds.Add(evt.Id);
        }

        // Measure retrieval
        var sw = Stopwatch.StartNew();
        var events = await LocalCacheService.Instance.GetCachedEventsAsync(
            startDate,
            startDate.AddDays(60));
        sw.Stop();

        _output.WriteLine($"[RESULT] Retrieved {events.Count} events in {sw.ElapsedMilliseconds}ms");
        Assert.True(sw.ElapsedMilliseconds < 200,
            $"Event retrieval took {sw.ElapsedMilliseconds}ms, expected < 200ms");
    }

    #endregion

    #region Sync Queue Performance Tests

    [Fact]
    [Trait("Category", "Performance")]
    [Trait("Scenario", "SyncQueue")]
    public async Task Performance_SingleQueueOperation()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        var sw = Stopwatch.StartNew();
        var opId = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Email,
            $"perf-test-{Guid.NewGuid()}",
            SyncOperationTypes.Create);
        sw.Stop();

        _testOperationIds.Add(opId);

        _output.WriteLine($"[RESULT] Single queue operation: {sw.ElapsedMilliseconds}ms");
        Assert.True(sw.ElapsedMilliseconds < MaxQueueOperationMs,
            $"Queue operation took {sw.ElapsedMilliseconds}ms, expected < {MaxQueueOperationMs}ms");
    }

    [Fact]
    [Trait("Category", "Performance")]
    [Trait("Scenario", "SyncQueue")]
    public async Task Performance_BulkQueueOperations()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        var sw = Stopwatch.StartNew();
        for (int i = 0; i < 100; i++)
        {
            var opId = await SyncQueueService.Instance.QueueOperationAsync(
                SyncEntityTypes.Email,
                $"bulk-{Guid.NewGuid()}",
                SyncOperationTypes.Update,
                new { index = i });
            _testOperationIds.Add(opId);
        }
        sw.Stop();

        _output.WriteLine($"[RESULT] Queued 100 operations in {sw.ElapsedMilliseconds}ms");
        _output.WriteLine($"[RESULT] Average per operation: {sw.ElapsedMilliseconds / 100.0:F2}ms");
    }

    [Fact]
    [Trait("Category", "Performance")]
    [Trait("Scenario", "SyncQueue")]
    public async Task Performance_GetPendingOperations()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        // Pre-populate queue
        for (int i = 0; i < 50; i++)
        {
            var opId = await SyncQueueService.Instance.QueueOperationAsync(
                SyncEntityTypes.Email,
                $"pending-{Guid.NewGuid()}",
                SyncOperationTypes.Update);
            _testOperationIds.Add(opId);
        }

        // Measure retrieval
        var sw = Stopwatch.StartNew();
        var pending = await SyncQueueService.Instance.GetPendingOperationsAsync();
        sw.Stop();

        _output.WriteLine($"[RESULT] Retrieved {pending.Count} pending operations in {sw.ElapsedMilliseconds}ms");
        Assert.True(sw.ElapsedMilliseconds < 100,
            $"GetPendingOperations took {sw.ElapsedMilliseconds}ms, expected < 100ms");
    }

    [Fact]
    [Trait("Category", "Performance")]
    [Trait("Scenario", "SyncQueue")]
    public async Task Performance_QueueCountRetrieval()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        var sw = Stopwatch.StartNew();
        var count = await SyncQueueService.Instance.GetPendingCountAsync();
        sw.Stop();

        _output.WriteLine($"[RESULT] Queue count ({count}): {sw.ElapsedMilliseconds}ms");
        Assert.True(sw.ElapsedMilliseconds < 50,
            $"Queue count took {sw.ElapsedMilliseconds}ms, expected < 50ms");
    }

    #endregion

    #region Statistics Performance Tests

    [Fact]
    [Trait("Category", "Performance")]
    [Trait("Scenario", "Statistics")]
    public async Task Performance_GetCacheStatistics()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        var sw = Stopwatch.StartNew();
        var stats = await LocalCacheService.Instance.GetCacheStatisticsAsync();
        sw.Stop();

        _output.WriteLine($"[RESULT] Cache statistics retrieved in {sw.ElapsedMilliseconds}ms");
        _output.WriteLine($"  Emails: {stats.EmailCount}");
        _output.WriteLine($"  Folders: {stats.FolderCount}");
        _output.WriteLine($"  Events: {stats.EventCount}");
        _output.WriteLine($"  Contacts: {stats.ContactCount}");
        _output.WriteLine($"  Pending Sync: {stats.PendingSyncCount}");

        Assert.True(sw.ElapsedMilliseconds < 100,
            $"Statistics retrieval took {sw.ElapsedMilliseconds}ms, expected < 100ms");
    }

    #endregion

    #region Concurrent Operations Tests

    [Fact]
    [Trait("Category", "Performance")]
    [Trait("Scenario", "Concurrent")]
    public async Task Performance_ConcurrentEmailCaching()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        var tasks = new List<Task>();
        var emails = new List<EmailMessage>();

        // Create 50 concurrent cache operations
        for (int i = 0; i < 50; i++)
        {
            var email = CreateTestEmail();
            email.Subject = $"Concurrent Email {i}";
            emails.Add(email);
            _testEmailIds.Add(email.Id);
        }

        var sw = Stopwatch.StartNew();
        foreach (var email in emails)
        {
            tasks.Add(LocalCacheService.Instance.CacheEmailAsync(email));
        }
        await Task.WhenAll(tasks);
        sw.Stop();

        _output.WriteLine($"[RESULT] 50 concurrent cache operations: {sw.ElapsedMilliseconds}ms");
        _output.WriteLine($"[RESULT] Average: {sw.ElapsedMilliseconds / 50.0:F2}ms per operation");
    }

    [Fact]
    [Trait("Category", "Performance")]
    [Trait("Scenario", "Concurrent")]
    public async Task Performance_ConcurrentQueueOperations()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        var tasks = new List<Task<Guid>>();

        var sw = Stopwatch.StartNew();
        for (int i = 0; i < 50; i++)
        {
            var task = SyncQueueService.Instance.QueueOperationAsync(
                SyncEntityTypes.Email,
                $"concurrent-{Guid.NewGuid()}",
                SyncOperationTypes.Update);
            tasks.Add(task);
        }

        var results = await Task.WhenAll(tasks);
        sw.Stop();

        foreach (var id in results)
        {
            _testOperationIds.Add(id);
        }

        _output.WriteLine($"[RESULT] 50 concurrent queue operations: {sw.ElapsedMilliseconds}ms");
        _output.WriteLine($"[RESULT] Average: {sw.ElapsedMilliseconds / 50.0:F2}ms per operation");
    }

    #endregion

    #region Memory Usage Tests

    [Fact]
    [Trait("Category", "Performance")]
    [Trait("Scenario", "Memory")]
    public async Task Performance_LargeDatasetMemory()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Services not initialized");
            return;
        }

        // Force GC to get baseline
        GC.Collect();
        GC.WaitForPendingFinalizers();
        var memoryBefore = GC.GetTotalMemory(true);

        // Cache a large number of emails
        var emails = new List<EmailMessage>();
        for (int i = 0; i < 200; i++)
        {
            var email = CreateTestEmail();
            email.Subject = $"Memory Test Email {i}";
            email.Body = new string('x', 1000); // 1KB body
            emails.Add(email);
            _testEmailIds.Add(email.Id);
        }

        await LocalCacheService.Instance.CacheEmailsAsync(emails);

        // Measure memory after caching
        GC.Collect();
        GC.WaitForPendingFinalizers();
        var memoryAfter = GC.GetTotalMemory(true);

        var memoryUsed = memoryAfter - memoryBefore;
        var memoryPerEmail = memoryUsed / 200.0;

        _output.WriteLine($"[RESULT] Memory before: {memoryBefore / 1024.0:F2} KB");
        _output.WriteLine($"[RESULT] Memory after: {memoryAfter / 1024.0:F2} KB");
        _output.WriteLine($"[RESULT] Memory used: {memoryUsed / 1024.0:F2} KB");
        _output.WriteLine($"[RESULT] Per email: {memoryPerEmail:F2} bytes");

        // Note: This is just informational - actual memory is in the database
        _output.WriteLine("[INFO] Note: Most data is in PostgreSQL, not in-memory");
    }

    #endregion

    #region Helper Methods

    private EmailMessage CreateTestEmail()
    {
        return new EmailMessage
        {
            Id = $"perf-email-{Guid.NewGuid()}",
            Subject = "Performance Test Email",
            From = "Sender",
            FromEmail = "sender@test.com",
            FolderId = "inbox",
            Body = "Test body content for performance testing.",
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
            Id = $"perf-event-{Guid.NewGuid()}",
            Subject = "Performance Test Event",
            Description = "Test event for performance testing",
            Location = "Test Location",
            StartTime = DateTime.UtcNow.AddDays(1),
            EndTime = DateTime.UtcNow.AddDays(1).AddHours(1),
            IsAllDay = false,
            IsRecurring = false,
            IsPrivate = false,
            CalendarName = "Test Calendar",
            Organizer = "Test Organizer",
            Attendees = new List<string>(),
            Status = EventStatus.Busy,
            Category = EventCategory.None,
            Reminder = ReminderTime.FifteenMinutes
        };
    }

    private Contact CreateTestContact()
    {
        return new Contact
        {
            Id = $"perf-contact-{Guid.NewGuid()}",
            DisplayName = "Test Contact",
            FirstName = "Test",
            LastName = "Contact",
            EmailAddresses = new List<string> { "contact@test.com" },
            PhoneNumbers = new List<string>(),
            Company = "Test Company",
            JobTitle = "Tester"
        };
    }

    #endregion
}
