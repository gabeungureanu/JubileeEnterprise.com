using System.Text.Json;
using Npgsql;
using JubileeOutlook.Models;

namespace JubileeOutlook.Services;

/// <summary>
/// Service for managing the offline sync queue in PostgreSQL
/// Queues operations made while offline for later synchronization when connectivity is restored
/// </summary>
public class SyncQueueService : ISyncQueueService, IDisposable
{
    private static SyncQueueService? _instance;
    private static readonly object _lock = new();

    private readonly string _connectionString;
    private readonly JsonSerializerOptions _jsonOptions;
    private readonly int _maxRetryAttempts;
    private bool _isInitialized = false;
    private bool _disposed = false;

    /// <summary>
    /// Gets the singleton instance of SyncQueueService
    /// </summary>
    public static SyncQueueService Instance
    {
        get
        {
            if (_instance == null)
            {
                lock (_lock)
                {
                    _instance ??= new SyncQueueService();
                }
            }
            return _instance;
        }
    }

    /// <summary>
    /// Gets whether the sync queue service is initialized
    /// </summary>
    public bool IsInitialized => _isInitialized;

    private SyncQueueService()
    {
        _connectionString = ConfigurationService.Instance.GetLocalCacheConnectionString();
        _maxRetryAttempts = ConfigurationService.Instance.LocalCache.MaxRetryAttempts;
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false
        };

        System.Diagnostics.Debug.WriteLine("[SyncQueueService] Created with connection to local PostgreSQL cache");
    }

    #region Initialization

    /// <summary>
    /// Initializes the sync queue service and verifies database connectivity
    /// </summary>
    public async Task<bool> InitializeAsync()
    {
        if (_isInitialized) return true;

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();

            // Verify sync_queue table exists
            const string checkTableSql = @"
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = 'sync_queue'
                )";

            await using var cmd = new NpgsqlCommand(checkTableSql, connection);
            var exists = (bool)(await cmd.ExecuteScalarAsync() ?? false);

            if (!exists)
            {
                System.Diagnostics.Debug.WriteLine("[SyncQueueService] Warning: sync_queue table does not exist");
                return false;
            }

            _isInitialized = true;
            System.Diagnostics.Debug.WriteLine("[SyncQueueService] Initialized successfully");
            return true;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncQueueService] Failed to initialize: {ex.Message}");
            return false;
        }
    }

    #endregion

    #region Queue Operations

    /// <summary>
    /// Queues an operation for later synchronization when offline
    /// </summary>
    public async Task<Guid> QueueOperationAsync(string entityType, string entityId, string operation, object? payload = null)
    {
        const string sql = @"
            INSERT INTO sync_queue (
                id, entity_type, entity_id, operation, payload,
                created_at, retry_count, status
            ) VALUES (
                @id, @entity_type, @entity_id, @operation, @payload::jsonb,
                @created_at, 0, 'pending'
            )
            RETURNING id";

        var operationId = Guid.NewGuid();

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);

            var payloadJson = payload != null
                ? JsonSerializer.Serialize(payload, _jsonOptions)
                : null;

            cmd.Parameters.AddWithValue("id", operationId);
            cmd.Parameters.AddWithValue("entity_type", entityType);
            cmd.Parameters.AddWithValue("entity_id", entityId);
            cmd.Parameters.AddWithValue("operation", operation);
            cmd.Parameters.AddWithValue("payload", (object?)payloadJson ?? DBNull.Value);
            cmd.Parameters.AddWithValue("created_at", DateTime.UtcNow);

            await cmd.ExecuteNonQueryAsync();

            System.Diagnostics.Debug.WriteLine($"[SyncQueueService] Queued operation: {operation} for {entityType}/{entityId}");
            return operationId;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncQueueService] Failed to queue operation: {ex.Message}");
            throw;
        }
    }

    #endregion

    #region Get Pending Operations

    /// <summary>
    /// Gets all pending operations that need to be synchronized
    /// </summary>
    public async Task<List<SyncQueueOperation>> GetPendingOperationsAsync()
    {
        const string sql = @"
            SELECT id, entity_type, entity_id, operation, payload,
                   created_at, retry_count, last_error, status
            FROM sync_queue
            WHERE status = 'pending'
            ORDER BY created_at ASC";

        return await ExecuteGetOperationsAsync(sql);
    }

    /// <summary>
    /// Gets pending operations for a specific entity type
    /// </summary>
    public async Task<List<SyncQueueOperation>> GetPendingOperationsAsync(string entityType)
    {
        const string sql = @"
            SELECT id, entity_type, entity_id, operation, payload,
                   created_at, retry_count, last_error, status
            FROM sync_queue
            WHERE status = 'pending' AND entity_type = @entity_type
            ORDER BY created_at ASC";

        var operations = new List<SyncQueueOperation>();

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);
            cmd.Parameters.AddWithValue("entity_type", entityType);

            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                operations.Add(MapReaderToOperation(reader));
            }

            System.Diagnostics.Debug.WriteLine($"[SyncQueueService] Retrieved {operations.Count} pending operations for {entityType}");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncQueueService] Failed to get pending operations: {ex.Message}");
        }

        return operations;
    }

    private async Task<List<SyncQueueOperation>> ExecuteGetOperationsAsync(string sql)
    {
        var operations = new List<SyncQueueOperation>();

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);

            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                operations.Add(MapReaderToOperation(reader));
            }

            System.Diagnostics.Debug.WriteLine($"[SyncQueueService] Retrieved {operations.Count} pending operations");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncQueueService] Failed to get operations: {ex.Message}");
        }

        return operations;
    }

    #endregion

    #region Mark Operations

    /// <summary>
    /// Marks an operation as completed after successful synchronization
    /// </summary>
    public async Task MarkOperationCompletedAsync(Guid operationId)
    {
        const string sql = @"
            UPDATE sync_queue
            SET status = 'completed',
                last_error = NULL
            WHERE id = @id";

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);
            cmd.Parameters.AddWithValue("id", operationId);

            var rowsAffected = await cmd.ExecuteNonQueryAsync();
            if (rowsAffected > 0)
            {
                System.Diagnostics.Debug.WriteLine($"[SyncQueueService] Marked operation {operationId} as completed");
            }
            else
            {
                System.Diagnostics.Debug.WriteLine($"[SyncQueueService] Warning: Operation {operationId} not found");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncQueueService] Failed to mark operation as completed: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Marks an operation as failed with an error message
    /// </summary>
    public async Task MarkOperationFailedAsync(Guid operationId, string error)
    {
        const string sql = @"
            UPDATE sync_queue
            SET status = 'failed',
                last_error = @error
            WHERE id = @id";

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);
            cmd.Parameters.AddWithValue("id", operationId);
            cmd.Parameters.AddWithValue("error", error);

            var rowsAffected = await cmd.ExecuteNonQueryAsync();
            if (rowsAffected > 0)
            {
                System.Diagnostics.Debug.WriteLine($"[SyncQueueService] Marked operation {operationId} as failed: {error}");
            }
            else
            {
                System.Diagnostics.Debug.WriteLine($"[SyncQueueService] Warning: Operation {operationId} not found");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncQueueService] Failed to mark operation as failed: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Marks an operation as processing (being actively synchronized)
    /// </summary>
    public async Task MarkOperationProcessingAsync(Guid operationId)
    {
        const string sql = @"
            UPDATE sync_queue
            SET status = 'processing'
            WHERE id = @id";

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);
            cmd.Parameters.AddWithValue("id", operationId);

            await cmd.ExecuteNonQueryAsync();
            System.Diagnostics.Debug.WriteLine($"[SyncQueueService] Marked operation {operationId} as processing");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncQueueService] Failed to mark operation as processing: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Increments the retry count for a failed operation and resets to pending
    /// </summary>
    public async Task<bool> IncrementRetryAsync(Guid operationId, string error)
    {
        const string sql = @"
            UPDATE sync_queue
            SET retry_count = retry_count + 1,
                last_error = @error,
                status = CASE
                    WHEN retry_count + 1 >= @max_retries THEN 'failed'
                    ELSE 'pending'
                END
            WHERE id = @id
            RETURNING retry_count < @max_retries";

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);
            cmd.Parameters.AddWithValue("id", operationId);
            cmd.Parameters.AddWithValue("error", error);
            cmd.Parameters.AddWithValue("max_retries", _maxRetryAttempts);

            var result = await cmd.ExecuteScalarAsync();
            var canRetry = result != null && (bool)result;

            System.Diagnostics.Debug.WriteLine($"[SyncQueueService] Incremented retry for operation {operationId}, can retry: {canRetry}");
            return canRetry;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncQueueService] Failed to increment retry: {ex.Message}");
            throw;
        }
    }

    #endregion

    #region Clear Operations

    /// <summary>
    /// Clears all completed operations from the queue
    /// </summary>
    public async Task<int> ClearCompletedOperationsAsync()
    {
        const string sql = @"
            DELETE FROM sync_queue
            WHERE status = 'completed'";

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);

            var rowsAffected = await cmd.ExecuteNonQueryAsync();
            System.Diagnostics.Debug.WriteLine($"[SyncQueueService] Cleared {rowsAffected} completed operations");
            return rowsAffected;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncQueueService] Failed to clear completed operations: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Clears all failed operations from the queue
    /// </summary>
    public async Task<int> ClearFailedOperationsAsync()
    {
        const string sql = @"
            DELETE FROM sync_queue
            WHERE status = 'failed'";

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);

            var rowsAffected = await cmd.ExecuteNonQueryAsync();
            System.Diagnostics.Debug.WriteLine($"[SyncQueueService] Cleared {rowsAffected} failed operations");
            return rowsAffected;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncQueueService] Failed to clear failed operations: {ex.Message}");
            throw;
        }
    }

    #endregion

    #region Query Operations

    /// <summary>
    /// Gets the count of pending operations
    /// </summary>
    public async Task<int> GetPendingCountAsync()
    {
        const string sql = @"
            SELECT COUNT(*) FROM sync_queue
            WHERE status = 'pending'";

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);

            var result = await cmd.ExecuteScalarAsync();
            return Convert.ToInt32(result);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncQueueService] Failed to get pending count: {ex.Message}");
            return 0;
        }
    }

    /// <summary>
    /// Gets an operation by its ID
    /// </summary>
    public async Task<SyncQueueOperation?> GetOperationByIdAsync(Guid operationId)
    {
        const string sql = @"
            SELECT id, entity_type, entity_id, operation, payload,
                   created_at, retry_count, last_error, status
            FROM sync_queue
            WHERE id = @id";

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);
            cmd.Parameters.AddWithValue("id", operationId);

            await using var reader = await cmd.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                return MapReaderToOperation(reader);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncQueueService] Failed to get operation by ID: {ex.Message}");
        }

        return null;
    }

    /// <summary>
    /// Checks if there are any pending operations for a specific entity
    /// </summary>
    public async Task<bool> HasPendingOperationsAsync(string entityType, string entityId)
    {
        const string sql = @"
            SELECT EXISTS (
                SELECT 1 FROM sync_queue
                WHERE entity_type = @entity_type
                  AND entity_id = @entity_id
                  AND status IN ('pending', 'processing')
            )";

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);
            cmd.Parameters.AddWithValue("entity_type", entityType);
            cmd.Parameters.AddWithValue("entity_id", entityId);

            var result = await cmd.ExecuteScalarAsync();
            return result != null && (bool)result;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncQueueService] Failed to check pending operations: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Removes all pending operations for a specific entity (used when entity is deleted)
    /// </summary>
    public async Task<int> RemoveOperationsForEntityAsync(string entityType, string entityId)
    {
        const string sql = @"
            DELETE FROM sync_queue
            WHERE entity_type = @entity_type
              AND entity_id = @entity_id
              AND status IN ('pending', 'processing')";

        try
        {
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, connection);
            cmd.Parameters.AddWithValue("entity_type", entityType);
            cmd.Parameters.AddWithValue("entity_id", entityId);

            var rowsAffected = await cmd.ExecuteNonQueryAsync();
            System.Diagnostics.Debug.WriteLine($"[SyncQueueService] Removed {rowsAffected} operations for {entityType}/{entityId}");
            return rowsAffected;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncQueueService] Failed to remove operations for entity: {ex.Message}");
            throw;
        }
    }

    #endregion

    #region Helper Methods

    private SyncQueueOperation MapReaderToOperation(NpgsqlDataReader reader)
    {
        var statusStr = reader.GetString(reader.GetOrdinal("status"));
        var status = statusStr.ToLower() switch
        {
            "pending" => SyncOperationStatus.Pending,
            "processing" => SyncOperationStatus.Processing,
            "completed" => SyncOperationStatus.Completed,
            "failed" => SyncOperationStatus.Failed,
            _ => SyncOperationStatus.Pending
        };

        return new SyncQueueOperation
        {
            Id = reader.GetGuid(reader.GetOrdinal("id")),
            EntityType = reader.GetString(reader.GetOrdinal("entity_type")),
            EntityId = reader.GetString(reader.GetOrdinal("entity_id")),
            Operation = reader.GetString(reader.GetOrdinal("operation")),
            Payload = reader.IsDBNull(reader.GetOrdinal("payload")) ? null : reader.GetString(reader.GetOrdinal("payload")),
            CreatedAt = reader.GetDateTime(reader.GetOrdinal("created_at")),
            RetryCount = reader.GetInt32(reader.GetOrdinal("retry_count")),
            LastError = reader.IsDBNull(reader.GetOrdinal("last_error")) ? null : reader.GetString(reader.GetOrdinal("last_error")),
            Status = status
        };
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
    /// Resets the singleton instance (useful for testing)
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
