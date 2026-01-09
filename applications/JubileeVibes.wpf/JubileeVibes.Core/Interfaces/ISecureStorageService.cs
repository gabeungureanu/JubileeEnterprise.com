namespace JubileeVibes.Core.Interfaces;

public interface ISecureStorageService
{
    Task<string?> GetAsync(string key);
    Task SetAsync(string key, string value);
    Task RemoveAsync(string key);
    Task<bool> ContainsKeyAsync(string key);
    Task ClearAllAsync();
}
