using JubileeVibes.Core.Interfaces;

namespace JubileeVibes.Infrastructure.Cache;

public class LocalCacheService : ICacheService
{
    private readonly Dictionary<string, CacheEntry> _cache = new();
    private readonly object _lock = new();

    public T? Get<T>(string key) where T : class
    {
        lock (_lock)
        {
            if (_cache.TryGetValue(key, out var entry))
            {
                if (entry.Expiry == null || entry.Expiry > DateTime.UtcNow)
                {
                    return entry.Value as T;
                }

                _cache.Remove(key);
            }
        }

        return null;
    }

    public void Set<T>(string key, T value, TimeSpan? expiry = null) where T : class
    {
        lock (_lock)
        {
            _cache[key] = new CacheEntry
            {
                Value = value,
                Expiry = expiry.HasValue ? DateTime.UtcNow.Add(expiry.Value) : null
            };
        }
    }

    public Task<T?> GetAsync<T>(string key) where T : class
    {
        return Task.FromResult(Get<T>(key));
    }

    public Task SetAsync<T>(string key, T value, TimeSpan? expiry = null) where T : class
    {
        Set(key, value, expiry);
        return Task.CompletedTask;
    }

    public async Task<T?> GetOrSetAsync<T>(string key, Func<Task<T?>> factory, TimeSpan? expiry = null) where T : class
    {
        var existing = Get<T>(key);
        if (existing != null)
            return existing;

        var value = await factory();
        if (value != null)
        {
            Set(key, value, expiry);
        }

        return value;
    }

    public void Remove(string key)
    {
        lock (_lock)
        {
            _cache.Remove(key);
        }
    }

    public void Clear()
    {
        lock (_lock)
        {
            _cache.Clear();
        }
    }

    private class CacheEntry
    {
        public object? Value { get; set; }
        public DateTime? Expiry { get; set; }
    }
}
