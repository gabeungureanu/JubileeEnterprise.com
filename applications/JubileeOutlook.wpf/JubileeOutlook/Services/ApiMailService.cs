using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Text.Json.Serialization;
using JubileeOutlook.Models;

namespace JubileeOutlook.Services;

/// <summary>
/// API service for mail operations with offline-first support
/// Integrates with LocalCacheService for offline data and NetworkStatusService for connectivity
/// </summary>
public class ApiMailService : IMailService
{
    private static ApiMailService? _instance;
    private static readonly object _lock = new();

    private readonly HttpClientFactory _httpClientFactory;
    private readonly ConfigurationService _config;
    private readonly JsonSerializerOptions _jsonOptions;

    // Service dependencies for offline-first support
    private LocalCacheService? _localCache;
    private NetworkStatusService? _networkStatus;
    private SyncQueueService? _syncQueue;

    // Cached folders for GetFolders() synchronous call
    private List<MailFolder> _cachedFolders = new();
    private DateTime _foldersCacheTime = DateTime.MinValue;
    private readonly TimeSpan _foldersCacheDuration = TimeSpan.FromMinutes(5);

    /// <summary>
    /// Gets the local cache service instance
    /// </summary>
    private LocalCacheService LocalCache => _localCache ??= LocalCacheService.Instance;

    /// <summary>
    /// Gets the network status service instance
    /// </summary>
    private NetworkStatusService NetworkStatus => _networkStatus ??= NetworkStatusService.Instance;

    /// <summary>
    /// Gets the sync queue service instance
    /// </summary>
    private SyncQueueService SyncQueue => _syncQueue ??= SyncQueueService.Instance;

    /// <summary>
    /// Returns true if the network is available and API is reachable
    /// </summary>
    private bool IsOnline => NetworkStatus.IsOnline && NetworkStatus.IsApiReachable;

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
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
            PropertyNameCaseInsensitive = true,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            Converters = { new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower) }
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
    /// Gets mail folders asynchronously
    /// GET /api/outlook/folders
    /// </summary>
    public async Task<List<MailFolder>> GetFoldersAsync()
    {
        var result = await GetFoldersWithResultAsync();
        return result.Data ?? new List<MailFolder>();
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
    /// Toggles or sets the flag status of a message
    /// PATCH /api/v1/outlook/messages/{id} with is_flagged field
    /// </summary>
    public async Task ToggleFlagAsync(string messageId, bool? isFlagged = null)
    {
        await ToggleFlagWithResultAsync(messageId, isFlagged);
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

    /// <summary>
    /// Saves a message as draft
    /// POST /api/v1/outlook/messages (with is_draft=true) for new drafts
    /// PATCH /api/v1/outlook/messages/{id} for updating existing drafts
    /// </summary>
    public async Task<EmailMessage> SaveDraftAsync(EmailMessage draft, string? existingDraftId = null)
    {
        var result = await SaveDraftWithResultAsync(draft, existingDraftId);
        return result.Data ?? draft;
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

            System.Diagnostics.Debug.WriteLine($"[ApiMailService] Response Status: {response.StatusCode}");

            if (response.IsSuccessStatusCode)
            {
                // Try API response wrapper first
                try
                {
                    var apiResponse = JsonSerializer.Deserialize<ApiFoldersResponse>(content, _jsonOptions);
                    if (apiResponse?.Folders != null && apiResponse.Folders.Count > 0)
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
                catch (Exception deserEx)
                {
                    System.Diagnostics.Debug.WriteLine($"[ApiMailService] ApiFoldersResponse deserialization failed: {deserEx.Message}");
                }

                // Try direct list parsing
                try
                {
                    var directFolders = JsonSerializer.Deserialize<List<MailFolderDto>>(content, _jsonOptions);
                    if (directFolders != null && directFolders.Count > 0)
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
                }
                catch (Exception deserEx2)
                {
                    System.Diagnostics.Debug.WriteLine($"[ApiMailService] Direct list deserialization failed: {deserEx2.Message}");
                }

                System.Diagnostics.Debug.WriteLine($"[ApiMailService] Both deserialization attempts failed");
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
    /// Supports offline-first: returns cached data when offline, fetches from API when online
    /// GET /api/outlook/messages?folderId={folderId}
    /// </summary>
    public async Task<MailServiceResult<List<EmailMessage>>> GetMessagesWithResultAsync(
        string folderId,
        int page = 1,
        int pageSize = 50,
        string? sortBy = null,
        bool descending = true)
    {
        // Debug logging at very start
        System.Diagnostics.Debug.WriteLine($"[ApiMailService] GetMessagesWithResultAsync CALLED for folderId: {folderId}");
        System.Diagnostics.Debug.WriteLine($"[ApiMailService] NetworkStatus.IsOnline: {NetworkStatus.IsOnline}, IsApiReachable: {NetworkStatus.IsApiReachable}");
        try { System.IO.File.WriteAllText(@"C:\temp\outlook_method_called.txt", $"Method called at {DateTime.Now}\nfolderId: {folderId}\nIsOnline: {NetworkStatus.IsOnline}\nIsApiReachable: {NetworkStatus.IsApiReachable}"); } catch { }

        try
        {
            // If offline, return cached data
            if (!IsOnline)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiMailService] Offline - returning cached messages for folder {folderId}");
                var cachedMessages = await LocalCache.GetCachedEmailsAsync(folderId);
                return new MailServiceResult<List<EmailMessage>>
                {
                    Success = true,
                    Data = cachedMessages,
                    TotalCount = cachedMessages.Count
                };
            }

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

            // Write raw response for debugging
            try { System.IO.File.WriteAllText(@"C:\temp\outlook_raw_response.txt", $"Status: {response.StatusCode}\nContent Length: {content.Length}\nContent:\n{content.Substring(0, Math.Min(5000, content.Length))}"); } catch { }

            if (response.IsSuccessStatusCode)
            {
                // Try API response wrapper first
                try
                {
                    System.Diagnostics.Debug.WriteLine($"[ApiMailService] Attempting to deserialize messages response...");
                    var apiResponse = JsonSerializer.Deserialize<ApiMessagesResponse>(content, _jsonOptions);
                    System.Diagnostics.Debug.WriteLine($"[ApiMailService] Deserialized apiResponse, Messages null? {apiResponse?.Messages == null}");
                    // Write debug info to file
                    try { System.IO.File.WriteAllText(@"C:\temp\outlook_debug.txt", $"apiResponse null: {apiResponse == null}\nMessages null: {apiResponse?.Messages == null}\nMessages count: {apiResponse?.Messages?.Count ?? -1}"); } catch { }
                    if (apiResponse?.Messages != null)
                    {
                        System.Diagnostics.Debug.WriteLine($"[ApiMailService] apiResponse.Messages.Count = {apiResponse.Messages.Count}");
                        var messages = apiResponse.Messages.Select(MapToEmailMessage).ToList();
                        System.Diagnostics.Debug.WriteLine($"[ApiMailService] Retrieved {messages.Count} messages");
                        // More debug
                        try { System.IO.File.AppendAllText(@"C:\temp\outlook_debug.txt", $"\nMapped messages count: {messages.Count}"); if (messages.Count > 0) { System.IO.File.AppendAllText(@"C:\temp\outlook_debug.txt", $"\nFirst msg: {messages[0].Subject} from {messages[0].From}"); } } catch { }

                        // Cache the messages for offline use
                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                await LocalCache.CacheEmailsAsync(messages);
                            }
                            catch (Exception ex)
                            {
                                System.Diagnostics.Debug.WriteLine($"[ApiMailService] Failed to cache messages: {ex.Message}");
                            }
                        });

                        return new MailServiceResult<List<EmailMessage>>
                        {
                            Success = true,
                            Data = messages,
                            TotalCount = apiResponse.TotalCount
                        };
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[ApiMailService] Messages deserialization error: {ex.Message}");
                    System.Diagnostics.Debug.WriteLine($"[ApiMailService] Stack trace: {ex.StackTrace}");
                    // Write to file for debugging
                    try { System.IO.File.WriteAllText(@"C:\temp\outlook_error.txt", $"Error: {ex.Message}\n\nStack: {ex.StackTrace}\n\nContent: {content.Substring(0, Math.Min(2000, content.Length))}"); } catch { }
                }

                // Try direct list parsing
                var directMessages = JsonSerializer.Deserialize<List<EmailMessageDto>>(content, _jsonOptions);
                if (directMessages != null)
                {
                    var messages = directMessages.Select(MapToEmailMessage).ToList();
                    System.Diagnostics.Debug.WriteLine($"[ApiMailService] Retrieved {messages.Count} messages (direct)");

                    // Cache the messages for offline use
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            await LocalCache.CacheEmailsAsync(messages);
                        }
                        catch (Exception ex)
                        {
                            System.Diagnostics.Debug.WriteLine($"[ApiMailService] Failed to cache messages: {ex.Message}");
                        }
                    });

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
    /// Supports offline-first: queues message in outbox when offline
    /// POST /api/v1/outlook/messages
    /// Creates message in Sent Items folder and stores recipients/attachments
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

            // Build recipients list from To, Cc, Bcc fields
            var recipients = new List<RecipientDto>();

            if (message.To != null)
            {
                foreach (var email in message.To)
                {
                    recipients.Add(new RecipientDto { Email = email, Type = "to" });
                }
            }

            if (message.Cc != null)
            {
                foreach (var email in message.Cc)
                {
                    recipients.Add(new RecipientDto { Email = email, Type = "cc" });
                }
            }

            if (message.Bcc != null)
            {
                foreach (var email in message.Bcc)
                {
                    recipients.Add(new RecipientDto { Email = email, Type = "bcc" });
                }
            }

            // Build attachments list
            var attachments = message.Attachments?.Select(a => new AttachmentCreateDto
            {
                FileName = a.FileName,
                FilePath = a.FilePath,
                FileSize = a.FileSize,
                MimeType = a.ContentType,
                IsInline = false
            }).ToList();

            // If offline, queue the message for later sending
            if (!IsOnline)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiMailService] Offline - queueing message for send: {message.Subject}");

                // Generate a temporary ID for tracking
                var tempId = Guid.NewGuid().ToString();
                message.Id = tempId;
                message.FolderId = "outbox";
                message.SentDate = DateTime.UtcNow;

                // Cache the message locally in outbox
                try
                {
                    await LocalCache.CacheEmailAsync(message);
                    System.Diagnostics.Debug.WriteLine($"[ApiMailService] Cached message in outbox: {tempId}");
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[ApiMailService] Failed to cache outbox message: {ex.Message}");
                }

                // Queue the send operation with message data
                var messagePayload = new
                {
                    subject = message.Subject,
                    body = message.Body,
                    bodyHtml = message.IsHtml ? message.Body : null,
                    to = message.To,
                    cc = message.Cc,
                    bcc = message.Bcc,
                    fromEmail = message.FromEmail,
                    fromName = message.From,
                    isHtml = message.IsHtml,
                    priority = message.Priority.ToString().ToLower()
                };

                await SyncQueue.QueueOperationAsync(
                    SyncEntityTypes.Email,
                    tempId,
                    SyncOperationTypes.Create,
                    messagePayload);

                return new MailServiceResult<EmailMessage>
                {
                    Success = true,
                    Data = message
                };
            }

            // Online - proceed with normal send
            // Create the request DTO in API format
            var request = new CreateMessageRequest
            {
                FolderId = message.FolderId, // Will be set to "sent" folder by API if not specified
                Subject = message.Subject,
                BodyText = message.IsHtml ? null : message.Body,
                BodyHtml = message.IsHtml ? message.Body : null,
                SenderEmail = message.FromEmail,
                SenderName = message.From,
                IsDraft = false, // Sending, not saving as draft
                Importance = message.Priority.ToString().ToLower(),
                Recipients = recipients.Count > 0 ? recipients : null,
                Attachments = attachments?.Count > 0 ? attachments : null
            };

            var endpoint = "outlook/messages";

            System.Diagnostics.Debug.WriteLine($"[ApiMailService] POST {endpoint} - {message.Subject}");
            System.Diagnostics.Debug.WriteLine($"[ApiMailService]   Recipients: {recipients.Count} (To: {message.To?.Count ?? 0}, Cc: {message.Cc?.Count ?? 0}, Bcc: {message.Bcc?.Count ?? 0})");
            System.Diagnostics.Debug.WriteLine($"[ApiMailService]   Attachments: {attachments?.Count ?? 0}");

            var response = await _httpClientFactory.PostAsync(ApiEndpoint.InspireContinuum, endpoint, request);
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

                // Try direct parsing (API returns the created message directly)
                try
                {
                    var createdMessage = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(content, _jsonOptions);
                    if (createdMessage != null && createdMessage.ContainsKey("id"))
                    {
                        // Map API response to EmailMessage
                        var sentMessage = new EmailMessage
                        {
                            Id = createdMessage["id"].GetString() ?? Guid.NewGuid().ToString(),
                            Subject = message.Subject,
                            From = message.From,
                            FromEmail = message.FromEmail,
                            To = message.To ?? new List<string>(),
                            Cc = message.Cc ?? new List<string>(),
                            Bcc = message.Bcc ?? new List<string>(),
                            Body = message.Body,
                            IsHtml = message.IsHtml,
                            SentDate = DateTime.Now,
                            ReceivedDate = DateTime.Now,
                            IsRead = true,
                            FolderId = "sent",
                            HasAttachments = message.HasAttachments,
                            Attachments = message.Attachments ?? new List<EmailAttachment>()
                        };
                        System.Diagnostics.Debug.WriteLine($"[ApiMailService] Sent message: {sentMessage.Id}");
                        return new MailServiceResult<EmailMessage>
                        {
                            Success = true,
                            Data = sentMessage
                        };
                    }
                }
                catch { }

                // If no response body parseable, return original with success
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
                Error = $"Failed to send message: {response.StatusCode} - {content}",
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
    /// Saves a draft message with detailed result
    /// POST /api/v1/outlook/messages (with is_draft=true) for new drafts
    /// PATCH /api/v1/outlook/messages/{id} for updating existing drafts
    /// </summary>
    public async Task<MailServiceResult<EmailMessage>> SaveDraftWithResultAsync(EmailMessage draft, string? existingDraftId = null)
    {
        try
        {
            if (draft == null)
            {
                return new MailServiceResult<EmailMessage>
                {
                    Success = false,
                    Error = "Draft message is required"
                };
            }

            // If we have an existing draft ID, update it via PATCH
            if (!string.IsNullOrEmpty(existingDraftId))
            {
                return await UpdateDraftAsync(draft, existingDraftId);
            }

            // Create new draft via POST with is_draft=true
            // Build recipients list from To, Cc, Bcc fields
            var recipients = new List<RecipientDto>();

            if (draft.To != null)
            {
                foreach (var email in draft.To)
                {
                    recipients.Add(new RecipientDto { Email = email, Type = "to" });
                }
            }

            if (draft.Cc != null)
            {
                foreach (var email in draft.Cc)
                {
                    recipients.Add(new RecipientDto { Email = email, Type = "cc" });
                }
            }

            if (draft.Bcc != null)
            {
                foreach (var email in draft.Bcc)
                {
                    recipients.Add(new RecipientDto { Email = email, Type = "bcc" });
                }
            }

            // Build attachments list
            var attachments = draft.Attachments?.Select(a => new AttachmentCreateDto
            {
                FileName = a.FileName,
                FilePath = a.FilePath,
                FileSize = a.FileSize,
                MimeType = a.ContentType,
                IsInline = false
            }).ToList();

            // Create the request DTO for draft
            var request = new CreateMessageRequest
            {
                FolderId = null, // API will auto-create/select Drafts folder
                Subject = draft.Subject,
                BodyText = draft.IsHtml ? null : draft.Body,
                BodyHtml = draft.IsHtml ? draft.Body : null,
                SenderEmail = draft.FromEmail,
                SenderName = draft.From,
                IsDraft = true, // This is a draft
                Importance = draft.Priority.ToString().ToLower(),
                Recipients = recipients.Count > 0 ? recipients : null,
                Attachments = attachments?.Count > 0 ? attachments : null
            };

            var endpoint = "outlook/messages";

            System.Diagnostics.Debug.WriteLine($"[ApiMailService] POST {endpoint} (draft) - {draft.Subject}");

            var response = await _httpClientFactory.PostAsync(ApiEndpoint.InspireContinuum, endpoint, request);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                // Try to parse the response to get the draft ID
                try
                {
                    var createdMessage = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(content, _jsonOptions);
                    if (createdMessage != null && createdMessage.ContainsKey("id"))
                    {
                        var savedDraft = new EmailMessage
                        {
                            Id = createdMessage["id"].GetString() ?? Guid.NewGuid().ToString(),
                            Subject = draft.Subject,
                            From = draft.From,
                            FromEmail = draft.FromEmail,
                            To = draft.To ?? new List<string>(),
                            Cc = draft.Cc ?? new List<string>(),
                            Bcc = draft.Bcc ?? new List<string>(),
                            Body = draft.Body,
                            IsHtml = draft.IsHtml,
                            SentDate = DateTime.Now,
                            ReceivedDate = DateTime.Now,
                            IsRead = true,
                            FolderId = "drafts",
                            HasAttachments = draft.HasAttachments,
                            Attachments = draft.Attachments ?? new List<EmailAttachment>()
                        };
                        System.Diagnostics.Debug.WriteLine($"[ApiMailService] Draft saved: {savedDraft.Id}");
                        return new MailServiceResult<EmailMessage>
                        {
                            Success = true,
                            Data = savedDraft
                        };
                    }
                }
                catch { }

                // Return original with success if parsing fails
                System.Diagnostics.Debug.WriteLine($"[ApiMailService] Draft saved successfully");
                return new MailServiceResult<EmailMessage>
                {
                    Success = true,
                    Data = draft
                };
            }

            System.Diagnostics.Debug.WriteLine($"[ApiMailService] Save draft failed: {response.StatusCode} - {content}");
            return new MailServiceResult<EmailMessage>
            {
                Success = false,
                Error = $"Failed to save draft: {response.StatusCode} - {content}",
                StatusCode = response.StatusCode
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiMailService] SaveDraft error: {ex.Message}");
            return new MailServiceResult<EmailMessage>
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    /// <summary>
    /// Updates an existing draft message
    /// PATCH /api/v1/outlook/messages/{id}
    /// </summary>
    private async Task<MailServiceResult<EmailMessage>> UpdateDraftAsync(EmailMessage draft, string draftId)
    {
        try
        {
            var endpoint = $"outlook/messages/{Uri.EscapeDataString(draftId)}";

            // Build update payload - API expects specific fields
            var payload = new Dictionary<string, object?>
            {
                ["subject"] = draft.Subject,
                ["body_text"] = draft.IsHtml ? null : draft.Body,
                ["body_html"] = draft.IsHtml ? draft.Body : null,
                ["sender_email"] = draft.FromEmail,
                ["sender_name"] = draft.From,
                ["importance"] = draft.Priority.ToString().ToLower()
            };

            System.Diagnostics.Debug.WriteLine($"[ApiMailService] PATCH {endpoint} (update draft) - {draft.Subject}");

            var response = await _httpClientFactory.PatchAsync(ApiEndpoint.InspireContinuum, endpoint, payload);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                // Return the draft with updated ID
                draft.Id = draftId;
                draft.FolderId = "drafts";
                System.Diagnostics.Debug.WriteLine($"[ApiMailService] Draft updated: {draftId}");
                return new MailServiceResult<EmailMessage>
                {
                    Success = true,
                    Data = draft
                };
            }

            System.Diagnostics.Debug.WriteLine($"[ApiMailService] Update draft failed: {response.StatusCode} - {content}");
            return new MailServiceResult<EmailMessage>
            {
                Success = false,
                Error = $"Failed to update draft: {response.StatusCode} - {content}",
                StatusCode = response.StatusCode
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiMailService] UpdateDraft error: {ex.Message}");
            return new MailServiceResult<EmailMessage>
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    /// <summary>
    /// Deletes a message with detailed result
    /// Supports offline-first: queues operation if offline
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

            // Mark as deleted in local cache first (optimistic update)
            try
            {
                await LocalCache.MarkEmailDeletedAsync(messageId);
                System.Diagnostics.Debug.WriteLine($"[ApiMailService] Marked message as deleted in local cache: {messageId}");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiMailService] Failed to mark as deleted in cache: {ex.Message}");
            }

            // If offline, queue the operation for later sync
            if (!IsOnline)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiMailService] Offline - queueing delete for message: {messageId}");
                await SyncQueue.QueueOperationAsync(
                    SyncEntityTypes.Email,
                    messageId,
                    SyncOperationTypes.Delete);

                return new MailServiceResult<bool>
                {
                    Success = true,
                    Data = true
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
                System.Diagnostics.Debug.WriteLine($"[ApiMailService] Message not found (already deleted): {messageId}");
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
    /// PATCH /api/v1/outlook/messages/{id} with folder_id field
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

            // Update local cache first (optimistic update)
            // Note: LocalCacheService doesn't have a move method, so we'll handle this
            // by updating the folder_id when the message is next cached

            // If offline, queue the operation
            if (!IsOnline)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiMailService] Offline - queueing move for message {messageId} to folder {targetFolderId}");
                await SyncQueue.QueueOperationAsync(
                    SyncEntityTypes.Email,
                    messageId,
                    SyncOperationTypes.Update,
                    new { folder_id = targetFolderId });

                return new MailServiceResult<bool>
                {
                    Success = true,
                    Data = true
                };
            }

            var endpoint = $"outlook/messages/{Uri.EscapeDataString(messageId)}";
            var payload = new { folder_id = targetFolderId };

            System.Diagnostics.Debug.WriteLine($"[ApiMailService] PATCH {endpoint} -> folder_id={targetFolderId}");

            var response = await _httpClientFactory.PatchAsync(ApiEndpoint.InspireContinuum, endpoint, payload);

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
    /// Supports offline-first: queues operation if offline
    /// PATCH /api/v1/outlook/messages/{id} with is_read field
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

            // Note: Local cache update is handled by SyncService during sync

            // If offline, queue the operation
            if (!IsOnline)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiMailService] Offline - queueing mark as read for message {messageId}");
                await SyncQueue.QueueOperationAsync(
                    SyncEntityTypes.Email,
                    messageId,
                    isRead ? SyncOperationTypes.MarkRead : SyncOperationTypes.MarkUnread);

                return new MailServiceResult<bool>
                {
                    Success = true,
                    Data = true
                };
            }

            var endpoint = $"outlook/messages/{Uri.EscapeDataString(messageId)}";
            var payload = new { is_read = isRead };

            System.Diagnostics.Debug.WriteLine($"[ApiMailService] PATCH {endpoint} -> is_read={isRead}");

            var response = await _httpClientFactory.PatchAsync(ApiEndpoint.InspireContinuum, endpoint, payload);

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
    /// Toggles or sets the flag status with detailed result
    /// PATCH /api/v1/outlook/messages/{id} with is_flagged field
    /// If isFlagged is null, fetches current state and toggles it
    /// </summary>
    public async Task<MailServiceResult<bool>> ToggleFlagWithResultAsync(string messageId, bool? isFlagged = null)
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

            // If no flag value provided, we need to get current state and toggle
            bool newFlagValue;
            if (isFlagged.HasValue)
            {
                newFlagValue = isFlagged.Value;
            }
            else
            {
                // Fetch current message to get its flag state
                var currentMessage = await GetMessageByIdAsync(messageId);
                if (currentMessage == null)
                {
                    return new MailServiceResult<bool>
                    {
                        Success = false,
                        Error = "Message not found",
                        Data = false
                    };
                }
                newFlagValue = !currentMessage.IsFlagged;
            }

            var endpoint = $"outlook/messages/{Uri.EscapeDataString(messageId)}";
            var payload = new { is_flagged = newFlagValue };

            System.Diagnostics.Debug.WriteLine($"[ApiMailService] PATCH {endpoint} -> is_flagged={newFlagValue}");

            var response = await _httpClientFactory.PatchAsync(ApiEndpoint.InspireContinuum, endpoint, payload);

            if (response.IsSuccessStatusCode)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiMailService] Set flag for message {messageId} to {newFlagValue}");
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
        var folderType = ParseFolderType(dto.Type);

        // Only show unread counts for folder types where it makes sense
        // Sent, Drafts, Deleted, Junk, and Archive folders should not show unread counts
        var shouldShowUnreadCount = folderType switch
        {
            FolderType.Inbox => true,
            FolderType.Custom => true,
            FolderType.AccountRoot => false,
            FolderType.Sent => false,
            FolderType.Drafts => false,
            FolderType.Deleted => false,
            FolderType.Junk => false,
            FolderType.Archive => false,
            _ => false
        };

        var folder = new MailFolder
        {
            Id = dto.Id ?? Guid.NewGuid().ToString(),
            Name = dto.Name ?? string.Empty,
            Type = folderType,
            UnreadCount = shouldShowUnreadCount ? dto.UnreadCount : 0,
            TotalCount = dto.TotalCount,
            Icon = ConvertIconNameToMaterialIcon(dto.Icon, folderType),
            ParentFolderId = dto.ParentFolderId,
            IsAccountRoot = dto.IsAccountRoot,
            WwbwEmailAddress = dto.WwbwEmailAddress,
            IsExpanded = dto.IsExpanded
        };

        // Map subfolders recursively
        if (dto.SubFolders != null && dto.SubFolders.Count > 0)
        {
            folder.SubFolders = new System.Collections.ObjectModel.ObservableCollection<MailFolder>(dto.SubFolders.Select(MapToMailFolder));
        }

        return folder;
    }

    private static EmailMessage MapToEmailMessage(EmailMessageDto dto)
    {
        // Extract recipients by type
        var toRecipients = dto.Recipients?
            .Where(r => r.RecipientType?.ToLower() == "to")
            .Select(r => !string.IsNullOrEmpty(r.Name) ? $"{r.Name} <{r.Email}>" : r.Email ?? "")
            .ToList() ?? dto.To ?? new List<string>();

        var ccRecipients = dto.Recipients?
            .Where(r => r.RecipientType?.ToLower() == "cc")
            .Select(r => !string.IsNullOrEmpty(r.Name) ? $"{r.Name} <{r.Email}>" : r.Email ?? "")
            .ToList() ?? dto.Cc ?? new List<string>();

        var bccRecipients = dto.Recipients?
            .Where(r => r.RecipientType?.ToLower() == "bcc")
            .Select(r => !string.IsNullOrEmpty(r.Name) ? $"{r.Name} <{r.Email}>" : r.Email ?? "")
            .ToList() ?? dto.Bcc ?? new List<string>();

        // Use sender_name/sender_email from API, fallback to From/FromEmail
        var fromName = dto.SenderName ?? dto.From ?? string.Empty;
        var fromEmail = dto.SenderEmail ?? dto.FromEmail ?? string.Empty;

        // Use body_html if available, otherwise body_text or body
        var body = dto.BodyHtml ?? dto.BodyText ?? dto.Body ?? string.Empty;
        var isHtml = !string.IsNullOrEmpty(dto.BodyHtml) || dto.IsHtml;

        // Use received_at/sent_at from API, fallback to ReceivedDate/SentDate
        var receivedDate = dto.ReceivedAt ?? dto.ReceivedDate ?? DateTime.Now;
        var sentDate = dto.SentAt ?? dto.SentDate ?? DateTime.Now;

        return new EmailMessage
        {
            Id = dto.Id ?? Guid.NewGuid().ToString(),
            Subject = dto.Subject ?? string.Empty,
            From = fromName,
            FromEmail = fromEmail,
            To = toRecipients,
            Cc = ccRecipients,
            Bcc = bccRecipients,
            Body = body,
            IsHtml = isHtml,
            ReceivedDate = receivedDate,
            SentDate = sentDate,
            IsRead = dto.IsRead,
            IsFlagged = dto.IsFlagged,
            HasAttachments = dto.HasAttachments,
            Attachments = dto.Attachments?.Select(a => new EmailAttachment
            {
                Id = a.Id ?? Guid.NewGuid().ToString(),
                FileName = a.FileName ?? string.Empty,
                FileSize = a.FileSize,
                ContentType = a.MimeType ?? a.ContentType ?? string.Empty
            }).ToList() ?? new List<EmailAttachment>(),
            FolderId = dto.FolderId ?? string.Empty,
            Priority = ParsePriority(dto.Importance ?? dto.Priority),
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

    /// <summary>
    /// Converts icon name from API (e.g., "inbox", "send") to Material Icons unicode character
    /// </summary>
    private static string ConvertIconNameToMaterialIcon(string? iconName, FolderType folderType)
    {
        if (string.IsNullOrEmpty(iconName))
        {
            return GetDefaultIcon(folderType);
        }

        // Convert icon name to Material Icons unicode character
        return iconName.ToLowerInvariant() switch
        {
            "inbox" => "\ue156",           // inbox
            "send" => "\ue163",            // send
            "drafts" => "\ue151",          // drafts
            "delete" => "\ue872",          // delete
            "trash" => "\ue872",           // delete (alias)
            "report" => "\ue160",          // report (warning/spam)
            "spam" => "\ue160",            // report (alias)
            "archive" => "\ue149",         // archive
            "folder" => "\ue2c7",          // folder
            "account_circle" => "\ue853",  // account_circle
            "star" => "\ue838",            // star
            "label" => "\ue892",           // label
            "flag" => "\ue153",            // flag
            "email" => "\ue0be",           // email
            "mail" => "\ue158",            // mail
            _ => GetDefaultIcon(folderType) // fallback to folder type default
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
    [System.Text.Json.Serialization.JsonPropertyName("success")]
    public bool Success { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("error")]
    public string? Error { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("folders")]
    public List<MailFolderDto>? Folders { get; set; }
}

/// <summary>
/// API response for messages list
/// </summary>
internal class ApiMessagesResponse
{
    [System.Text.Json.Serialization.JsonPropertyName("success")]
    public bool Success { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("error")]
    public string? Error { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("messages")]
    public List<EmailMessageDto>? Messages { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("total_count")]
    public int? TotalCount { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("page")]
    public int? Page { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("page_size")]
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
    [System.Text.Json.Serialization.JsonPropertyName("folder_type")]
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
/// Maps to InspireContinuum API response format (snake_case)
/// </summary>
public class EmailMessageDto
{
    public string? Id { get; set; }
    public string? Subject { get; set; }

    // Sender fields from API (snake_case)
    [System.Text.Json.Serialization.JsonPropertyName("sender_name")]
    public string? SenderName { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("sender_email")]
    public string? SenderEmail { get; set; }

    // Legacy fields for backwards compatibility
    public string? From { get; set; }
    public string? FromEmail { get; set; }
    public List<string>? To { get; set; }
    public List<string>? Cc { get; set; }
    public List<string>? Bcc { get; set; }

    // Body content
    [System.Text.Json.Serialization.JsonPropertyName("body_html")]
    public string? BodyHtml { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("body_text")]
    public string? BodyText { get; set; }

    public string? Body { get; set; }
    public bool IsHtml { get; set; }

    // Dates
    [System.Text.Json.Serialization.JsonPropertyName("received_at")]
    public DateTime? ReceivedAt { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("sent_at")]
    public DateTime? SentAt { get; set; }

    public DateTime? ReceivedDate { get; set; }
    public DateTime? SentDate { get; set; }

    // Flags
    [System.Text.Json.Serialization.JsonPropertyName("is_read")]
    public bool IsRead { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("is_flagged")]
    public bool IsFlagged { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("has_attachments")]
    public bool HasAttachments { get; set; }

    // Related data
    public List<EmailAttachmentDto>? Attachments { get; set; }
    public List<EmailRecipientDto>? Recipients { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("folder_id")]
    public string? FolderId { get; set; }

    public string? Importance { get; set; }
    public string? Priority { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("body_preview")]
    public string? Preview { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("conversation_id")]
    public string? ConversationId { get; set; }
}

/// <summary>
/// Email recipient from API response
/// </summary>
public class EmailRecipientDto
{
    public string? Email { get; set; }
    public string? Name { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("recipient_type")]
    public string? RecipientType { get; set; }
}

/// <summary>
/// Email attachment data transfer object
/// </summary>
public class EmailAttachmentDto
{
    public string? Id { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("file_name")]
    public string? FileName { get; set; }

    // file_size comes as string from API, need custom handling
    [System.Text.Json.Serialization.JsonPropertyName("file_size")]
    [System.Text.Json.Serialization.JsonConverter(typeof(StringToLongConverter))]
    public long FileSize { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("mime_type")]
    public string? MimeType { get; set; }

    public string? ContentType { get; set; }
    public string? StorageKey { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("is_inline")]
    public bool IsInline { get; set; }
}

/// <summary>
/// Converter to handle string-to-long conversion for file_size field
/// </summary>
public class StringToLongConverter : System.Text.Json.Serialization.JsonConverter<long>
{
    public override long Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.String)
        {
            if (long.TryParse(reader.GetString(), out long value))
                return value;
            return 0;
        }
        if (reader.TokenType == JsonTokenType.Number)
        {
            return reader.GetInt64();
        }
        return 0;
    }

    public override void Write(Utf8JsonWriter writer, long value, JsonSerializerOptions options)
    {
        writer.WriteNumberValue(value);
    }
}

/// <summary>
/// DTO for creating a new email message via POST API
/// Maps to InspireContinuum API format with snake_case fields
/// </summary>
internal class CreateMessageRequest
{
    [System.Text.Json.Serialization.JsonPropertyName("folder_id")]
    public string? FolderId { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("subject")]
    public string? Subject { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("body_text")]
    public string? BodyText { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("body_html")]
    public string? BodyHtml { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("sender_email")]
    public string? SenderEmail { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("sender_name")]
    public string? SenderName { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("is_draft")]
    public bool IsDraft { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("importance")]
    public string Importance { get; set; } = "normal";

    [System.Text.Json.Serialization.JsonPropertyName("recipients")]
    public List<RecipientDto>? Recipients { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("attachments")]
    public List<AttachmentCreateDto>? Attachments { get; set; }
}

/// <summary>
/// DTO for email recipient in create message request
/// </summary>
internal class RecipientDto
{
    [System.Text.Json.Serialization.JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;

    [System.Text.Json.Serialization.JsonPropertyName("name")]
    public string? Name { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("type")]
    public string Type { get; set; } = "to"; // "to", "cc", "bcc"
}

/// <summary>
/// DTO for attachment in create message request
/// </summary>
internal class AttachmentCreateDto
{
    [System.Text.Json.Serialization.JsonPropertyName("fileName")]
    public string FileName { get; set; } = string.Empty;

    [System.Text.Json.Serialization.JsonPropertyName("filePath")]
    public string? FilePath { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("fileSize")]
    public long FileSize { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("mimeType")]
    public string? MimeType { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("isInline")]
    public bool IsInline { get; set; }
}

#endregion
