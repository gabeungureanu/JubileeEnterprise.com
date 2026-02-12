using System.Net.Http;
using System.Windows.Threading;

namespace JubileeOutlook.Services;

/// <summary>
/// Tracks API rate limit state across the application.
/// Parses Retry-After headers and provides throttle checks.
/// </summary>
public class RateLimitTracker
{
    private static RateLimitTracker? _instance;
    private static readonly object _instanceLock = new();

    private readonly object _stateLock = new();
    private DispatcherTimer? _clearTimer;

    public bool IsRateLimited { get; private set; }
    public int? RetryAfterSeconds { get; private set; }
    public DateTime? RateLimitResetTime { get; private set; }

    /// <summary>
    /// Fired when rate limit state changes (limited or cleared)
    /// </summary>
    public event EventHandler<RateLimitStateChangedEventArgs>? RateLimitStateChanged;

    public static RateLimitTracker Instance
    {
        get
        {
            if (_instance == null)
            {
                lock (_instanceLock)
                {
                    _instance ??= new RateLimitTracker();
                }
            }
            return _instance;
        }
    }

    private RateLimitTracker() { }

    /// <summary>
    /// Records a rate limit from an HTTP 429 response.
    /// Parses Retry-After header (seconds or HTTP-date).
    /// </summary>
    public void RecordRateLimit(HttpResponseMessage response)
    {
        lock (_stateLock)
        {
            int waitSeconds = 60; // Default 60s if no header

            var retryAfterHeader = response.Headers.RetryAfter;
            if (retryAfterHeader != null)
            {
                if (retryAfterHeader.Delta.HasValue)
                {
                    waitSeconds = (int)retryAfterHeader.Delta.Value.TotalSeconds;
                }
                else if (retryAfterHeader.Date.HasValue)
                {
                    var delta = retryAfterHeader.Date.Value - DateTimeOffset.UtcNow;
                    waitSeconds = Math.Max(1, (int)delta.TotalSeconds);
                }
            }

            IsRateLimited = true;
            RetryAfterSeconds = waitSeconds;
            RateLimitResetTime = DateTime.UtcNow.AddSeconds(waitSeconds);

            System.Diagnostics.Debug.WriteLine($"[RateLimitTracker] Rate limited. Retry after {waitSeconds}s, reset at {RateLimitResetTime:HH:mm:ss}");

            // Schedule auto-clear on UI thread
            ScheduleAutoClear(waitSeconds);
        }

        OnRateLimitStateChanged(new RateLimitStateChangedEventArgs
        {
            IsRateLimited = true,
            RetryAfterSeconds = RetryAfterSeconds,
            ResetTime = RateLimitResetTime
        });
    }

    /// <summary>
    /// Records a rate limit with explicit wait time (for use without an HTTP response)
    /// </summary>
    public void RecordRateLimit(int waitSeconds)
    {
        lock (_stateLock)
        {
            IsRateLimited = true;
            RetryAfterSeconds = waitSeconds;
            RateLimitResetTime = DateTime.UtcNow.AddSeconds(waitSeconds);

            ScheduleAutoClear(waitSeconds);
        }

        OnRateLimitStateChanged(new RateLimitStateChangedEventArgs
        {
            IsRateLimited = true,
            RetryAfterSeconds = waitSeconds,
            ResetTime = RateLimitResetTime
        });
    }

    /// <summary>
    /// Returns true if currently rate-limited and reset time hasn't passed
    /// </summary>
    public bool ShouldThrottle()
    {
        lock (_stateLock)
        {
            if (!IsRateLimited) return false;

            if (RateLimitResetTime.HasValue && DateTime.UtcNow >= RateLimitResetTime.Value)
            {
                ClearRateLimitInternal();
                return false;
            }

            return true;
        }
    }

    /// <summary>
    /// Clears rate limit state
    /// </summary>
    public void ClearRateLimit()
    {
        lock (_stateLock)
        {
            ClearRateLimitInternal();
        }

        OnRateLimitStateChanged(new RateLimitStateChangedEventArgs
        {
            IsRateLimited = false,
            RetryAfterSeconds = null,
            ResetTime = null
        });
    }

    private void ClearRateLimitInternal()
    {
        IsRateLimited = false;
        RetryAfterSeconds = null;
        RateLimitResetTime = null;
        _clearTimer?.Stop();
        _clearTimer = null;

        System.Diagnostics.Debug.WriteLine("[RateLimitTracker] Rate limit cleared");
    }

    private void ScheduleAutoClear(int seconds)
    {
        _clearTimer?.Stop();

        try
        {
            System.Windows.Application.Current?.Dispatcher?.BeginInvoke(() =>
            {
                _clearTimer = new DispatcherTimer
                {
                    Interval = TimeSpan.FromSeconds(seconds + 1)
                };
                _clearTimer.Tick += (s, e) =>
                {
                    _clearTimer.Stop();
                    ClearRateLimit();
                };
                _clearTimer.Start();
            });
        }
        catch
        {
            // If no dispatcher available (unit tests), skip auto-clear timer
        }
    }

    private void OnRateLimitStateChanged(RateLimitStateChangedEventArgs args)
    {
        RateLimitStateChanged?.Invoke(this, args);
    }
}

public class RateLimitStateChangedEventArgs : EventArgs
{
    public bool IsRateLimited { get; set; }
    public int? RetryAfterSeconds { get; set; }
    public DateTime? ResetTime { get; set; }
}
