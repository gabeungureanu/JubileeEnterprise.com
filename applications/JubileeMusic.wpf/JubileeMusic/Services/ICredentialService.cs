using System.Threading.Tasks;
using JubileeMusic.Models;

namespace JubileeMusic.Services;

public interface ICredentialService
{
    void Initialize();
    Task<SunoCredentials?> GetCredentialsAsync();
    Task<bool> HasStoredCredentialsAsync();
    Task SaveCredentialsAsync(SunoCredentials credentials);
    Task DeleteCredentialsAsync();
    Task<SunoCredentials?> LoadFromConfigFileAsync(string path);
    bool HasStoredCredentials { get; }
    bool IsAuthenticated { get; set; }
}
