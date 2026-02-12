using System.Net;
using System.Net.Http;
using Polly;
using Polly.Retry;

namespace JubileeOutlook.Services;

/// <summary>
/// Centralized resilience policy service using Polly
/// Provides retry policies for handling transient failures
/// </summary>
public class ResiliencePolicyService
{
    private static ResiliencePolicyService? _instance;
    private static readonly object _lock = new();

    private readonly ResiliencePipeline<HttpResponseMessage> _httpRetryPipeline;
    private readonly ResiliencePipeline _generalRetryPipeline;

    /// <summary>
    /// Event fired when a retry attempt is made
    /// </summary>
    public event EventHandler<RetryEventArgs>? RetryAttempted;

    /// <summary>
    /// Event fired when all retries are exhausted
    /// </summary>
    public event EventHandler<RetryExhaustedEventArgs>? RetriesExhausted;

    /// <summary>
    /// Event fired when a 429 rate limit is detected
    /// </summary>
    public event EventHandler<RateLimitDetectedEventArgs>? RateLimitDetected;

    /// <summary>
    /// Singleton instance of the resilience policy service
    /// </summary>
    public static ResiliencePolicyService Instance
    {
        get
        {
            if (_instance == null)
            {
                lock (_lock)
                {
                    _instance ??= new ResiliencePolicyService();
                }
            }
            return _instance;
        }
    }

    private ResiliencePolicyService()
    {
        var config = ConfigurationService.Instance;
        var retryCount = config.Api.RetryPolicy.MaxRetries;
        var initialDelay = config.Api.RetryPolicy.InitialDelayMs;
        var maxDelay = config.Api.RetryPolicy.MaxDelayMs;

        // Create HTTP-specific retry pipeline
        _httpRetryPipeline = new ResiliencePipelineBuilder<HttpResponseMessage>()
            .AddRetry(new RetryStrategyOptions<HttpResponseMessage>
            {
                ShouldHandle = new PredicateBuilder<HttpResponseMessage>()
                    .Handle<HttpRequestException>()
                    .Handle<TaskCanceledException>()
                    .Handle<TimeoutException>()
                    .HandleResult(response => IsTransientHttpError(response)),
                MaxRetryAttempts = retryCount,
                Delay = TimeSpan.FromMilliseconds(initialDelay),
                MaxDelay = TimeSpan.FromMilliseconds(maxDelay),
                BackoffType = DelayBackoffType.Exponential,
                UseJitter = true,
                OnRetry = args =>
                {
                    var message = GetRetryMessage(args.Outcome, args.AttemptNumber, retryCount);
                    System.Diagnostics.Debug.WriteLine($"[Retry] Attempt {args.AttemptNumber + 1}/{retryCount}: {message}");

                    // Detect 429 and record with RateLimitTracker
                    if (args.Outcome.Result?.StatusCode == HttpStatusCode.TooManyRequests)
                    {
                        RateLimitTracker.Instance.RecordRateLimit(args.Outcome.Result);
                        OnRateLimitDetected(new RateLimitDetectedEventArgs
                        {
                            RetryAfterSeconds = RateLimitTracker.Instance.RetryAfterSeconds,
                            ResetTime = RateLimitTracker.Instance.RateLimitResetTime
                        });
                    }

                    OnRetryAttempted(new RetryEventArgs
                    {
                        AttemptNumber = args.AttemptNumber + 1,
                        MaxAttempts = retryCount,
                        Delay = args.RetryDelay,
                        Reason = message
                    });

                    return ValueTask.CompletedTask;
                }
            })
            .Build();

        // Create general retry pipeline for non-HTTP operations
        _generalRetryPipeline = new ResiliencePipelineBuilder()
            .AddRetry(new RetryStrategyOptions
            {
                ShouldHandle = new PredicateBuilder()
                    .Handle<Exception>(ex => IsTransientException(ex)),
                MaxRetryAttempts = retryCount,
                Delay = TimeSpan.FromMilliseconds(initialDelay),
                MaxDelay = TimeSpan.FromMilliseconds(maxDelay),
                BackoffType = DelayBackoffType.Exponential,
                UseJitter = true,
                OnRetry = args =>
                {
                    var message = args.Outcome.Exception?.Message ?? "Unknown error";
                    System.Diagnostics.Debug.WriteLine($"[Retry] General attempt {args.AttemptNumber + 1}/{retryCount}: {message}");

                    OnRetryAttempted(new RetryEventArgs
                    {
                        AttemptNumber = args.AttemptNumber + 1,
                        MaxAttempts = retryCount,
                        Delay = args.RetryDelay,
                        Reason = message
                    });

                    return ValueTask.CompletedTask;
                }
            })
            .Build();

        System.Diagnostics.Debug.WriteLine($"ResiliencePolicyService initialized: MaxRetries={retryCount}, InitialDelay={initialDelay}ms, MaxDelay={maxDelay}ms");
    }

    /// <summary>
    /// Executes an HTTP request with retry policy
    /// </summary>
    public async Task<HttpResponseMessage> ExecuteHttpAsync(Func<CancellationToken, Task<HttpResponseMessage>> action, CancellationToken cancellationToken = default)
    {
        try
        {
            return await _httpRetryPipeline.ExecuteAsync(
                async (ct) => await action(ct),
                cancellationToken);
        }
        catch (Exception ex)
        {
            OnRetriesExhausted(new RetryExhaustedEventArgs
            {
                Exception = ex,
                FriendlyMessage = GetFriendlyErrorMessage(ex)
            });
            throw;
        }
    }

    /// <summary>
    /// Executes a general operation with retry policy
    /// </summary>
    public async Task<T> ExecuteAsync<T>(Func<CancellationToken, ValueTask<T>> action, CancellationToken cancellationToken = default)
    {
        try
        {
            return await _generalRetryPipeline.ExecuteAsync(action, cancellationToken);
        }
        catch (Exception ex)
        {
            OnRetriesExhausted(new RetryExhaustedEventArgs
            {
                Exception = ex,
                FriendlyMessage = GetFriendlyErrorMessage(ex)
            });
            throw;
        }
    }

    /// <summary>
    /// Executes a general operation with retry policy (non-generic)
    /// </summary>
    public async Task ExecuteAsync(Func<CancellationToken, ValueTask> action, CancellationToken cancellationToken = default)
    {
        try
        {
            await _generalRetryPipeline.ExecuteAsync(action, cancellationToken);
        }
        catch (Exception ex)
        {
            OnRetriesExhausted(new RetryExhaustedEventArgs
            {
                Exception = ex,
                FriendlyMessage = GetFriendlyErrorMessage(ex)
            });
            throw;
        }
    }

    /// <summary>
    /// Determines if an HTTP response represents a transient error
    /// </summary>
    private static bool IsTransientHttpError(HttpResponseMessage response)
    {
        // Retry on server errors (5xx) and specific client errors
        return response.StatusCode >= HttpStatusCode.InternalServerError ||
               response.StatusCode == HttpStatusCode.RequestTimeout ||
               response.StatusCode == HttpStatusCode.TooManyRequests ||
               response.StatusCode == HttpStatusCode.ServiceUnavailable ||
               response.StatusCode == HttpStatusCode.GatewayTimeout ||
               response.StatusCode == HttpStatusCode.BadGateway;
    }

    /// <summary>
    /// Determines if an exception is transient and should be retried
    /// </summary>
    private static bool IsTransientException(Exception ex)
    {
        return ex is HttpRequestException ||
               ex is TaskCanceledException ||
               ex is TimeoutException ||
               ex is System.Net.Sockets.SocketException ||
               ex is System.IO.IOException;
    }

    /// <summary>
    /// Gets a message describing the retry reason
    /// </summary>
    private static string GetRetryMessage(Outcome<HttpResponseMessage> outcome, int attemptNumber, int maxAttempts)
    {
        if (outcome.Exception != null)
        {
            return $"{outcome.Exception.GetType().Name}: {outcome.Exception.Message}";
        }

        if (outcome.Result != null)
        {
            return $"HTTP {(int)outcome.Result.StatusCode} {outcome.Result.StatusCode}";
        }

        return "Unknown error";
    }

    /// <summary>
    /// Gets a user-friendly error message for an exception
    /// </summary>
    public static string GetFriendlyErrorMessage(Exception ex)
    {
        return ex switch
        {
            HttpRequestException httpEx when httpEx.Message.Contains("No such host") =>
                "Unable to reach the server. Please check your internet connection.",

            HttpRequestException httpEx when httpEx.Message.Contains("Connection refused") =>
                "The server is not responding. Please try again later.",

            HttpRequestException =>
                "A network error occurred. Please check your internet connection and try again.",

            TaskCanceledException when ex.InnerException is TimeoutException =>
                "The request timed out. Please try again.",

            TaskCanceledException =>
                "The operation was cancelled. Please try again.",

            TimeoutException =>
                "The server took too long to respond. Please try again.",

            System.Net.Sockets.SocketException =>
                "Unable to connect to the server. Please check your network connection.",

            System.IO.IOException =>
                "A communication error occurred. Please try again.",

            _ => "An unexpected error occurred. Please try again later."
        };
    }

    /// <summary>
    /// Gets a user-friendly error message for an HTTP status code
    /// </summary>
    public static string GetFriendlyErrorMessage(HttpStatusCode statusCode)
    {
        return statusCode switch
        {
            HttpStatusCode.BadRequest => "The request was invalid. Please check your input and try again.",
            HttpStatusCode.Unauthorized => "Your session has expired. Please sign in again.",
            HttpStatusCode.Forbidden => "You don't have permission to perform this action.",
            HttpStatusCode.NotFound => "The requested item was not found.",
            HttpStatusCode.RequestTimeout => "The request timed out. Please try again.",
            HttpStatusCode.Conflict => "There was a conflict with the current state. Please refresh and try again.",
            HttpStatusCode.Gone => "The requested resource is no longer available.",
            HttpStatusCode.TooManyRequests => RateLimitTracker.Instance.RetryAfterSeconds.HasValue
                ? $"Too many requests. Please wait {RateLimitTracker.Instance.RetryAfterSeconds}s and try again."
                : "Too many requests. Please wait a moment and try again.",
            HttpStatusCode.InternalServerError => "A server error occurred. Please try again later.",
            HttpStatusCode.BadGateway => "The server is temporarily unavailable. Please try again later.",
            HttpStatusCode.ServiceUnavailable => "The service is temporarily unavailable. Please try again later.",
            HttpStatusCode.GatewayTimeout => "The server took too long to respond. Please try again.",
            _ when (int)statusCode >= 500 => "A server error occurred. Please try again later.",
            _ => $"An error occurred (Error {(int)statusCode}). Please try again."
        };
    }

    private void OnRetryAttempted(RetryEventArgs args)
    {
        RetryAttempted?.Invoke(this, args);
    }

    private void OnRetriesExhausted(RetryExhaustedEventArgs args)
    {
        RetriesExhausted?.Invoke(this, args);
    }

    private void OnRateLimitDetected(RateLimitDetectedEventArgs args)
    {
        RateLimitDetected?.Invoke(this, args);
    }
}

/// <summary>
/// Event arguments for retry attempts
/// </summary>
public class RetryEventArgs : EventArgs
{
    public int AttemptNumber { get; set; }
    public int MaxAttempts { get; set; }
    public TimeSpan Delay { get; set; }
    public string Reason { get; set; } = string.Empty;
}

/// <summary>
/// Event arguments for when retries are exhausted
/// </summary>
public class RetryExhaustedEventArgs : EventArgs
{
    public Exception? Exception { get; set; }
    public string FriendlyMessage { get; set; } = string.Empty;
}

/// <summary>
/// Event arguments for rate limit detection (HTTP 429)
/// </summary>
public class RateLimitDetectedEventArgs : EventArgs
{
    public int? RetryAfterSeconds { get; set; }
    public DateTime? ResetTime { get; set; }
}
