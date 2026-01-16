using JubileeOutlook.Models;
using JubileeOutlook.Services;
using Xunit;
using Xunit.Abstractions;

namespace JubileeOutlook.Tests.Services;

/// <summary>
/// Unit tests for LocalCacheService
/// Tests email, folder, event, and contact caching operations
/// </summary>
public class LocalCacheServiceTests : IAsyncLifetime
{
    private readonly ITestOutputHelper _output;
    private LocalCacheService _cacheService = null!;
    private bool _isInitialized;

    // Track test data for cleanup
    private readonly List<string> _testEmailIds = new();
    private readonly List<string> _testFolderIds = new();
    private readonly List<string> _testEventIds = new();
    private readonly List<string> _testContactIds = new();

    public LocalCacheServiceTests(ITestOutputHelper output)
    {
        _output = output;
    }

    public async Task InitializeAsync()
    {
        _cacheService = LocalCacheService.Instance;
        _isInitialized = await _cacheService.InitializeDatabaseAsync();

        if (!_isInitialized)
        {
            _output.WriteLine("[WARNING] LocalCacheService could not initialize. Database may not be available.");
        }
        else
        {
            _output.WriteLine("[INFO] LocalCacheService initialized successfully");
        }
    }

    public async Task DisposeAsync()
    {
        // Clean up test data
        if (_isInitialized)
        {
            foreach (var id in _testEmailIds)
            {
                try { await _cacheService.MarkEmailDeletedAsync(id); } catch { }
            }
            foreach (var id in _testEventIds)
            {
                try { await _cacheService.MarkEventDeletedAsync(id); } catch { }
            }
        }

        await Task.CompletedTask;
    }

    #region Email Caching Tests

    [Fact]
    [Trait("Category", "EmailCaching")]
    public async Task CacheEmailAsync_WithValidEmail_StoresSuccessfully()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Database not initialized");
            return;
        }

        // Arrange
        var testEmail = CreateTestEmail();
        _testEmailIds.Add(testEmail.Id);

        // Act
        await _cacheService.CacheEmailAsync(testEmail);

        // Assert
        var cached = await _cacheService.GetCachedEmailByIdAsync(testEmail.Id);
        Assert.NotNull(cached);
        Assert.Equal(testEmail.Id, cached.Id);
        Assert.Equal(testEmail.Subject, cached.Subject);
        Assert.Equal(testEmail.From, cached.From);
        Assert.Equal(testEmail.FromEmail, cached.FromEmail);

        _output.WriteLine($"[PASS] Email cached successfully: {testEmail.Subject}");
    }

    [Fact]
    [Trait("Category", "EmailCaching")]
    public async Task CacheEmailAsync_WithUpdate_UpdatesExistingEmail()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Database not initialized");
            return;
        }

        // Arrange
        var testEmail = CreateTestEmail();
        _testEmailIds.Add(testEmail.Id);
        await _cacheService.CacheEmailAsync(testEmail);

        // Act - Update the email
        testEmail.Subject = "Updated Subject";
        testEmail.IsRead = true;
        await _cacheService.CacheEmailAsync(testEmail);

        // Assert
        var cached = await _cacheService.GetCachedEmailByIdAsync(testEmail.Id);
        Assert.NotNull(cached);
        Assert.Equal("Updated Subject", cached.Subject);
        Assert.True(cached.IsRead);

        _output.WriteLine("[PASS] Email update (upsert) works correctly");
    }

    [Fact]
    [Trait("Category", "EmailCaching")]
    public async Task GetCachedEmailsAsync_ByFolder_ReturnsCorrectEmails()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Database not initialized");
            return;
        }

        // Arrange
        var folderId = $"test-folder-{Guid.NewGuid()}";
        var email1 = CreateTestEmail();
        email1.FolderId = folderId;
        var email2 = CreateTestEmail();
        email2.FolderId = folderId;
        var email3 = CreateTestEmail();
        email3.FolderId = "other-folder";

        _testEmailIds.Add(email1.Id);
        _testEmailIds.Add(email2.Id);
        _testEmailIds.Add(email3.Id);

        await _cacheService.CacheEmailAsync(email1);
        await _cacheService.CacheEmailAsync(email2);
        await _cacheService.CacheEmailAsync(email3);

        // Act
        var emails = await _cacheService.GetCachedEmailsAsync(folderId);

        // Assert
        Assert.NotNull(emails);
        Assert.Equal(2, emails.Count);
        Assert.All(emails, e => Assert.Equal(folderId, e.FolderId));

        _output.WriteLine($"[PASS] Retrieved {emails.Count} emails for folder {folderId}");
    }

    [Fact]
    [Trait("Category", "EmailCaching")]
    public async Task MarkEmailDeletedAsync_SoftDeletesEmail()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Database not initialized");
            return;
        }

        // Arrange
        var testEmail = CreateTestEmail();
        _testEmailIds.Add(testEmail.Id);
        await _cacheService.CacheEmailAsync(testEmail);

        // Act
        await _cacheService.MarkEmailDeletedAsync(testEmail.Id);

        // Assert - Should not be returned by GetCachedEmailByIdAsync (soft deleted)
        var cached = await _cacheService.GetCachedEmailByIdAsync(testEmail.Id);
        Assert.Null(cached);

        _output.WriteLine("[PASS] Email soft delete works correctly");
    }

    [Fact]
    [Trait("Category", "EmailCaching")]
    public async Task UpdateEmailStatusAsync_UpdatesReadAndFlagged()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Database not initialized");
            return;
        }

        // Arrange
        var testEmail = CreateTestEmail();
        testEmail.IsRead = false;
        testEmail.IsFlagged = false;
        _testEmailIds.Add(testEmail.Id);
        await _cacheService.CacheEmailAsync(testEmail);

        // Act
        await _cacheService.UpdateEmailStatusAsync(testEmail.Id, isRead: true, isFlagged: true);

        // Assert
        var cached = await _cacheService.GetCachedEmailByIdAsync(testEmail.Id);
        Assert.NotNull(cached);
        Assert.True(cached.IsRead);
        Assert.True(cached.IsFlagged);

        _output.WriteLine("[PASS] Email status update works correctly");
    }

    [Fact]
    [Trait("Category", "EmailCaching")]
    public async Task SearchCachedEmailsAsync_FindsMatchingEmails()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Database not initialized");
            return;
        }

        // Arrange
        var uniqueKeyword = $"UniqueSearchTerm{Guid.NewGuid():N}";
        var testEmail = CreateTestEmail();
        testEmail.Subject = $"Test {uniqueKeyword} Subject";
        _testEmailIds.Add(testEmail.Id);
        await _cacheService.CacheEmailAsync(testEmail);

        // Act
        var results = await _cacheService.SearchCachedEmailsAsync(uniqueKeyword);

        // Assert
        Assert.NotEmpty(results);
        Assert.Contains(results, e => e.Id == testEmail.Id);

        _output.WriteLine($"[PASS] Search found {results.Count} emails matching '{uniqueKeyword}'");
    }

    [Fact]
    [Trait("Category", "EmailCaching")]
    public async Task CacheEmailsAsync_BatchCachesMultipleEmails()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Database not initialized");
            return;
        }

        // Arrange
        var emails = new List<EmailMessage>
        {
            CreateTestEmail(),
            CreateTestEmail(),
            CreateTestEmail()
        };
        foreach (var email in emails) _testEmailIds.Add(email.Id);

        // Act
        await _cacheService.CacheEmailsAsync(emails);

        // Assert
        foreach (var email in emails)
        {
            var cached = await _cacheService.GetCachedEmailByIdAsync(email.Id);
            Assert.NotNull(cached);
        }

        _output.WriteLine($"[PASS] Batch cached {emails.Count} emails successfully");
    }

    #endregion

    #region Folder Caching Tests

    [Fact]
    [Trait("Category", "FolderCaching")]
    public async Task CacheFolderAsync_StoresFolderSuccessfully()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Database not initialized");
            return;
        }

        // Arrange
        var testFolder = CreateTestFolder();
        _testFolderIds.Add(testFolder.Id);

        // Act
        await _cacheService.CacheFolderAsync(testFolder);

        // Assert
        var folders = await _cacheService.GetCachedFoldersAsync();
        var cached = folders.FirstOrDefault(f => f.Id == testFolder.Id);

        Assert.NotNull(cached);
        Assert.Equal(testFolder.Name, cached.Name);
        Assert.Equal(testFolder.Type, cached.Type);

        _output.WriteLine($"[PASS] Folder cached successfully: {testFolder.Name}");
    }

    [Fact]
    [Trait("Category", "FolderCaching")]
    public async Task CacheFoldersAsync_BatchCachesMultipleFolders()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Database not initialized");
            return;
        }

        // Arrange
        var folders = new List<MailFolder>
        {
            CreateTestFolder(FolderType.Inbox),
            CreateTestFolder(FolderType.Sent),
            CreateTestFolder(FolderType.Drafts)
        };
        foreach (var folder in folders) _testFolderIds.Add(folder.Id);

        // Act
        await _cacheService.CacheFoldersAsync(folders);

        // Assert
        var cachedFolders = await _cacheService.GetCachedFoldersAsync();
        foreach (var folder in folders)
        {
            Assert.Contains(cachedFolders, f => f.Id == folder.Id);
        }

        _output.WriteLine($"[PASS] Batch cached {folders.Count} folders");
    }

    [Fact]
    [Trait("Category", "FolderCaching")]
    public async Task GetCachedFoldersAsync_ReturnsAllFolders()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Database not initialized");
            return;
        }

        // Act
        var folders = await _cacheService.GetCachedFoldersAsync();

        // Assert
        Assert.NotNull(folders);
        _output.WriteLine($"[PASS] Retrieved {folders.Count} cached folders");
    }

    #endregion

    #region Event Caching Tests

    [Fact]
    [Trait("Category", "EventCaching")]
    public async Task CacheEventAsync_StoresEventSuccessfully()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Database not initialized");
            return;
        }

        // Arrange
        var testEvent = CreateTestEvent();
        _testEventIds.Add(testEvent.Id);

        // Act
        await _cacheService.CacheEventAsync(testEvent);

        // Assert
        var events = await _cacheService.GetCachedEventsAsync(
            testEvent.StartTime.AddDays(-1),
            testEvent.EndTime.AddDays(1));

        var cached = events.FirstOrDefault(e => e.Id == testEvent.Id);
        Assert.NotNull(cached);
        Assert.Equal(testEvent.Subject, cached.Subject);
        Assert.Equal(testEvent.Location, cached.Location);

        _output.WriteLine($"[PASS] Event cached successfully: {testEvent.Subject}");
    }

    [Fact]
    [Trait("Category", "EventCaching")]
    public async Task GetCachedEventsAsync_ReturnsEventsInDateRange()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Database not initialized");
            return;
        }

        // Arrange
        var startDate = DateTime.UtcNow.AddDays(1);
        var endDate = DateTime.UtcNow.AddDays(2);

        var event1 = CreateTestEvent();
        event1.StartTime = startDate.AddHours(2);
        event1.EndTime = startDate.AddHours(3);
        _testEventIds.Add(event1.Id);

        var event2 = CreateTestEvent();
        event2.StartTime = DateTime.UtcNow.AddDays(10);
        event2.EndTime = DateTime.UtcNow.AddDays(10).AddHours(1);
        _testEventIds.Add(event2.Id);

        await _cacheService.CacheEventAsync(event1);
        await _cacheService.CacheEventAsync(event2);

        // Act
        var events = await _cacheService.GetCachedEventsAsync(startDate, endDate);

        // Assert
        Assert.Contains(events, e => e.Id == event1.Id);
        Assert.DoesNotContain(events, e => e.Id == event2.Id);

        _output.WriteLine($"[PASS] Retrieved {events.Count} events in date range");
    }

    [Fact]
    [Trait("Category", "EventCaching")]
    public async Task MarkEventDeletedAsync_SoftDeletesEvent()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Database not initialized");
            return;
        }

        // Arrange
        var testEvent = CreateTestEvent();
        _testEventIds.Add(testEvent.Id);
        await _cacheService.CacheEventAsync(testEvent);

        // Act
        await _cacheService.MarkEventDeletedAsync(testEvent.Id);

        // Assert
        var events = await _cacheService.GetCachedEventsAsync(
            testEvent.StartTime.AddDays(-1),
            testEvent.EndTime.AddDays(1));
        Assert.DoesNotContain(events, e => e.Id == testEvent.Id);

        _output.WriteLine("[PASS] Event soft delete works correctly");
    }

    [Fact]
    [Trait("Category", "EventCaching")]
    public async Task CacheEventAsync_WithRecurrence_StoresRecurrencePattern()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Database not initialized");
            return;
        }

        // Arrange
        var testEvent = CreateTestEvent();
        testEvent.IsRecurring = true;
        testEvent.Recurrence = new RecurrencePattern
        {
            Type = RecurrenceType.Weekly,
            Interval = 1,
            DaysOfWeek = new List<DayOfWeek> { DayOfWeek.Monday, DayOfWeek.Wednesday }
        };
        _testEventIds.Add(testEvent.Id);

        // Act
        await _cacheService.CacheEventAsync(testEvent);

        // Assert
        var events = await _cacheService.GetCachedEventsAsync(
            testEvent.StartTime.AddDays(-1),
            testEvent.EndTime.AddDays(1));
        var cached = events.FirstOrDefault(e => e.Id == testEvent.Id);

        Assert.NotNull(cached);
        Assert.True(cached.IsRecurring);

        _output.WriteLine("[PASS] Recurring event cached successfully");
    }

    #endregion

    #region Contact Caching Tests

    [Fact]
    [Trait("Category", "ContactCaching")]
    public async Task CacheContactAsync_StoresContactSuccessfully()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Database not initialized");
            return;
        }

        // Arrange
        var testContact = CreateTestContact();
        _testContactIds.Add(testContact.Id);

        // Act
        await _cacheService.CacheContactAsync(testContact);

        // Assert
        var contacts = await _cacheService.GetCachedContactsAsync();
        var cached = contacts.FirstOrDefault(c => c.Id == testContact.Id);

        Assert.NotNull(cached);
        Assert.Equal(testContact.DisplayName, cached.DisplayName);
        Assert.Equal(testContact.FirstName, cached.FirstName);
        Assert.Equal(testContact.LastName, cached.LastName);

        _output.WriteLine($"[PASS] Contact cached successfully: {testContact.DisplayName}");
    }

    [Fact]
    [Trait("Category", "ContactCaching")]
    public async Task SearchContactsAsync_FindsMatchingContacts()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Database not initialized");
            return;
        }

        // Arrange
        var uniqueName = $"UniqueContact{Guid.NewGuid():N}";
        var testContact = CreateTestContact();
        testContact.FirstName = uniqueName;
        testContact.DisplayName = $"{uniqueName} Test";
        _testContactIds.Add(testContact.Id);

        await _cacheService.CacheContactAsync(testContact);

        // Act
        var results = await _cacheService.SearchContactsAsync(uniqueName);

        // Assert
        Assert.NotEmpty(results);
        Assert.Contains(results, c => c.Id == testContact.Id);

        _output.WriteLine($"[PASS] Found {results.Count} contacts matching '{uniqueName}'");
    }

    [Fact]
    [Trait("Category", "ContactCaching")]
    public async Task CacheContactAsync_WithEmailAndPhone_StoresCorrectly()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Database not initialized");
            return;
        }

        // Arrange
        var testContact = CreateTestContact();
        testContact.EmailAddresses = new List<string> { "test1@example.com", "test2@example.com" };
        testContact.PhoneNumbers = new List<string> { "+1-555-1234", "+1-555-5678" };
        _testContactIds.Add(testContact.Id);

        // Act
        await _cacheService.CacheContactAsync(testContact);

        // Assert
        var contacts = await _cacheService.GetCachedContactsAsync();
        var cached = contacts.FirstOrDefault(c => c.Id == testContact.Id);

        Assert.NotNull(cached);
        Assert.Equal(2, cached.EmailAddresses.Count);
        Assert.Equal(2, cached.PhoneNumbers.Count);
        Assert.Contains("test1@example.com", cached.EmailAddresses);
        Assert.Contains("+1-555-1234", cached.PhoneNumbers);

        _output.WriteLine("[PASS] Contact with multiple emails/phones cached correctly");
    }

    #endregion

    #region Cache Management Tests

    [Fact]
    [Trait("Category", "CacheManagement")]
    public async Task GetCacheStatisticsAsync_ReturnsCounts()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("[SKIP] Database not initialized");
            return;
        }

        // Act
        var stats = await _cacheService.GetCacheStatisticsAsync();

        // Assert
        Assert.NotNull(stats);
        Assert.True(stats.EmailCount >= 0);
        Assert.True(stats.FolderCount >= 0);
        Assert.True(stats.EventCount >= 0);
        Assert.True(stats.ContactCount >= 0);

        _output.WriteLine($"[PASS] Cache statistics retrieved:");
        _output.WriteLine($"  Emails: {stats.EmailCount}");
        _output.WriteLine($"  Folders: {stats.FolderCount}");
        _output.WriteLine($"  Events: {stats.EventCount}");
        _output.WriteLine($"  Contacts: {stats.ContactCount}");
        _output.WriteLine($"  Pending Sync: {stats.PendingSyncCount}");
    }

    [Fact]
    [Trait("Category", "CacheManagement")]
    public async Task TestConnectionAsync_ReturnsTrue_WhenDatabaseAvailable()
    {
        // Act
        var result = await _cacheService.TestConnectionAsync();

        // Assert
        if (_isInitialized)
        {
            Assert.True(result);
            _output.WriteLine("[PASS] Database connection test passed");
        }
        else
        {
            _output.WriteLine("[INFO] Database connection test skipped (not initialized)");
        }
    }

    #endregion

    #region Helper Methods

    private EmailMessage CreateTestEmail()
    {
        return new EmailMessage
        {
            Id = $"test-email-{Guid.NewGuid()}",
            Subject = "Test Email Subject",
            From = "Test Sender",
            FromEmail = "sender@test.com",
            FolderId = "inbox",
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

    private MailFolder CreateTestFolder(FolderType type = FolderType.Custom)
    {
        return new MailFolder
        {
            Id = $"test-folder-{Guid.NewGuid()}",
            Name = $"Test Folder {type}",
            Type = type,
            UnreadCount = 5,
            TotalCount = 10,
            ParentFolderId = null
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

    private Contact CreateTestContact()
    {
        return new Contact
        {
            Id = $"test-contact-{Guid.NewGuid()}",
            DisplayName = "Test Contact",
            FirstName = "Test",
            LastName = "Contact",
            EmailAddresses = new List<string> { "contact@test.com" },
            PhoneNumbers = new List<string> { "+1-555-0000" },
            Company = "Test Company",
            JobTitle = "Test Title",
            Department = "Test Dept",
            Notes = "Test notes"
        };
    }

    #endregion
}
