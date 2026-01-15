using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Text.Json.Serialization;
using JubileeOutlook.Models;

namespace JubileeOutlook.Services;

/// <summary>
/// API service for mail operations via InspireContinuum API
/// Uses HttpClientFactory for centralized HTTP client management with auto-auth
/// </summary>
public class ApiMailService : IMailService
{
    private static ApiMailService? _instance;
    private static readonly object _lock = new();

    private readonly HttpClientFactory _httpClientFactory;
    private readonly ConfigurationService _config;
    private readonly JsonSerializerOptions _jsonOptions;

    // Cached folders for GetFolders() synchronous call
    private List<MailFolder> _cachedFolders = new();
    private DateTime _foldersCacheTime = DateTime.MinValue;
    private readonly TimeSpan _foldersCacheDuration = TimeSpan.FromMinutes(5);

    /// <summary>
    /// Singleton instance of the mail service
    /// </summary>
    public static ApiMailService Instance
    {
        get
        {
            if (_instance == null)
            {
                lock (_lock)
                {
                    _instance ??= new ApiMailService();
                }
            }
            return _instance;
        }
    }

    public ApiMailService()
    {
        _httpClientFactory = HttpClientFactory.Instance;
        _config = ConfigurationService.Instance;

        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
        };

        System.Diagnostics.Debug.WriteLine($"[ApiMailService] Initialized with HttpClientFactory");
        System.Diagnostics.Debug.WriteLine($"[ApiMailService] InspireContinuum API: {_config.Api.InspireContinuum.BaseUrl}");
    }

    #region IMailService Implementation

    /// <summary>
    /// Gets mail folders (synchronous, uses cache)
    /// </summary>
    public List<MailFolder> GetFolders()
    {
        // Return cached folders if still valid
        if (_cachedFolders.Count > 0 && DateTime.UtcNow - _foldersCacheTime < _foldersCacheDuration)
        {
            return _cachedFolders;
        }

        // Trigger async refresh but return current cache
        _ = RefreshFoldersCacheAsync();
        return _cachedFolders;
    }

    /// <summary>
    /// Gets messages for a folder
    /// GET /api/outlook/messages?folderId={folderId}
    /// </summary>
    public async Task<List<EmailMessage>> GetMessagesAsync(string folderId)
    {
        var result = await GetMessagesWithResultAsync(folderId);
        return result.Data ?? new List<EmailMessage>();
    }

    /// <summary>
    /// Gets a single message by ID
    /// GET /api/outlook/messages/{id}
    /// </summary>
    public async Task<EmailMessage?> GetMessageByIdAsync(string messageId)
    {
        var result = await GetMessageByIdWithResultAsync(messageId);
        return result.Data;
    }

    /// <summary>
    /// Sends a new message
    /// POST /api/outlook/messages
    /// </summary>
    public async Task SendMessageAsync(EmailMessage message)
    {
        await SendMessageWithResultAsync(message);
    }

    /// <summary>
    /// Deletes a message
    /// DELETE /api/outlook/messages/{id}
    /// </summary>
    public async Task DeleteMessageAsync(string messageId)
    {
        await DeleteMessageWithResultAsync(messageId);
    }

    /// <summary>
    /// Moves a message to a different folder
    /// PUT /api/outlook/messages/{id}/move
    /// </summary>
    public async Task MoveMessageAsync(string messageId, string targetFolderId)
    {
        await MoveMessageWithResultAsync(messageId, targetFolderId);
    }

    /// <summary>
    /// Marks a message as read/unread
    /// PUT /api/outlook/messages/{id}/read
    /// </summary>
    public async Task MarkAsReadAsync(string messageId, bool isRead)
    {
        await MarkAsReadWithResultAsync(messageId, isRead);
    }

    /// <summary>
    /// Toggles the flag status of a message
    /// PUT /api/outlook/messages/{id}/flag
    /// </summary>
    public async Task ToggleFlagAsync(string messageId)
    {
        await ToggleFlagWithResultAsync(messageId);
    }

    /// <summary>
    /// Searches messages
    /// GET /api/outlook/messages/search?q={query}
    /// </summary>
    public async Task<List<EmailMessage>> SearchMessagesAsync(string query)
    {
        var result = await SearchMessagesWithResultAsync(query);
        return result.Data ?? new List<EmailMessage>();
    }

    #endregion

    #region Extended Methods with Result Objects

    /// <summary>
    /// Gets mail folders with detailed result
    /// GET /api/outlook/folders
    /// </summary>
    public async Task<MailServiceResult<List<MailFolder>>> GetFoldersWithResultAsync()
    {
        try
        {
            var endpoint = "outlook/folders";
            System.Diagnostics.Debug.WriteLine($"[ApiMailService] GET {endpoint}");

            var response = await _httpClientFactory.GetAsync(ApiEndpoint.InspireContinuum, endpoint);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                // Try API response wrapper first
                try
                {
                    var apiResponse = JsonSerializer.Deserialize<ApiFoldersResponse>(content, _jsonOptions);
                    if (apiResponse?.Folders != null)
                    {
                        var folders = apiResponse.Folders.Select(MapToMailFolder).ToList();
                        System.Diagnostics.Debug.WriteLine($"[ApiMailService] Retrieved {folders.Count} folders");

                        // Update cache
                        _cachedFolders = folders;
                        _foldersCacheTime = DateTime.UtcNow;

                        return new MailServiceResult<List<MailFolder>>
                        {
                            Success = true,
                            Data = folders
                        };
                    }
                }
                catch { }

                // Try direct list parsing
                var directFolders = JsonSerializer.Deserialize<List<MailFolderDto>>(content, _jsonOptions);
                if (directFolders != null)
                {
                    var folders = directFolders.Select(MapToMailFolder).ToList();
                    System.Diagnostics.Debug.WriteLine($"[ApiMailService] Retrieved {folders.Count} folders (direct)");

                    // Update cache
                    _cachedFolders = folders;
                    _foldersCacheTime = DateTime.UtcNow;

                    return new MailServiceResult<List<MailFolder>>
                    {
                        Success = true,
                        Data = folders
                    };
                }

                return new MailServiceResult<List<MailFolder>>
                {
                    Success = false,
                    Error = "Failed to parse folders response",
                    Data = new List<MailFolder>()
                };
            }

            System.Diagnostics.Debug.WriteLine($"[ApiMailService] GET folders failed: {response.StatusCode}");
            return new MailServiceResult<List<MailFolder>>
            {
                Success = false,
                Error = $"Failed to get folders: {response.StatusCode}",
                StatusCode = response.StatusCode,
                Data = new List<MailFolder>()
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiMailService] GetFolders error: {ex.Message}");
            return new MailServiceResult<List<MailFolder>>
            {
                Success = false,
                Error = ex.Message,
                Data = new List<MailFolder>()
            };
        }
    }

    /// <summary>
    /// Gets messages for a folder with detailed result
    /// GET /api/outlook/messages?folderId={folderId}
    /// </summary>
    public async Task<MailServiceResult<List<EmailMessage>>> GetMessagesWithResultAsync(
        string folderId,
        int page = 1,
        int pageSize = 50,
        string? sortBy = null,
        bool descending = true)
    {
        try
        {
            var queryParams = new List<string>();

            if (!string.IsNullOrEmpty(folderId))
                queryParams.Add($"folderId={Uri.EscapeDataString(folderId)}");

            queryParams.Add($"page={page}");
            queryParams.Add($"pageSize={pageSize}");

            if (!string.IsNullOrEmpty(sortBy))
            {
                queryParams.Add($"sortBy={Uri.EscapeDataString(sortBy)}");
                queryParams.Add($"descending={descending.ToString().ToLower()}");
            }

            var endpoint = $"outlook/messages?{string.Join("&", queryParams)}";
            System.Diagnostics.Debug.WriteLine($"[ApiMailService] GET {endpoint}");

            var response = await _httpClientFactory.GetAsync(ApiEndpoint.InspireContinuum, endpoint);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                // Try API response wrapper first
                try
                {
                    var apiResponse = JsonSerializer.Deserialize<ApiMessagesResponse>(content, _jsonOptions);
                    if (apiResponse?.Messages != null)
                    {
                        var messages = apiResponse.Messages.Select(MapToEmailMessage).ToList();
                        System.Diagnostics.Debug.WriteLine($"[ApiMailService] Retrieved {messages.Count} messages");
                        return new MailServiceResult<List<EmailMessage>>
                        {
                            Success = true,
                            Data = messages,
                            TotalCount = apiResponse.TotalCount
                        };
                    }
                }
                catch { }

                // Try direct list parsing
                var directMessages = JsonSerializer.Deserialize<List<EmailMessageDto>>(content, _jsonOptions);
                if (directMessages != null)
                {
                    var messages = directMessages.Select(MapToEmailMessage).ToList();
                    System.Diagnostics.Debug.WriteLine($"[ApiMailService] Retrieved {messages.Count} messages (direct)");
                    return new MailServiceResult<List<EmailMessage>>
                    {
                        Success = true,
                        Data = messages
                    };
                }

                return new MailServiceResult<List<EmailMessage>>
                {
                    Success = false,
                    Error = "Failed to parse messages response",
                    Data = new List<EmailMessage>()
                };
            }

            System.Diagnostics.Debug.WriteLine($"[ApiMailService] GET messages failed: {response.StatusCode}");
            return new MailServiceResult<List<EmailMessage>>
            {
                Success = false,
                Error = $"Failed to get messages: {response.StatusCode}",
                StatusCode = response.StatusCode,
                Data = new List<EmailMessage>()
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiMailService] GetMessages error: {ex.Message}");
            return new MailServiceResult<List<EmailMessage>>
            {
                Success = false,
                Error = ex.Message,
                Data = new List<EmailMessage>()
            };
        }
    }

    /// <summary>
    /// Gets a single message by ID with detailed result
    /// GET /api/outlook/messages/{id}
    /// </summary>
    public async Task<MailServiceResult<EmailMessage>> GetMessageByIdWithResultAsync(string messageId)
    {
        try
        {
            if (string.IsNullOrEmpty(messageId))
            {
                return new MailServiceResult<EmailMessage>
                {
                    Success = false,
                    Error = "Message ID is required"
                };
            }

            var endpoint = $"outlook/messages/{Uri.EscapeDataString(messageId)}";
            System.Diagnostics.Debug.WriteLine($"[ApiMailService] GET {endpoint}");

            var response = await _httpClientFactory.GetAsync(ApiEndpoint.InspireContinuum, endpoint);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                // Try API response wrapper first
                try
                {
                    var apiResponse = JsonSerializer.Deserialize<ApiMessageSingleResponse>(content, _jsonOptions);
                    if (apiResponse?.Message != null)
                    {
                        return new MailServiceResult<EmailMessage>
                        {
                            Success = true,
                            Data = MapToEmailMessage(apiResponse.Message)
                        };
                    }
                }
                catch { }

                // Try direct parsing
                var dto = JsonSerializer.Deserialize<EmailMessageDto>(content, _jsonOptions);
                if (dto != null)
                {
                    return new MailServiceResult<EmailMessage>
                    {
                        Success = true,
                        Data = MapToEmailMessage(dto)
                    };
                }

                return new MailServiceResult<EmailMessage>
                {
                    Success = false,
                    Error = "Failed to parse message response"
                };
            }

            return new MailServiceResult<EmailMessage>
            {
                Success = false,
                Error = $"Failed to get message: {response.StatusCode}",
                StatusCode = response.StatusCode
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiMailService] GetMessageById error: {ex.Message}");
            return new MailServiceResult<EmailMessage>
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    /// <summary>
    /// Sends a message with detailed result
    /// POST /api/outlook/messages
    /// </summary>
    public async Task<MailServiceResult<EmailMessage>> SendMessageWithResultAsync(EmailMessage message)
    {
        try
        {
            if (message == null)
            {
                return new MailServiceResult<EmailMessage>
                {
                    Success = false,
                    Error = "Message is required"
                };
            }

            var dto = MapToDto(message);
            var endpoint = "outlook/messages";

            System.Diagnostics.Debug.WriteLine($"[ApiMailService] POST {endpoint} - {message.Subject}");

            var response = await _httpClientFactory.PostAsync(ApiEndpoint.InspireContinuum, endpoint, dto);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                // Try API response wrapper first
                try
                {
                    var apiResponse = JsonSerializer.Deserialize<ApiMessageSingleResponse>(content, _jsonOptions);
                    if (apiResponse?.Message != null)
                    {
                        var sentMessage = MapToEmailMessage(apiResponse.Message);
                        System.Diagnostics.Debug.WriteLine($"[ApiMailService] Sent message: {sentMessage.Id}");
                        return new MailServiceResult<EmailMessage>
                        {
                            Success = true,
                            Data = sentMessage
                        };
                    }
                }
                catch { }

                // Try direct parsing
                var sentDto = JsonSerializer.Deserialize<EmailMessageDto>(content, _jsonOptions);
                if (sentDto != null)
                {
                    var sentMessage = MapToEmailMessage(sentDto);
                    System.Diagnostics.Debug.WriteLine($"[ApiMailService] Sent message: {sentMessage.Id}");
                    return new MailServiceResult<EmailMessage>
                    {
                        Success = true,
                        Data = sentMessage
                    };
                }

                // If no response body, return original with success
                System.Diagnostics.Debug.WriteLine($"[ApiMailService] Message sent successfully");
                return new MailServiceResult<EmailMessage>
                {
                    Success = true,
                    Data = message
                };
            }

            System.Diagnostics.Debug.WriteLine($"[ApiMailService] Send failed: {response.StatusCode} - {content}");
            return new MailServiceResult<EmailMessage>
            {
                Success = false,
                Error = $"Failed to send message: {response.StatusCode}",
                StatusCode = response.StatusCode
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiMailService] SendMessage error: {ex.Message}");
            return new MailServiceResult<EmailMessage>
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    /// <summary>
    /// Deletes a message with detailed result
    /// DELETE /api/outlook/messages/{id}
    /// </summary>
    public async Task<MailServiceResult<bool>> DeleteMessageWithResultAsync(string messageId)
    {
        try
        {
            if (string.IsNullOrEmpty(messageId))
            {
                return new MailServiceResult<bool>
                {
                    Success = false,
                    Error = "Message ID is required",
                    Data = false
                };
            }

            var endpoint = $"outlook/messages/{Uri.EscapeDataString(messageId)}";
            System.Diagnostics.Debug.WriteLine($"[ApiMailService] DELETE {endpoint}");

            var response = await _httpClientFactory.DeleteAsync(ApiEndpoint.InspireContinuum, endpoint);

            if (response.IsSuccessStatusCode)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiMailService] Deleted message: {messageId}");
                return new MailServiceResult<bool>
                {
                    Success = true,
                    Data = true
                };
            }

            // 404 is acceptable - message may already be deleted
            if (response.StatusCode == HttpStatusCode.NotFound)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiMailService] Message not found (already deleted?): {messageId}");
                return new MailServiceResult<bool>
                {
                    Success = true,
                    Data = true,
                    Error = "Message not found"
                };
            }

            var content = await response.Content.ReadAsStringAsync();
            System.Diagnostics.Debug.WriteLine($"[ApiMailService] Delete failed: {response.StatusCode} - {content}");

            return new MailServiceResult<bool>
            {
                Success = false,
                Error = $"Failed to delete message: {response.StatusCode}",
                StatusCode = response.StatusCode,
                Data = false
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiMailService] DeleteMessage error: {ex.Message}");
            return new MailServiceResult<bool>
            {
                Success = false,
                Error = ex.Message,
                Data = false
            };
        }
    }

    /// <summary>
    /// Moves a message to a different folder with detailed result
    /// PUT /api/outlook/messages/{id}/move
    /// </summary>
    public async Task<MailServiceResult<bool>> MoveMessageWithResultAsync(string messageId, string targetFolderId)
    {
        try
        {
            if (string.IsNullOrEmpty(messageId))
            {
                return new MailServiceResult<bool>
                {
                    Success = false,
                    Error = "Message ID is required",
                    Data = false
                };
            }

            if (string.IsNullOrEmpty(targetFolderId))
            {
                return new MailServiceResult<bool>
                {
                    Success = false,
                    Error = "Target folder ID is required",
                    Data = false
                };
            }

            var endpoint = $"outlook/messages/{Uri.EscapeDataString(messageId)}/move";
            var payload = new { targetFolderId };

            System.Diagnostics.Debug.WriteLine($"[ApiMailService] PUT {endpoint} -> {targetFolderId}");

            var response = await _httpClientFactory.PutAsync(ApiEndpoint.InspireContinuum, endpoint, payload);

            if (response.IsSuccessStatusCode)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiMailService] Moved message {messageId} to {targetFolderId}");
                return new MailServiceResult<bool>
                {
                    Success = true,
                    Data = true
                };
            }

            var content = await response.Content.ReadAsStringAsync();
            System.Diagnostics.Debug.WriteLine($"[ApiMailService] Move failed: {response.StatusCode} - {content}");

            return new MailServiceResult<bool>
            {
                Success = false,
                Error = $"Failed to move message: {response.StatusCode}",
                StatusCode = response.StatusCode,
                Data = false
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiMailService] MoveMessage error: {ex.Message}");
            return new MailServiceResult<bool>
            {
                Success = false,
                Error = ex.Message,
                Data = false
            };
        }
    }

    /// <summary>
    /// Marks a message as read/unread with detailed result
    /// PUT /api/outlook/messages/{id}/read
    /// </summary>
    public async Task<MailServiceResult<bool>> MarkAsReadWithResultAsync(string messageId, bool isRead)
    {
        try
        {
            if (string.IsNullOrEmpty(messageId))
            {
                return new MailServiceResult<bool>
                {
                    Success = false,
                    Error = "Message ID is required",
                    Data = false
                };
            }

            var endpoint = $"outlook/messages/{Uri.EscapeDataString(messageId)}/read";
            var payload = new { isRead };

            System.Diagnostics.Debug.WriteLine($"[ApiMailService] PUT {endpoint} -> isRead={isRead}");

            var response = await _httpClientFactory.PutAsync(ApiEndpoint.InspireContinuum, endpoint, payload);

            if (response.IsSuccessStatusCode)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiMailService] Marked message {messageId} as read={isRead}");
                return new MailServiceResult<bool>
                {
                    Success = true,
                    Data = true
                };
            }

            var content = await response.Content.ReadAsStringAsync();
            System.Diagnostics.Debug.WriteLine($"[ApiMailService] MarkAsRead failed: {response.StatusCode} - {content}");

            return new MailServiceResult<bool>
            {
                Success = false,
                Error = $"Failed to mark message: {response.StatusCode}",
                StatusCode = response.StatusCode,
                Data = false
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiMailService] MarkAsRead error: {ex.Message}");
            return new MailServiceResult<bool>
            {
                Success = false,
                Error = ex.Message,
                Data = false
            };
        }
    }

    /// <summary>
    /// Toggles the flag status with detailed result
    /// PUT /api/outlook/messages/{id}/flag
    /// </summary>
    public async Task<MailServiceResult<bool>> ToggleFlagWithResultAsync(string messageId)
    {
        try
        {
            if (string.IsNullOrEmpty(messageId))
            {
                return new MailServiceResult<bool>
                {
                    Success = false,
                    Error = "Message ID is required",
                    Data = false
                };
            }

            var endpoint = $"outlook/messages/{Uri.EscapeDataString(messageId)}/flag";
            System.Diagnostics.Debug.WriteLine($"[ApiMailService] PUT {endpoint}");

            var response = await _httpClientFactory.PutAsync(ApiEndpoint.InspireContinuum, endpoint, new { });

            if (response.IsSuccessStatusCode)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiMailService] Toggled flag for message {messageId}");
                return new MailServiceResult<bool>
                {
                    Success = true,
                    Data = true
                };
            }

            var content = await response.Content.ReadAsStringAsync();
            System.Diagnostics.Debug.WriteLine($"[ApiMailService] ToggleFlag failed: {response.StatusCode} - {content}");

            return new MailServiceResult<bool>
            {
                Success = false,
                Error = $"Failed to toggle flag: {response.StatusCode}",
                StatusCode = response.StatusCode,
                Data = false
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiMailService] ToggleFlag error: {ex.Message}");
            return new MailServiceResult<bool>
            {
                Success = false,
                Error = ex.Message,
                Data = false
            };
        }
    }

    /// <summary>
    /// Searches messages with detailed result
    /// GET /api/outlook/messages/search?q={query}
    /// </summary>
    public async Task<MailServiceResult<List<EmailMessage>>> SearchMessagesWithResultAsync(
        string query,
        string? folderId = null,
        int page = 1,
        int pageSize = 50)
    {
        try
        {
            if (string.IsNullOrEmpty(query))
            {
                return new MailServiceResult<List<EmailMessage>>
                {
                    Success = false,
                    Error = "Search query is required",
                    Data = new List<EmailMessage>()
                };
            }

            var queryParams = new List<string>
            {
                $"q={Uri.EscapeDataString(query)}",
                $"page={page}",
                $"pageSize={pageSize}"
            };

            if (!string.IsNullOrEmpty(folderId))
                queryParams.Add($"folderId={Uri.EscapeDataString(folderId)}");

            var endpoint = $"outlook/messages/search?{string.Join("&", queryParams)}";
            System.Diagnostics.Debug.WriteLine($"[ApiMailService] GET {endpoint}");

            var response = await _httpClientFactory.GetAsync(ApiEndpoint.InspireContinuum, endpoint);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                // Try API response wrapper first
                try
                {
                    var apiResponse = JsonSerializer.Deserialize<ApiMessagesResponse>(content, _jsonOptions);
                    if (apiResponse?.Messages != null)
                    {
                        var messages = apiResponse.Messages.Select(MapToEmailMessage).ToList();
                        System.Diagnostics.Debug.WriteLine($"[ApiMailService] Search returned {messages.Count} messages");
                        return new MailServiceResult<List<EmailMessage>>
                        {
                            Success = true,
                            Data = messages,
                            TotalCount = apiResponse.TotalCount
                        };
                    }
                }
                catch { }

                // Try direct list parsing
                var directMessages = JsonSerializer.Deserialize<List<EmailMessageDto>>(content, _jsonOptions);
                if (directMessages != null)
                {
                    var messages = directMessages.Select(MapToEmailMessage).ToList();
                    System.Diagnostics.Debug.WriteLine($"[ApiMailService] Search returned {messages.Count} messages (direct)");
                    return new MailServiceResult<List<EmailMessage>>
                    {
                        Success = true,
                        Data = messages
                    };
                }

                return new MailServiceResult<List<EmailMessage>>
                {
                    Success = false,
                    Error = "Failed to parse search response",
                    Data = new List<EmailMessage>()
                };
            }

            System.Diagnostics.Debug.WriteLine($"[ApiMailService] Search failed: {response.StatusCode}");
            return new MailServiceResult<List<EmailMessage>>
            {
                Success = false,
                Error = $"Search failed: {response.StatusCode}",
                StatusCode = response.StatusCode,
                Data = new List<EmailMessage>()
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiMailService] Search error: {ex.Message}");
            return new MailServiceResult<List<EmailMessage>>
            {
                Success = false,
                Error = ex.Message,
                Data = new List<EmailMessage>()
            };
        }
    }

    #endregion

    #region Helper Methods

    private async Task RefreshFoldersCacheAsync()
    {
        var result = await GetFoldersWithResultAsync();
        if (result.Success && result.Data != null)
        {
            _cachedFolders = result.Data;
            _foldersCacheTime = DateTime.UtcNow;
        }
    }

    #endregion

    #region Mapping Methods

    private static MailFolder MapToMailFolder(MailFolderDto dto)
    {
        var folder = new MailFolder
        {
            Id = dto.Id ?? Guid.NewGuid().ToString(),
            Name = dto.Name ?? string.Empty,
            Type = ParseFolderType(dto.Type),
            UnreadCount = dto.UnreadCount,
            TotalCount = dto.TotalCount,
            Icon = dto.Icon ?? GetDefaultIcon(ParseFolderType(dto.Type)),
            ParentFolderId = dto.ParentFolderId,
            IsAccountRoot = dto.IsAccountRoot,
            WwbwEmailAddress = dto.WwbwEmailAddress,
            IsExpanded = dto.IsExpanded
        };

        // Map subfolders recursively
        if (dto.SubFolders != null && dto.SubFolders.Count > 0)
        {
            folder.SubFolders = dto.SubFolders.Select(MapToMailFolder).ToList();
        }

        return folder;
    }

    private static EmailMessage MapToEmailMessage(EmailMessageDto dto)
    {
        return new EmailMessage
        {
            Id = dto.Id ?? Guid.NewGuid().ToString(),
            Subject = dto.Subject ?? string.Empty,
            From = dto.From ?? string.Empty,
            FromEmail = dto.FromEmail ?? string.Empty,
            To = dto.To ?? new List<string>(),
            Cc = dto.Cc ?? new List<string>(),
            Bcc = dto.Bcc ?? new List<string>(),
            Body = dto.Body ?? string.Empty,
            IsHtml = dto.IsHtml,
            ReceivedDate = dto.ReceivedDate ?? DateTime.Now,
            SentDate = dto.SentDate ?? DateTime.Now,
            IsRead = dto.IsRead,
            IsFlagged = dto.IsFlagged,
            HasAttachments = dto.HasAttachments,
            Attachments = dto.Attachments?.Select(a => new EmailAttachment
            {
                Id = a.Id ?? Guid.NewGuid().ToString(),
                FileName = a.FileName ?? string.Empty,
                FileSize = a.FileSize,
                ContentType = a.ContentType ?? string.Empty
            }).ToList() ?? new List<EmailAttachment>(),
            FolderId = dto.FolderId ?? string.Empty,
            Priority = ParsePriority(dto.Priority),
            Preview = dto.Preview ?? string.Empty,
            ConversationId = dto.ConversationId ?? string.Empty
        };
    }

    private static EmailMessageDto MapToDto(EmailMessage message)
    {
        return new EmailMessageDto
        {
            Id = message.Id,
            Subject = message.Subject,
            From = message.From,
            FromEmail = message.FromEmail,
            To = message.To,
            Cc = message.Cc,
            Bcc = message.Bcc,
            Body = message.Body,
            IsHtml = message.IsHtml,
            ReceivedDate = message.ReceivedDate,
            SentDate = message.SentDate,
            IsRead = message.IsRead,
            IsFlagged = message.IsFlagged,
            HasAttachments = message.HasAttachments,
            Attachments = message.Attachments?.Select(a => new EmailAttachmentDto
            {
                Id = a.Id,
                FileName = a.FileName,
                FileSize = a.FileSize,
                ContentType = a.ContentType
            }).ToList(),
            FolderId = message.FolderId,
            Priority = message.Priority.ToString().ToLower(),
            Preview = message.Preview,
            ConversationId = message.ConversationId
        };
    }

    private static FolderType ParseFolderType(string? type)
    {
        return type?.ToLower() switch
        {
            "accountroot" => FolderType.AccountRoot,
            "inbox" => FolderType.Inbox,
            "sent" => FolderType.Sent,
            "drafts" => FolderType.Drafts,
            "deleted" or "trash" => FolderType.Deleted,
            "junk" or "spam" => FolderType.Junk,
            "archive" => FolderType.Archive,
            _ => FolderType.Custom
        };
    }

    private static EmailPriority ParsePriority(string? priority)
    {
        return priority?.ToLower() switch
        {
            "low" => EmailPriority.Low,
            "high" => EmailPriority.High,
            _ => EmailPriority.Normal
        };
    }

    private static string GetDefaultIcon(FolderType type)
    {
        return type switch
        {
            FolderType.AccountRoot => "\ue853",  // account_circle
            FolderType.Inbox => "\ue156",        // inbox
            FolderType.Sent => "\ue163",         // send
            FolderType.Drafts => "\ue151",       // drafts
            FolderType.Deleted => "\ue872",      // delete
            FolderType.Junk => "\ue16e",         // report
            FolderType.Archive => "\ue149",      // archive
            _ => "\ue2c7"                        // folder
        };
    }

    #endregion

    #region Static Methods

    /// <summary>
    /// Resets the singleton instance (useful for testing)
    /// </summary>
    public static void Reset()
    {
        lock (_lock)
        {
            _instance = null;
        }
    }

    /// <summary>
    /// Clears the folders cache
    /// </summary>
    public void ClearFoldersCache()
    {
        _cachedFolders.Clear();
        _foldersCacheTime = DateTime.MinValue;
    }

    #endregion
}

#region Service Result and DTOs

/// <summary>
/// Generic result wrapper for mail service operations
/// </summary>
public class MailServiceResult<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }
    public string? Error { get; set; }
    public HttpStatusCode StatusCode { get; set; } = HttpStatusCode.OK;
    public int? TotalCount { get; set; }
}

/// <summary>
/// API response for folders list
/// </summary>
internal class ApiFoldersResponse
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public List<MailFolderDto>? Folders { get; set; }
}

/// <summary>
/// API response for messages list
/// </summary>
internal class ApiMessagesResponse
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public List<EmailMessageDto>? Messages { get; set; }
    public int? TotalCount { get; set; }
    public int? Page { get; set; }
    public int? PageSize { get; set; }
}

/// <summary>
/// API response for single message
/// </summary>
internal class ApiMessageSingleResponse
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public EmailMessageDto? Message { get; set; }
}

/// <summary>
/// Mail folder data transfer object
/// </summary>
public class MailFolderDto
{
    public string? Id { get; set; }
    public string? Name { get; set; }
    public string? Type { get; set; }
    public int UnreadCount { get; set; }
    public int TotalCount { get; set; }
    public string? Icon { get; set; }
    public string? ParentFolderId { get; set; }
    public bool IsAccountRoot { get; set; }
    public string? WwbwEmailAddress { get; set; }
    public bool IsExpanded { get; set; } = true;
    public List<MailFolderDto>? SubFolders { get; set; }
}

/// <summary>
/// Email message data transfer object
/// </summary>
public class EmailMessageDto
{
    public string? Id { get; set; }
    public string? Subject { get; set; }
    public string? From { get; set; }
    public string? FromEmail { get; set; }
    public List<string>? To { get; set; }
    public List<string>? Cc { get; set; }
    public List<string>? Bcc { get; set; }
    public string? Body { get; set; }
    public bool IsHtml { get; set; }
    public DateTime? ReceivedDate { get; set; }
    public DateTime? SentDate { get; set; }
    public bool IsRead { get; set; }
    public bool IsFlagged { get; set; }
    public bool HasAttachments { get; set; }
    public List<EmailAttachmentDto>? Attachments { get; set; }
    public string? FolderId { get; set; }
    public string? Priority { get; set; }
    public string? Preview { get; set; }
    public string? ConversationId { get; set; }
}

/// <summary>
/// Email attachment data transfer object
/// </summary>
public class EmailAttachmentDto
{
    public string? Id { get; set; }
    public string? FileName { get; set; }
    public long FileSize { get; set; }
    public string? ContentType { get; set; }
    public string? StorageKey { get; set; }
}

#endregion
