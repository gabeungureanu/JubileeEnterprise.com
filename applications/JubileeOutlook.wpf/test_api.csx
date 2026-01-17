#r "nuget: System.Text.Json, 8.0.0"

using System;
using System.Net.Http;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Collections.Generic;
using System.Threading.Tasks;

public class MailFolderDto
{
    public string? Id { get; set; }
    public string? Name { get; set; }
    [JsonPropertyName("folder_type")]
    public string? Type { get; set; }
    public int UnreadCount { get; set; }
    public int TotalCount { get; set; }
    public string? Icon { get; set; }
    public string? ParentFolderId { get; set; }
}

public class ApiFoldersResponse
{
    public List<MailFolderDto>? Folders { get; set; }
}

var client = new HttpClient();
client.DefaultRequestHeaders.Add("X-User-Id", "00000000-0000-0000-0000-000000000001");

var response = await client.GetAsync("http://localhost:3101/api/v1/outlook/folders");
var content = await response.Content.ReadAsStringAsync();

Console.WriteLine($"Status: {response.StatusCode}");
Console.WriteLine($"Content length: {content.Length}");
Console.WriteLine($"First 200 chars: {content.Substring(0, Math.Min(200, content.Length))}");

var options = new JsonSerializerOptions
{
    PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    PropertyNameCaseInsensitive = true
};

try
{
    var result = JsonSerializer.Deserialize<ApiFoldersResponse>(content, options);
    Console.WriteLine($"\nFolders count: {result?.Folders?.Count ?? 0}");
    if (result?.Folders != null)
    {
        foreach (var folder in result.Folders)
        {
            Console.WriteLine($"  - {folder.Name} (Type: {folder.Type}, Id: {folder.Id})");
        }
    }
}
catch (Exception ex)
{
    Console.WriteLine($"\nDeserialization error: {ex.Message}");
}
