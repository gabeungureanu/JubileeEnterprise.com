using System;
using System.Collections.Concurrent;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace JubileeMusic.Services;

public class FileLoggingService : ILoggingService, IDisposable
{
    private readonly string _logFilePath;
    private readonly ConcurrentQueue<string> _logQueue = new();
    private readonly SemaphoreSlim _writeLock = new(1, 1);
    private readonly CancellationTokenSource _cts = new();
    private readonly Task _writerTask;
    private bool _disposed;

    public FileLoggingService()
    {
        var logDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "JubileeMusic",
            "Logs"
        );

        Directory.CreateDirectory(logDir);

        var logFileName = $"JubileeMusic_{DateTime.Now:yyyyMMdd}.log";
        _logFilePath = Path.Combine(logDir, logFileName);

        // Start background writer task
        _writerTask = Task.Run(ProcessLogQueueAsync);

        LogInfo("=== JubileeMusic Started ===");
    }

    public void LogInfo(string message, params object[] args)
    {
        EnqueueLog("INFO", message, args);
    }

    public void LogWarning(string message, params object[] args)
    {
        EnqueueLog("WARN", message, args);
    }

    public void LogError(string message, Exception? exception = null, params object[] args)
    {
        var formattedMessage = args.Length > 0 ? string.Format(message, args) : message;

        if (exception != null)
        {
            // Never log credentials - sanitize exception messages
            var sanitizedEx = SanitizeForLogging(exception.ToString());
            formattedMessage += $"\n  Exception: {sanitizedEx}";
        }

        EnqueueLog("ERROR", formattedMessage);
    }

    public void LogDebug(string message, params object[] args)
    {
#if DEBUG
        EnqueueLog("DEBUG", message, args);
#endif
    }

    public string GetLogFilePath() => _logFilePath;

    public async Task<string> GetRecentLogsAsync(int lineCount = 100)
    {
        await _writeLock.WaitAsync();
        try
        {
            if (!File.Exists(_logFilePath))
            {
                return "No log file found.";
            }

            var lines = await File.ReadAllLinesAsync(_logFilePath);
            var recentLines = lines.Skip(Math.Max(0, lines.Length - lineCount));
            return string.Join(Environment.NewLine, recentLines);
        }
        finally
        {
            _writeLock.Release();
        }
    }

    private void EnqueueLog(string level, string message, params object[] args)
    {
        var formattedMessage = args.Length > 0 ? string.Format(message, args) : message;

        // Sanitize message to remove any potential credentials
        formattedMessage = SanitizeForLogging(formattedMessage);

        var timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff");
        var logEntry = $"[{timestamp}] [{level,-5}] {formattedMessage}";

        _logQueue.Enqueue(logEntry);
    }

    private async Task ProcessLogQueueAsync()
    {
        var buffer = new StringBuilder();

        while (!_cts.Token.IsCancellationRequested)
        {
            try
            {
                // Collect entries from queue
                while (_logQueue.TryDequeue(out var entry))
                {
                    buffer.AppendLine(entry);
                }

                // Write batch to file
                if (buffer.Length > 0)
                {
                    await _writeLock.WaitAsync(_cts.Token);
                    try
                    {
                        await File.AppendAllTextAsync(_logFilePath, buffer.ToString(), _cts.Token);
                        buffer.Clear();
                    }
                    finally
                    {
                        _writeLock.Release();
                    }
                }

                // Wait before next batch
                await Task.Delay(100, _cts.Token);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch
            {
                // Continue logging even if there's an error
            }
        }

        // Flush remaining logs on shutdown
        while (_logQueue.TryDequeue(out var entry))
        {
            buffer.AppendLine(entry);
        }

        if (buffer.Length > 0)
        {
            try
            {
                await File.AppendAllTextAsync(_logFilePath, buffer.ToString());
            }
            catch
            {
                // Ignore errors on shutdown
            }
        }
    }

    private static string SanitizeForLogging(string text)
    {
        // Remove potential passwords and tokens from log entries
        var patterns = new[]
        {
            (@"password[""'\s:=]+[^\s,;""'}\]]+", "password=***"),
            (@"token[""'\s:=]+[^\s,;""'}\]]+", "token=***"),
            (@"secret[""'\s:=]+[^\s,;""'}\]]+", "secret=***"),
            (@"api[_-]?key[""'\s:=]+[^\s,;""'}\]]+", "api_key=***"),
            (@"authorization[""'\s:=]+[^\s,;""'}\]]+", "authorization=***"),
        };

        var result = text;
        foreach (var (pattern, replacement) in patterns)
        {
            result = System.Text.RegularExpressions.Regex.Replace(
                result,
                pattern,
                replacement,
                System.Text.RegularExpressions.RegexOptions.IgnoreCase
            );
        }

        return result;
    }

    public void Dispose()
    {
        if (_disposed) return;

        _disposed = true;
        LogInfo("=== JubileeMusic Shutdown ===");

        _cts.Cancel();

        try
        {
            _writerTask.Wait(TimeSpan.FromSeconds(2));
        }
        catch
        {
            // Ignore errors on dispose
        }

        _cts.Dispose();
        _writeLock.Dispose();
    }
}
