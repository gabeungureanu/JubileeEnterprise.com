using Microsoft.Extensions.Logging;

namespace JubileeMusic.Services;

public class FileLoggerProvider : ILoggerProvider
{
    private readonly FileLoggingService _loggingService;

    public FileLoggerProvider()
    {
        _loggingService = new FileLoggingService();
    }

    public ILogger CreateLogger(string categoryName)
    {
        return new FileLogger(categoryName, _loggingService);
    }

    public void Dispose()
    {
        _loggingService.Dispose();
    }
}

public class FileLogger : ILogger
{
    private readonly string _categoryName;
    private readonly FileLoggingService _loggingService;

    public FileLogger(string categoryName, FileLoggingService loggingService)
    {
        _categoryName = categoryName;
        _loggingService = loggingService;
    }

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull
    {
        return null;
    }

    public bool IsEnabled(LogLevel logLevel)
    {
        return logLevel >= LogLevel.Information;
    }

    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
    {
        if (!IsEnabled(logLevel))
        {
            return;
        }

        var message = $"[{_categoryName}] {formatter(state, exception)}";

        switch (logLevel)
        {
            case LogLevel.Error:
            case LogLevel.Critical:
                _loggingService.LogError(message, exception);
                break;
            case LogLevel.Warning:
                _loggingService.LogWarning(message);
                break;
            case LogLevel.Debug:
            case LogLevel.Trace:
                _loggingService.LogDebug(message);
                break;
            default:
                _loggingService.LogInfo(message);
                break;
        }
    }
}
