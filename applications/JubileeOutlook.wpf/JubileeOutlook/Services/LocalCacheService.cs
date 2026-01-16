using System.Text.Json;
using Npgsql;
using JubileeOutlook.Models;

namespace JubileeOutlook.Services;

/// <summary>
/// Service for managing local PostgreSQL cache for offline support
/// Provides caching functionality for emails, folders, events, and contacts
/// </summary>
public class LocalCacheService : IDisposable
{
    private static LocalCacheService? _instance;
    private static readonly object _lock = new();

    private readonly string _connectionString;
    private readonly JsonSerializerOptions _jsonOptions;
    private bool _isInitialized = false;
    private bool _disposed = false;

    /// <summary>
    /// Gets the singleton instance of LocalCacheService
    /// </summary>
    public static LocalCacheService Instance
    {
        get
        {
            if (_instance == null)
            {
                lock (_lock)
                {
                    _instance ??= new LocalCacheService();
                }
            }
            return _instance;
        }
    }

    /// <summary>
    /// Gets whether the cache service is initialized
    /// </summary>
    public bool IsInitialized => _isInitialized;

    private LocalCacheService()
    {
        _connectionString = ConfigurationService.Instance.GetLocalCacheConnectionString();
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false
        };

        System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Created with connection to local PostgreSQL cache");
    }

    #region Initialization

    /// <summary>
    /// Initializes the database connection and verifies schema
    /// </summary>
    public async Task<bool> InitializeDatabaseAsync()
    {
        if (_isInitialized) return true;

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();

            // Verify tables exist
            var tableCount = await GetTableCountAsync(connection);
            if (tableCount < 6)
            {
                System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Warning: Expected 6 tables, found {tableCount}");
                return false;
            }

            _isInitialized = true;
            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Database initialized successfully with {tableCount} tables");
            return true;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Failed to initialize: {ex.Message}");
            return false;
        }
    }

    private async Task<int> GetTableCountAsync(NpgsqlConnection connection)
    {
        const string sql = @"
            SELECT COUNT(*) FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'";

        await using var cmd = new NpgsqlCommand(sql, connection);
        var result = await cmd.ExecuteScalarAsync();
        return Convert.ToInt32(result);
    }

    /// <summary>
    /// Tests the database connection
    /// </summary>
    public async Task<bool> TestConnectionAsync()
    {
        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            return true;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Connection test failed: {ex.Message}");
            return false;
        }
    }

    #endregion

    #region Email Caching

    /// <summary>
    /// Caches an email message to local database
    /// </summary>
    public async Task CacheEmailAsync(EmailMessage email)
    {
        const string sql = @"
            INSERT INTO cached_emails (
                server_id, folder_id, subject, sender_name, sender_email,
                recipients, cc_recipients, bcc_recipients, body, body_preview,
                is_html, is_read, is_flagged, is_draft, has_attachments,
                attachments, importance, received_date, sent_date, conversation_id,
                sync_status
            ) VALUES (
                @server_id, @folder_id, @subject, @sender_name, @sender_email,
                @recipients::jsonb, @cc_recipients::jsonb, @bcc_recipients::jsonb, @body, @body_preview,
                @is_html, @is_read, @is_flagged, @is_draft, @has_attachments,
                @attachments::jsonb, @importance, @received_date, @sent_date, @conversation_id,
                'synced'
            )
            ON CONFLICT (server_id) DO UPDATE SET
                folder_id = EXCLUDED.folder_id,
                subject = EXCLUDED.subject,
                sender_name = EXCLUDED.sender_name,
                sender_email = EXCLUDED.sender_email,
                recipients = EXCLUDED.recipients,
                cc_recipients = EXCLUDED.cc_recipients,
                bcc_recipients = EXCLUDED.bcc_recipients,
                body = EXCLUDED.body,
                body_preview = EXCLUDED.body_preview,
                is_html = EXCLUDED.is_html,
                is_read = EXCLUDED.is_read,
                is_flagged = EXCLUDED.is_flagged,
                is_draft = EXCLUDED.is_draft,
                has_attachments = EXCLUDED.has_attachments,
                attachments = EXCLUDED.attachments,
                importance = EXCLUDED.importance,
                received_date = EXCLUDED.received_date,
                sent_date = EXCLUDED.sent_date,
                conversation_id = EXCLUDED.conversation_id,
                last_modified = CURRENT_TIMESTAMP,
                sync_status = 'synced'";

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);

            cmd.Parameters.AddWithValue("server_id", email.Id);
            cmd.Parameters.AddWithValue("folder_id", email.FolderId ?? "inbox");
            cmd.Parameters.AddWithValue("subject", (object?)email.Subject ?? DBNull.Value);
            cmd.Parameters.AddWithValue("sender_name", (object?)email.From ?? DBNull.Value);
            cmd.Parameters.AddWithValue("sender_email", (object?)email.FromEmail ?? DBNull.Value);
            cmd.Parameters.AddWithValue("recipients", JsonSerializer.Serialize(email.To ?? new List<string>(), _jsonOptions));
            cmd.Parameters.AddWithValue("cc_recipients", JsonSerializer.Serialize(email.Cc ?? new List<string>(), _jsonOptions));
            cmd.Parameters.AddWithValue("bcc_recipients", JsonSerializer.Serialize(email.Bcc ?? new List<string>(), _jsonOptions));
            cmd.Parameters.AddWithValue("body", (object?)email.Body ?? DBNull.Value);
            cmd.Parameters.AddWithValue("body_preview", (object?)email.Preview ?? DBNull.Value);
            cmd.Parameters.AddWithValue("is_html", email.IsHtml);
            cmd.Parameters.AddWithValue("is_read", email.IsRead);
            cmd.Parameters.AddWithValue("is_flagged", email.IsFlagged);
            cmd.Parameters.AddWithValue("is_draft", email.FolderId?.ToLower() == "drafts");
            cmd.Parameters.AddWithValue("has_attachments", email.HasAttachments);
            cmd.Parameters.AddWithValue("attachments", JsonSerializer.Serialize(email.Attachments ?? new List<EmailAttachment>(), _jsonOptions));
            cmd.Parameters.AddWithValue("importance", email.Priority.ToString().ToLower());
            cmd.Parameters.AddWithValue("received_date", email.ReceivedDate);
            cmd.Parameters.AddWithValue("sent_date", (object?)email.ReceivedDate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("conversation_id", (object?)email.ConversationId ?? DBNull.Value);

            await cmd.ExecuteNonQueryAsync();
            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Cached email: {email.Subject}");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Failed to cache email: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Caches multiple emails in a batch operation
    /// </summary>
    public async Task CacheEmailsAsync(IEnumerable<EmailMessage> emails)
    {
        foreach (var email in emails)
        {
            await CacheEmailAsync(email);
        }
    }

    /// <summary>
    /// Gets cached emails for a specific folder
    /// </summary>
    public async Task<List<EmailMessage>> GetCachedEmailsAsync(string folderId)
    {
        const string sql = @"
            SELECT server_id, folder_id, subject, sender_name, sender_email,
                   recipients, cc_recipients, bcc_recipients, body, body_preview,
                   is_html, is_read, is_flagged, is_draft, has_attachments,
                   attachments, importance, received_date, conversation_id
            FROM cached_emails
            WHERE folder_id = @folder_id AND is_deleted = FALSE
            ORDER BY received_date DESC";

        var emails = new List<EmailMessage>();

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);
            cmd.Parameters.AddWithValue("folder_id", folderId);

            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                emails.Add(MapReaderToEmailMessage(reader));
            }

            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Retrieved {emails.Count} cached emails for folder {folderId}");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Failed to get cached emails: {ex.Message}");
        }

        return emails;
    }

    /// <summary>
    /// Gets a cached email by server ID
    /// </summary>
    public async Task<EmailMessage?> GetCachedEmailByIdAsync(string serverId)
    {
        const string sql = @"
            SELECT server_id, folder_id, subject, sender_name, sender_email,
                   recipients, cc_recipients, bcc_recipients, body, body_preview,
                   is_html, is_read, is_flagged, is_draft, has_attachments,
                   attachments, importance, received_date, conversation_id
            FROM cached_emails
            WHERE server_id = @server_id AND is_deleted = FALSE";

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);
            cmd.Parameters.AddWithValue("server_id", serverId);

            await using var reader = await cmd.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                return MapReaderToEmailMessage(reader);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Failed to get cached email by ID: {ex.Message}");
        }

        return null;
    }

    /// <summary>
    /// Updates email status (read/flagged)
    /// </summary>
    public async Task UpdateEmailStatusAsync(string serverId, bool isRead, bool isFlagged)
    {
        const string sql = @"
            UPDATE cached_emails
            SET is_read = @is_read, is_flagged = @is_flagged, last_modified = CURRENT_TIMESTAMP
            WHERE server_id = @server_id";

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);
            cmd.Parameters.AddWithValue("server_id", serverId);
            cmd.Parameters.AddWithValue("is_read", isRead);
            cmd.Parameters.AddWithValue("is_flagged", isFlagged);

            await cmd.ExecuteNonQueryAsync();
            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Updated email status: {serverId}");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Failed to update email status: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Marks an email as deleted (soft delete)
    /// </summary>
    public async Task MarkEmailDeletedAsync(string serverId)
    {
        const string sql = @"
            UPDATE cached_emails
            SET is_deleted = TRUE, last_modified = CURRENT_TIMESTAMP
            WHERE server_id = @server_id";

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);
            cmd.Parameters.AddWithValue("server_id", serverId);

            await cmd.ExecuteNonQueryAsync();
            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Marked email as deleted: {serverId}");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Failed to mark email as deleted: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Searches cached emails
    /// </summary>
    public async Task<List<EmailMessage>> SearchCachedEmailsAsync(string query)
    {
        const string sql = @"
            SELECT server_id, folder_id, subject, sender_name, sender_email,
                   recipients, cc_recipients, bcc_recipients, body, body_preview,
                   is_html, is_read, is_flagged, is_draft, has_attachments,
                   attachments, importance, received_date, conversation_id
            FROM cached_emails
            WHERE is_deleted = FALSE
              AND (subject ILIKE @query OR body ILIKE @query OR sender_email ILIKE @query)
            ORDER BY received_date DESC
            LIMIT 100";

        var emails = new List<EmailMessage>();

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);
            cmd.Parameters.AddWithValue("query", $"%{query}%");

            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                emails.Add(MapReaderToEmailMessage(reader));
            }

            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Found {emails.Count} emails matching '{query}'");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Failed to search emails: {ex.Message}");
        }

        return emails;
    }

    private EmailMessage MapReaderToEmailMessage(NpgsqlDataReader reader)
    {
        var email = new EmailMessage
        {
            Id = reader.GetString(reader.GetOrdinal("server_id")),
            FolderId = reader.GetString(reader.GetOrdinal("folder_id")),
            Subject = reader.IsDBNull(reader.GetOrdinal("subject")) ? "" : reader.GetString(reader.GetOrdinal("subject")),
            From = reader.IsDBNull(reader.GetOrdinal("sender_name")) ? "" : reader.GetString(reader.GetOrdinal("sender_name")),
            FromEmail = reader.IsDBNull(reader.GetOrdinal("sender_email")) ? "" : reader.GetString(reader.GetOrdinal("sender_email")),
            Body = reader.IsDBNull(reader.GetOrdinal("body")) ? "" : reader.GetString(reader.GetOrdinal("body")),
            Preview = reader.IsDBNull(reader.GetOrdinal("body_preview")) ? "" : reader.GetString(reader.GetOrdinal("body_preview")),
            IsHtml = reader.GetBoolean(reader.GetOrdinal("is_html")),
            IsRead = reader.GetBoolean(reader.GetOrdinal("is_read")),
            IsFlagged = reader.GetBoolean(reader.GetOrdinal("is_flagged")),
            HasAttachments = reader.GetBoolean(reader.GetOrdinal("has_attachments")),
            ReceivedDate = reader.GetDateTime(reader.GetOrdinal("received_date")),
            ConversationId = reader.IsDBNull(reader.GetOrdinal("conversation_id")) ? "" : reader.GetString(reader.GetOrdinal("conversation_id"))
        };

        // Parse JSON arrays
        var recipientsJson = reader.IsDBNull(reader.GetOrdinal("recipients")) ? "[]" : reader.GetString(reader.GetOrdinal("recipients"));
        var ccJson = reader.IsDBNull(reader.GetOrdinal("cc_recipients")) ? "[]" : reader.GetString(reader.GetOrdinal("cc_recipients"));
        var bccJson = reader.IsDBNull(reader.GetOrdinal("bcc_recipients")) ? "[]" : reader.GetString(reader.GetOrdinal("bcc_recipients"));
        var attachmentsJson = reader.IsDBNull(reader.GetOrdinal("attachments")) ? "[]" : reader.GetString(reader.GetOrdinal("attachments"));

        email.To = JsonSerializer.Deserialize<List<string>>(recipientsJson, _jsonOptions) ?? new List<string>();
        email.Cc = JsonSerializer.Deserialize<List<string>>(ccJson, _jsonOptions) ?? new List<string>();
        email.Bcc = JsonSerializer.Deserialize<List<string>>(bccJson, _jsonOptions) ?? new List<string>();
        email.Attachments = JsonSerializer.Deserialize<List<EmailAttachment>>(attachmentsJson, _jsonOptions) ?? new List<EmailAttachment>();

        // Parse importance/priority
        var importance = reader.IsDBNull(reader.GetOrdinal("importance")) ? "normal" : reader.GetString(reader.GetOrdinal("importance"));
        email.Priority = importance.ToLower() switch
        {
            "high" => EmailPriority.High,
            "low" => EmailPriority.Low,
            _ => EmailPriority.Normal
        };

        return email;
    }

    #endregion

    #region Folder Caching

    /// <summary>
    /// Caches a mail folder
    /// </summary>
    public async Task CacheFolderAsync(MailFolder folder)
    {
        const string sql = @"
            INSERT INTO cached_folders (
                server_id, name, folder_type, parent_folder_id,
                unread_count, total_count, display_order
            ) VALUES (
                @server_id, @name, @folder_type, @parent_folder_id,
                @unread_count, @total_count, @display_order
            )
            ON CONFLICT (server_id) DO UPDATE SET
                name = EXCLUDED.name,
                folder_type = EXCLUDED.folder_type,
                parent_folder_id = EXCLUDED.parent_folder_id,
                unread_count = EXCLUDED.unread_count,
                total_count = EXCLUDED.total_count,
                display_order = EXCLUDED.display_order,
                last_modified = CURRENT_TIMESTAMP";

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);

            cmd.Parameters.AddWithValue("server_id", folder.Id);
            cmd.Parameters.AddWithValue("name", folder.Name);
            cmd.Parameters.AddWithValue("folder_type", folder.Type.ToString().ToLower());
            cmd.Parameters.AddWithValue("parent_folder_id", (object?)folder.ParentFolderId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("unread_count", folder.UnreadCount);
            cmd.Parameters.AddWithValue("total_count", folder.TotalCount);
            cmd.Parameters.AddWithValue("display_order", GetFolderDisplayOrder(folder.Type));

            await cmd.ExecuteNonQueryAsync();
            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Cached folder: {folder.Name}");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Failed to cache folder: {ex.Message}");
            throw;
        }
    }

    private int GetFolderDisplayOrder(FolderType type)
    {
        return type switch
        {
            FolderType.AccountRoot => 0,
            FolderType.Inbox => 1,
            FolderType.Drafts => 2,
            FolderType.Sent => 3,
            FolderType.Archive => 4,
            FolderType.Junk => 5,
            FolderType.Deleted => 6,
            FolderType.Custom => 10,
            _ => 10
        };
    }

    /// <summary>
    /// Caches multiple folders
    /// </summary>
    public async Task CacheFoldersAsync(IEnumerable<MailFolder> folders)
    {
        foreach (var folder in folders)
        {
            await CacheFolderAsync(folder);
        }
    }

    /// <summary>
    /// Gets all cached folders
    /// </summary>
    public async Task<List<MailFolder>> GetCachedFoldersAsync()
    {
        const string sql = @"
            SELECT server_id, name, folder_type, parent_folder_id,
                   unread_count, total_count, display_order
            FROM cached_folders
            ORDER BY display_order, name";

        var folders = new List<MailFolder>();

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);

            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var folder = new MailFolder
                {
                    Id = reader.GetString(reader.GetOrdinal("server_id")),
                    Name = reader.GetString(reader.GetOrdinal("name")),
                    ParentFolderId = reader.IsDBNull(reader.GetOrdinal("parent_folder_id")) ? null : reader.GetString(reader.GetOrdinal("parent_folder_id")),
                    UnreadCount = reader.GetInt32(reader.GetOrdinal("unread_count")),
                    TotalCount = reader.GetInt32(reader.GetOrdinal("total_count"))
                };

                // Parse folder type
                var folderType = reader.IsDBNull(reader.GetOrdinal("folder_type")) ? "custom" : reader.GetString(reader.GetOrdinal("folder_type"));
                folder.Type = Enum.TryParse<FolderType>(folderType, true, out var type) ? type : FolderType.Custom;
                folder.Icon = GetFolderIcon(folder.Type);

                folders.Add(folder);
            }

            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Retrieved {folders.Count} cached folders");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Failed to get cached folders: {ex.Message}");
        }

        return folders;
    }

    private string GetFolderIcon(FolderType type)
    {
        return type switch
        {
            FolderType.Inbox => "\ue156",
            FolderType.Sent => "\ue163",
            FolderType.Drafts => "\ue254",
            FolderType.Deleted => "\ue107",
            FolderType.Junk => "\ue10a",
            FolderType.Archive => "\ue109",
            FolderType.AccountRoot => "\ue125",
            FolderType.Custom => "\ue188",
            _ => "\ue188"
        };
    }

    #endregion

    #region Event Caching

    /// <summary>
    /// Caches a calendar event
    /// </summary>
    public async Task CacheEventAsync(CalendarEvent calEvent)
    {
        const string sql = @"
            INSERT INTO cached_events (
                server_id, calendar_id, title, description, location,
                start_time, end_time, is_all_day, is_recurring, recurrence_pattern,
                organizer_name, organizer_email, attendees, status,
                reminder_minutes, is_private, categories, sync_status
            ) VALUES (
                @server_id, @calendar_id, @title, @description, @location,
                @start_time, @end_time, @is_all_day, @is_recurring, @recurrence_pattern::jsonb,
                @organizer_name, @organizer_email, @attendees::jsonb, @status,
                @reminder_minutes, @is_private, @categories::jsonb, 'synced'
            )
            ON CONFLICT (server_id) DO UPDATE SET
                calendar_id = EXCLUDED.calendar_id,
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                location = EXCLUDED.location,
                start_time = EXCLUDED.start_time,
                end_time = EXCLUDED.end_time,
                is_all_day = EXCLUDED.is_all_day,
                is_recurring = EXCLUDED.is_recurring,
                recurrence_pattern = EXCLUDED.recurrence_pattern,
                organizer_name = EXCLUDED.organizer_name,
                organizer_email = EXCLUDED.organizer_email,
                attendees = EXCLUDED.attendees,
                status = EXCLUDED.status,
                reminder_minutes = EXCLUDED.reminder_minutes,
                is_private = EXCLUDED.is_private,
                categories = EXCLUDED.categories,
                last_modified = CURRENT_TIMESTAMP,
                sync_status = 'synced'";

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);

            cmd.Parameters.AddWithValue("server_id", calEvent.Id);
            cmd.Parameters.AddWithValue("calendar_id", (object?)calEvent.CalendarName ?? DBNull.Value);
            cmd.Parameters.AddWithValue("title", calEvent.Subject);
            cmd.Parameters.AddWithValue("description", (object?)calEvent.Description ?? DBNull.Value);
            cmd.Parameters.AddWithValue("location", (object?)calEvent.Location ?? DBNull.Value);
            cmd.Parameters.AddWithValue("start_time", calEvent.StartTime);
            cmd.Parameters.AddWithValue("end_time", calEvent.EndTime);
            cmd.Parameters.AddWithValue("is_all_day", calEvent.IsAllDay);
            cmd.Parameters.AddWithValue("is_recurring", calEvent.IsRecurring);
            cmd.Parameters.AddWithValue("recurrence_pattern", calEvent.Recurrence != null ? JsonSerializer.Serialize(calEvent.Recurrence, _jsonOptions) : "null");
            cmd.Parameters.AddWithValue("organizer_name", (object?)calEvent.Organizer ?? DBNull.Value);
            cmd.Parameters.AddWithValue("organizer_email", DBNull.Value);
            cmd.Parameters.AddWithValue("attendees", JsonSerializer.Serialize(calEvent.Attendees ?? new List<string>(), _jsonOptions));
            cmd.Parameters.AddWithValue("status", calEvent.Status.ToString().ToLower());
            cmd.Parameters.AddWithValue("reminder_minutes", (object?)GetReminderMinutes(calEvent.Reminder) ?? DBNull.Value);
            cmd.Parameters.AddWithValue("is_private", calEvent.IsPrivate);
            cmd.Parameters.AddWithValue("categories", JsonSerializer.Serialize(new List<string> { calEvent.Category.ToString() }, _jsonOptions));

            await cmd.ExecuteNonQueryAsync();
            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Cached event: {calEvent.Subject}");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Failed to cache event: {ex.Message}");
            throw;
        }
    }

    private int? GetReminderMinutes(ReminderTime reminder)
    {
        return reminder switch
        {
            ReminderTime.None => null,
            ReminderTime.AtTimeOfEvent => 0,
            ReminderTime.FiveMinutes => 5,
            ReminderTime.FifteenMinutes => 15,
            ReminderTime.ThirtyMinutes => 30,
            ReminderTime.OneHour => 60,
            ReminderTime.TwoHours => 120,
            ReminderTime.OneDay => 1440,
            ReminderTime.OneWeek => 10080,
            _ => null
        };
    }

    private ReminderTime GetReminderTimeFromMinutes(int? minutes)
    {
        return minutes switch
        {
            null => ReminderTime.None,
            0 => ReminderTime.AtTimeOfEvent,
            5 => ReminderTime.FiveMinutes,
            15 => ReminderTime.FifteenMinutes,
            30 => ReminderTime.ThirtyMinutes,
            60 => ReminderTime.OneHour,
            120 => ReminderTime.TwoHours,
            1440 => ReminderTime.OneDay,
            10080 => ReminderTime.OneWeek,
            _ => ReminderTime.FifteenMinutes
        };
    }

    /// <summary>
    /// Gets cached events within a date range
    /// </summary>
    public async Task<List<CalendarEvent>> GetCachedEventsAsync(DateTime start, DateTime end)
    {
        const string sql = @"
            SELECT server_id, calendar_id, title, description, location,
                   start_time, end_time, is_all_day, is_recurring, recurrence_pattern,
                   organizer_name, organizer_email, attendees, status,
                   reminder_minutes, is_private, categories
            FROM cached_events
            WHERE is_deleted = FALSE
              AND ((start_time >= @start AND start_time <= @end)
                   OR (end_time >= @start AND end_time <= @end)
                   OR (start_time <= @start AND end_time >= @end))
            ORDER BY start_time";

        var events = new List<CalendarEvent>();

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);
            cmd.Parameters.AddWithValue("start", start);
            cmd.Parameters.AddWithValue("end", end);

            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                events.Add(MapReaderToCalendarEvent(reader));
            }

            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Retrieved {events.Count} cached events");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Failed to get cached events: {ex.Message}");
        }

        return events;
    }

    /// <summary>
    /// Marks an event as deleted in the local cache
    /// </summary>
    public async Task MarkEventDeletedAsync(string serverId)
    {
        const string sql = @"
            UPDATE cached_events
            SET is_deleted = TRUE, last_modified = CURRENT_TIMESTAMP
            WHERE server_id = @server_id";

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);
            cmd.Parameters.AddWithValue("server_id", serverId);

            var rowsAffected = await cmd.ExecuteNonQueryAsync();
            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Marked event as deleted: {serverId} (rows affected: {rowsAffected})");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Failed to mark event as deleted: {ex.Message}");
            throw;
        }
    }

    private CalendarEvent MapReaderToCalendarEvent(NpgsqlDataReader reader)
    {
        var attendeesJson = reader.IsDBNull(reader.GetOrdinal("attendees")) ? "[]" : reader.GetString(reader.GetOrdinal("attendees"));
        var categoriesJson = reader.IsDBNull(reader.GetOrdinal("categories")) ? "[]" : reader.GetString(reader.GetOrdinal("categories"));
        var recurrenceJson = reader.IsDBNull(reader.GetOrdinal("recurrence_pattern")) ? null : reader.GetString(reader.GetOrdinal("recurrence_pattern"));

        var categories = JsonSerializer.Deserialize<List<string>>(categoriesJson, _jsonOptions) ?? new List<string>();
        var categoryStr = categories.FirstOrDefault() ?? "None";
        var reminderMinutes = reader.IsDBNull(reader.GetOrdinal("reminder_minutes")) ? (int?)null : reader.GetInt32(reader.GetOrdinal("reminder_minutes"));
        var statusStr = reader.IsDBNull(reader.GetOrdinal("status")) ? "free" : reader.GetString(reader.GetOrdinal("status"));

        var calEvent = new CalendarEvent
        {
            Id = reader.GetString(reader.GetOrdinal("server_id")),
            CalendarName = reader.IsDBNull(reader.GetOrdinal("calendar_id")) ? "My Calendar" : reader.GetString(reader.GetOrdinal("calendar_id")),
            Subject = reader.GetString(reader.GetOrdinal("title")),
            Description = reader.IsDBNull(reader.GetOrdinal("description")) ? "" : reader.GetString(reader.GetOrdinal("description")),
            Location = reader.IsDBNull(reader.GetOrdinal("location")) ? "" : reader.GetString(reader.GetOrdinal("location")),
            StartTime = reader.GetDateTime(reader.GetOrdinal("start_time")),
            EndTime = reader.GetDateTime(reader.GetOrdinal("end_time")),
            IsAllDay = reader.GetBoolean(reader.GetOrdinal("is_all_day")),
            IsRecurring = reader.GetBoolean(reader.GetOrdinal("is_recurring")),
            Organizer = reader.IsDBNull(reader.GetOrdinal("organizer_name")) ? "" : reader.GetString(reader.GetOrdinal("organizer_name")),
            Attendees = JsonSerializer.Deserialize<List<string>>(attendeesJson, _jsonOptions) ?? new List<string>(),
            Reminder = GetReminderTimeFromMinutes(reminderMinutes),
            IsPrivate = reader.GetBoolean(reader.GetOrdinal("is_private")),
            Category = Enum.TryParse<EventCategory>(categoryStr, true, out var cat) ? cat : EventCategory.None,
            Status = Enum.TryParse<EventStatus>(statusStr, true, out var stat) ? stat : EventStatus.Free
        };

        // Parse recurrence pattern if present
        if (!string.IsNullOrEmpty(recurrenceJson) && recurrenceJson != "null")
        {
            try
            {
                calEvent.Recurrence = JsonSerializer.Deserialize<RecurrencePattern>(recurrenceJson, _jsonOptions);
            }
            catch
            {
                calEvent.Recurrence = null;
            }
        }

        return calEvent;
    }

    #endregion

    #region Contact Caching

    /// <summary>
    /// Caches a contact
    /// </summary>
    public async Task CacheContactAsync(Contact contact)
    {
        const string sql = @"
            INSERT INTO cached_contacts (
                server_id, display_name, first_name, last_name,
                email_addresses, phone_numbers, company, job_title,
                department, notes, photo_url, sync_status
            ) VALUES (
                @server_id, @display_name, @first_name, @last_name,
                @email_addresses::jsonb, @phone_numbers::jsonb, @company, @job_title,
                @department, @notes, @photo_url, 'synced'
            )
            ON CONFLICT (server_id) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                email_addresses = EXCLUDED.email_addresses,
                phone_numbers = EXCLUDED.phone_numbers,
                company = EXCLUDED.company,
                job_title = EXCLUDED.job_title,
                department = EXCLUDED.department,
                notes = EXCLUDED.notes,
                photo_url = EXCLUDED.photo_url,
                last_modified = CURRENT_TIMESTAMP,
                sync_status = 'synced'";

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);

            cmd.Parameters.AddWithValue("server_id", contact.Id);
            cmd.Parameters.AddWithValue("display_name", (object?)contact.DisplayName ?? DBNull.Value);
            cmd.Parameters.AddWithValue("first_name", (object?)contact.FirstName ?? DBNull.Value);
            cmd.Parameters.AddWithValue("last_name", (object?)contact.LastName ?? DBNull.Value);
            cmd.Parameters.AddWithValue("email_addresses", JsonSerializer.Serialize(contact.EmailAddresses ?? new List<string>(), _jsonOptions));
            cmd.Parameters.AddWithValue("phone_numbers", JsonSerializer.Serialize(contact.PhoneNumbers ?? new List<string>(), _jsonOptions));
            cmd.Parameters.AddWithValue("company", (object?)contact.Company ?? DBNull.Value);
            cmd.Parameters.AddWithValue("job_title", (object?)contact.JobTitle ?? DBNull.Value);
            cmd.Parameters.AddWithValue("department", (object?)contact.Department ?? DBNull.Value);
            cmd.Parameters.AddWithValue("notes", (object?)contact.Notes ?? DBNull.Value);
            cmd.Parameters.AddWithValue("photo_url", (object?)contact.PhotoUrl ?? DBNull.Value);

            await cmd.ExecuteNonQueryAsync();
            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Cached contact: {contact.DisplayName}");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Failed to cache contact: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Gets all cached contacts
    /// </summary>
    public async Task<List<Contact>> GetCachedContactsAsync()
    {
        const string sql = @"
            SELECT server_id, display_name, first_name, last_name,
                   email_addresses, phone_numbers, company, job_title,
                   department, notes, photo_url
            FROM cached_contacts
            WHERE is_deleted = FALSE
            ORDER BY display_name";

        var contacts = new List<Contact>();

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);

            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                contacts.Add(MapReaderToContact(reader));
            }

            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Retrieved {contacts.Count} cached contacts");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Failed to get cached contacts: {ex.Message}");
        }

        return contacts;
    }

    /// <summary>
    /// Searches cached contacts
    /// </summary>
    public async Task<List<Contact>> SearchContactsAsync(string query)
    {
        const string sql = @"
            SELECT server_id, display_name, first_name, last_name,
                   email_addresses, phone_numbers, company, job_title,
                   department, notes, photo_url
            FROM cached_contacts
            WHERE is_deleted = FALSE
              AND (display_name ILIKE @query
                   OR first_name ILIKE @query
                   OR last_name ILIKE @query
                   OR company ILIKE @query
                   OR email_addresses::text ILIKE @query)
            ORDER BY display_name
            LIMIT 50";

        var contacts = new List<Contact>();

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);
            cmd.Parameters.AddWithValue("query", $"%{query}%");

            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                contacts.Add(MapReaderToContact(reader));
            }

            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Found {contacts.Count} contacts matching '{query}'");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Failed to search contacts: {ex.Message}");
        }

        return contacts;
    }

    private Contact MapReaderToContact(NpgsqlDataReader reader)
    {
        var emailsJson = reader.IsDBNull(reader.GetOrdinal("email_addresses")) ? "[]" : reader.GetString(reader.GetOrdinal("email_addresses"));
        var phonesJson = reader.IsDBNull(reader.GetOrdinal("phone_numbers")) ? "[]" : reader.GetString(reader.GetOrdinal("phone_numbers"));

        return new Contact
        {
            Id = reader.GetString(reader.GetOrdinal("server_id")),
            DisplayName = reader.IsDBNull(reader.GetOrdinal("display_name")) ? "" : reader.GetString(reader.GetOrdinal("display_name")),
            FirstName = reader.IsDBNull(reader.GetOrdinal("first_name")) ? null : reader.GetString(reader.GetOrdinal("first_name")),
            LastName = reader.IsDBNull(reader.GetOrdinal("last_name")) ? null : reader.GetString(reader.GetOrdinal("last_name")),
            EmailAddresses = JsonSerializer.Deserialize<List<string>>(emailsJson, _jsonOptions) ?? new List<string>(),
            PhoneNumbers = JsonSerializer.Deserialize<List<string>>(phonesJson, _jsonOptions) ?? new List<string>(),
            Company = reader.IsDBNull(reader.GetOrdinal("company")) ? null : reader.GetString(reader.GetOrdinal("company")),
            JobTitle = reader.IsDBNull(reader.GetOrdinal("job_title")) ? null : reader.GetString(reader.GetOrdinal("job_title")),
            Department = reader.IsDBNull(reader.GetOrdinal("department")) ? null : reader.GetString(reader.GetOrdinal("department")),
            Notes = reader.IsDBNull(reader.GetOrdinal("notes")) ? null : reader.GetString(reader.GetOrdinal("notes")),
            PhotoUrl = reader.IsDBNull(reader.GetOrdinal("photo_url")) ? null : reader.GetString(reader.GetOrdinal("photo_url"))
        };
    }

    #endregion

    #region Cache Management

    /// <summary>
    /// Clears all cached data
    /// </summary>
    public async Task ClearAllCacheAsync()
    {
        const string sql = @"
            TRUNCATE cached_emails, cached_folders, cached_events, cached_contacts, sync_queue;
            UPDATE sync_state SET full_sync_required = TRUE, last_sync_token = NULL, last_sync_time = NULL;";

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);
            await cmd.ExecuteNonQueryAsync();

            System.Diagnostics.Debug.WriteLine("[LocalCacheService] All cache cleared");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Failed to clear cache: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Gets cache statistics
    /// </summary>
    public async Task<CacheStatistics> GetCacheStatisticsAsync()
    {
        const string sql = @"
            SELECT
                (SELECT COUNT(*) FROM cached_emails WHERE is_deleted = FALSE) as email_count,
                (SELECT COUNT(*) FROM cached_folders) as folder_count,
                (SELECT COUNT(*) FROM cached_events WHERE is_deleted = FALSE) as event_count,
                (SELECT COUNT(*) FROM cached_contacts WHERE is_deleted = FALSE) as contact_count,
                (SELECT COUNT(*) FROM sync_queue WHERE status = 'pending') as pending_sync_count";

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);

            await using var reader = await cmd.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                return new CacheStatistics
                {
                    EmailCount = reader.GetInt64(0),
                    FolderCount = reader.GetInt64(1),
                    EventCount = reader.GetInt64(2),
                    ContactCount = reader.GetInt64(3),
                    PendingSyncCount = reader.GetInt64(4)
                };
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[LocalCacheService] Failed to get cache statistics: {ex.Message}");
        }

        return new CacheStatistics();
    }

    #endregion

    #region IDisposable

    public void Dispose()
    {
        Dispose(true);
        GC.SuppressFinalize(this);
    }

    protected virtual void Dispose(bool disposing)
    {
        if (!_disposed)
        {
            if (disposing)
            {
                // Dispose managed resources if any
            }
            _disposed = true;
        }
    }

    /// <summary>
    /// Resets the singleton instance
    /// </summary>
    public static void Reset()
    {
        lock (_lock)
        {
            _instance?.Dispose();
            _instance = null;
        }
    }

    #endregion
}

/// <summary>
/// Cache statistics model
/// </summary>
public class CacheStatistics
{
    public long EmailCount { get; set; }
    public long FolderCount { get; set; }
    public long EventCount { get; set; }
    public long ContactCount { get; set; }
    public long PendingSyncCount { get; set; }
}
