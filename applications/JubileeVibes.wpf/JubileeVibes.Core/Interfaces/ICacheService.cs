namespace JubileeVibes.Core.Interfaces;

public interface ICacheService
{
    T? Get<T>(string key) where T : class;
    void Set<T>(string key, T value, TimeSpan? expiry = null) where T : class;
    Task<T?> GetAsync<T>(string key) where T : class;
    Task SetAsync<T>(string key, T value, TimeSpan? expiry = null) where T : class;
    Task<T?> GetOrSetAsync<T>(string key, Func<Task<T?>> factory, TimeSpan? expiry = null) where T : class;
    void Remove(string key);
    void Clear();
}
