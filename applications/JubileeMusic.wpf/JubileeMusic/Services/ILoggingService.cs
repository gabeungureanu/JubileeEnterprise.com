namespace JubileeMusic.Services;

public interface ILoggingService
{
    void LogInfo(string message, params object[] args);
    void LogWarning(string message, params object[] args);
    void LogError(string message, Exception? exception = null, params object[] args);
    void LogDebug(string message, params object[] args);
    string GetLogFilePath();
    Task<string> GetRecentLogsAsync(int lineCount = 100);
}
