using System.Runtime.Caching;

namespace JubileeFlywheel.Services
{
    public class DataCacheService : IDataCacheService, IDisposable
    {
        private readonly MemoryCache _cache;
        private bool _disposed;

        public DataCacheService()
        {
            _cache = new MemoryCache("JubileeFlywheelCache");
        }

        public T? Get<T>(string key) where T : class
        {
            return _cache.Get(key) as T;
        }

        public void Set<T>(string key, T value, TimeSpan? expiration = null) where T : class
        {
            var policy = new CacheItemPolicy
            {
                AbsoluteExpiration = expiration.HasValue
                    ? DateTimeOffset.Now.Add(expiration.Value)
                    : DateTimeOffset.Now.AddMinutes(10)
            };

            _cache.Set(key, value, policy);
        }

        public void Remove(string key)
        {
            _cache.Remove(key);
        }

        public void Clear()
        {
            var keys = _cache.Select(kvp => kvp.Key).ToList();
            foreach (var key in keys)
            {
                _cache.Remove(key);
            }
        }

        public void Dispose()
        {
            if (!_disposed)
            {
                _cache.Dispose();
                _disposed = true;
            }
            GC.SuppressFinalize(this);
        }
    }
}
