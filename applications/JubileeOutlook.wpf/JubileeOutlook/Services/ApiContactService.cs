using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Text.Json.Serialization;
using JubileeOutlook.Models;

namespace JubileeOutlook.Services;

/// <summary>
/// API service for contact operations via InspireCodex API
/// Uses HttpClientFactory for centralized HTTP client management with auto-auth
/// Supports offline-first operation with LocalCacheService and NetworkStatusService
/// </summary>
public class ApiContactService : IContactService
{
    private static ApiContactService? _instance;
    private static readonly object _lock = new();

    private readonly HttpClientFactory _httpClientFactory;
    private readonly ConfigurationService _config;
    private readonly JsonSerializerOptions _jsonOptions;

    // Service dependencies for offline-first support
    private LocalCacheService? _localCache;
    private NetworkStatusService? _networkStatus;
    private SyncQueueService? _syncQueue;

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
    /// Singleton instance of the contact service
    /// </summary>
    public static ApiContactService Instance
    {
        get
        {
            if (_instance == null)
            {
                lock (_lock)
                {
                    _instance ??= new ApiContactService();
                }
            }
            return _instance;
        }
    }

    public ApiContactService()
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

        System.Diagnostics.Debug.WriteLine($"[ApiContactService] Initialized with HttpClientFactory");
        System.Diagnostics.Debug.WriteLine($"[ApiContactService] InspireCodex API: {_config.Api.InspireCodex.BaseUrl}");
    }

    #region IContactService Implementation

    /// <summary>
    /// Gets all contacts
    /// GET /api/v1/contacts
    /// </summary>
    public async Task<List<Contact>> GetContactsAsync()
    {
        var result = await GetContactsWithResultAsync();
        return result.Data ?? new List<Contact>();
    }

    /// <summary>
    /// Gets a contact by ID
    /// GET /api/v1/contacts/{id}
    /// </summary>
    public async Task<Contact?> GetContactByIdAsync(string contactId)
    {
        var result = await GetContactByIdWithResultAsync(contactId);
        return result.Data;
    }

    /// <summary>
    /// Creates a new contact
    /// POST /api/v1/contacts
    /// </summary>
    public async Task<Contact> CreateContactAsync(Contact contact)
    {
        var result = await CreateContactWithResultAsync(contact);
        return result.Data ?? contact;
    }

    /// <summary>
    /// Updates an existing contact
    /// PUT /api/v1/contacts/{id}
    /// </summary>
    public async Task<Contact> UpdateContactAsync(Contact contact)
    {
        var result = await UpdateContactWithResultAsync(contact);
        return result.Data ?? contact;
    }

    /// <summary>
    /// Deletes a contact
    /// DELETE /api/v1/contacts/{id}
    /// </summary>
    public async Task DeleteContactAsync(string contactId)
    {
        await DeleteContactWithResultAsync(contactId);
    }

    /// <summary>
    /// Searches contacts by query
    /// GET /api/v1/contacts/search?q={query}
    /// </summary>
    public async Task<List<Contact>> SearchContactsAsync(string query)
    {
        var result = await SearchContactsWithResultAsync(query);
        return result.Data ?? new List<Contact>();
    }

    #endregion

    /// <summary>
    /// Creates a rate-limited result with cached data fallback
    /// </summary>
    private async Task<ContactServiceResult<List<Contact>>> GetRateLimitedContactsResultAsync()
    {
        var cached = await LocalCache.GetCachedContactsAsync();
        return new ContactServiceResult<List<Contact>>
        {
            Success = true,
            Data = cached,
            TotalCount = cached.Count,
            IsRateLimited = true,
            RetryAfterSeconds = RateLimitTracker.Instance.RetryAfterSeconds
        };
    }

    #region Extended Methods with Result Objects

    /// <summary>
    /// Gets all contacts with detailed result
    /// Supports offline-first: returns cached contacts when offline
    /// GET /api/v1/contacts
    /// </summary>
    public async Task<ContactServiceResult<List<Contact>>> GetContactsWithResultAsync(int page = 1, int pageSize = 100)
    {
        // Check rate limit before making API call
        if (RateLimitTracker.Instance.ShouldThrottle())
        {
            System.Diagnostics.Debug.WriteLine("[ApiContactService] Rate limited - returning cached contacts");
            return await GetRateLimitedContactsResultAsync();
        }

        try
        {
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] GetContactsWithResultAsync called");
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] NetworkStatus.IsOnline={NetworkStatus.IsOnline}, IsApiReachable={NetworkStatus.IsApiReachable}");
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] ServiceConfiguration.UserId={ServiceConfiguration.UserId ?? "(null)"}");

            // Always try API first, fall back to cache on failure
            // This ensures contacts load even if network status check hasn't completed
            var userId = ServiceConfiguration.RequireUserId();
            var queryParams = new List<string>
            {
                $"userId={Uri.EscapeDataString(userId)}",
                $"page={page}",
                $"pageSize={pageSize}"
            };

            var endpoint = $"contacts?{string.Join("&", queryParams)}";
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] GET {endpoint}");

            var response = await _httpClientFactory.GetAsync(ApiEndpoint.InspireCodex, endpoint);
            var content = await response.Content.ReadAsStringAsync();

            System.Diagnostics.Debug.WriteLine($"[ApiContactService] Response Status: {response.StatusCode}");
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] Response Content Length: {content?.Length ?? 0}");

            if (response.IsSuccessStatusCode)
            {
                // Try API response wrapper first
                try
                {
                    var apiResponse = JsonSerializer.Deserialize<ApiContactsListResponse>(content, _jsonOptions);
                    if (apiResponse?.Contacts != null)
                    {
                        var contacts = apiResponse.Contacts.Select(MapToContact).ToList();
                        System.Diagnostics.Debug.WriteLine($"[ApiContactService] Retrieved {contacts.Count} contacts");

                        // Cache contacts for offline use
                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                foreach (var contact in contacts)
                                {
                                    await LocalCache.CacheContactAsync(MapToDbContact(contact));
                                }
                                System.Diagnostics.Debug.WriteLine($"[ApiContactService] Cached {contacts.Count} contacts");
                            }
                            catch (Exception ex)
                            {
                                System.Diagnostics.Debug.WriteLine($"[ApiContactService] Failed to cache contacts: {ex.Message}");
                            }
                        });

                        return new ContactServiceResult<List<Contact>>
                        {
                            Success = true,
                            Data = contacts,
                            TotalCount = apiResponse.TotalCount
                        };
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[ApiContactService] ApiContactsListResponse parse failed: {ex.Message}");
                }

                // Try direct list parsing
                try
                {
                    var directContacts = JsonSerializer.Deserialize<List<ContactDto>>(content, _jsonOptions);
                    if (directContacts != null)
                    {
                        var contacts = directContacts.Select(MapToContact).ToList();
                        System.Diagnostics.Debug.WriteLine($"[ApiContactService] Retrieved {contacts.Count} contacts (direct)");

                        // Cache contacts for offline use
                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                foreach (var contact in contacts)
                                {
                                    await LocalCache.CacheContactAsync(MapToDbContact(contact));
                                }
                            }
                            catch (Exception ex)
                            {
                                System.Diagnostics.Debug.WriteLine($"[ApiContactService] Failed to cache contacts: {ex.Message}");
                            }
                        });

                        return new ContactServiceResult<List<Contact>>
                        {
                            Success = true,
                            Data = contacts
                        };
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[ApiContactService] Direct list parse failed: {ex.Message}");
                }

                return new ContactServiceResult<List<Contact>>
                {
                    Success = false,
                    Error = "Failed to parse contacts response",
                    Data = new List<Contact>()
                };
            }

            System.Diagnostics.Debug.WriteLine($"[ApiContactService] GET contacts failed: {response.StatusCode}");
            return new ContactServiceResult<List<Contact>>
            {
                Success = false,
                Error = $"Failed to get contacts: {response.StatusCode}",
                StatusCode = response.StatusCode,
                Data = new List<Contact>()
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] GetContacts error: {ex.Message}");

            // On network error, try to return cached contacts
            try
            {
                var cachedContacts = await LocalCache.GetCachedContactsAsync();
                var mappedContacts = cachedContacts.Select(MapFromDbContact).ToList();
                return new ContactServiceResult<List<Contact>>
                {
                    Success = true,
                    Data = mappedContacts,
                    Error = $"Loaded from cache due to: {ex.Message}"
                };
            }
            catch
            {
                return new ContactServiceResult<List<Contact>>
                {
                    Success = false,
                    Error = ex.Message,
                    Data = new List<Contact>()
                };
            }
        }
    }

    /// <summary>
    /// Gets a contact by ID with detailed result
    /// GET /api/v1/contacts/{id}
    /// </summary>
    public async Task<ContactServiceResult<Contact>> GetContactByIdWithResultAsync(string contactId)
    {
        try
        {
            if (string.IsNullOrEmpty(contactId))
            {
                return new ContactServiceResult<Contact>
                {
                    Success = false,
                    Error = "Contact ID is required"
                };
            }

            // If offline, try to get from cache
            if (!IsOnline)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiContactService] Offline - getting contact from cache: {contactId}");
                var cachedContact = await LocalCache.GetContactByIdAsync(contactId);
                if (cachedContact != null)
                {
                    return new ContactServiceResult<Contact>
                    {
                        Success = true,
                        Data = MapFromDbContact(cachedContact)
                    };
                }
                return new ContactServiceResult<Contact>
                {
                    Success = false,
                    Error = "Contact not found in cache"
                };
            }

            var endpoint = $"contacts/{Uri.EscapeDataString(contactId)}";
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] GET {endpoint}");

            var response = await _httpClientFactory.GetAsync(ApiEndpoint.InspireCodex, endpoint);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                // Try API response wrapper first
                try
                {
                    var apiResponse = JsonSerializer.Deserialize<ApiContactSingleResponse>(content, _jsonOptions);
                    if (apiResponse?.Contact != null)
                    {
                        return new ContactServiceResult<Contact>
                        {
                            Success = true,
                            Data = MapToContact(apiResponse.Contact)
                        };
                    }
                }
                catch { }

                // Try direct parsing
                var dto = JsonSerializer.Deserialize<ContactDto>(content, _jsonOptions);
                if (dto != null)
                {
                    return new ContactServiceResult<Contact>
                    {
                        Success = true,
                        Data = MapToContact(dto)
                    };
                }

                return new ContactServiceResult<Contact>
                {
                    Success = false,
                    Error = "Failed to parse contact response"
                };
            }

            return new ContactServiceResult<Contact>
            {
                Success = false,
                Error = $"Failed to get contact: {response.StatusCode}",
                StatusCode = response.StatusCode
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] GetContactById error: {ex.Message}");
            return new ContactServiceResult<Contact>
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    /// <summary>
    /// Creates a new contact with detailed result
    /// Supports offline-first: queues create when offline
    /// POST /api/v1/contacts
    /// </summary>
    public async Task<ContactServiceResult<Contact>> CreateContactWithResultAsync(Contact contact)
    {
        if (RateLimitTracker.Instance.ShouldThrottle())
        {
            return new ContactServiceResult<Contact>
            {
                Success = false,
                Error = $"Rate limited. Please wait {RateLimitTracker.Instance.RetryAfterSeconds}s.",
                IsRateLimited = true,
                RetryAfterSeconds = RateLimitTracker.Instance.RetryAfterSeconds,
                StatusCode = HttpStatusCode.TooManyRequests
            };
        }

        try
        {
            if (contact == null)
            {
                return new ContactServiceResult<Contact>
                {
                    Success = false,
                    Error = "Contact is required"
                };
            }

            // If offline, cache locally and queue for sync
            if (!IsOnline)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiContactService] Offline - queueing contact creation: {contact.DisplayName}");
                return await QueueContactForOfflineCreation(contact);
            }

            var dto = MapToDto(contact);
            var endpoint = "contacts";

            System.Diagnostics.Debug.WriteLine($"[ApiContactService] ============ CREATE CONTACT ============");
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] POST endpoint: '{endpoint}'");
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] Contact: {contact.DisplayName}");
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] UserId being sent: {dto.UserId}");
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] ServiceConfiguration.UserId: {ServiceConfiguration.UserId ?? "(null)"}");
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] ServiceConfiguration.UserEmail: {ServiceConfiguration.UserEmail ?? "(null)"}");

            var response = await _httpClientFactory.PostAsync(ApiEndpoint.InspireCodex, endpoint, dto);
            var content = await response.Content.ReadAsStringAsync();

            System.Diagnostics.Debug.WriteLine($"[ApiContactService] Response status: {response.StatusCode}");
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] Response content: {content}");

            if (response.IsSuccessStatusCode)
            {
                // Try API response wrapper first
                try
                {
                    var apiResponse = JsonSerializer.Deserialize<ApiContactSingleResponse>(content, _jsonOptions);
                    if (apiResponse?.Contact != null)
                    {
                        var createdContact = MapToContact(apiResponse.Contact);
                        System.Diagnostics.Debug.WriteLine($"[ApiContactService] Created contact: {createdContact.Id}");

                        // Cache the created contact
                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                await LocalCache.CacheContactAsync(MapToDbContact(createdContact));
                            }
                            catch { }
                        });

                        return new ContactServiceResult<Contact>
                        {
                            Success = true,
                            Data = createdContact
                        };
                    }
                }
                catch { }

                // Try direct parsing
                var createdDto = JsonSerializer.Deserialize<ContactDto>(content, _jsonOptions);
                if (createdDto != null)
                {
                    var createdContact = MapToContact(createdDto);
                    System.Diagnostics.Debug.WriteLine($"[ApiContactService] Created contact: {createdContact.Id}");

                    // Cache the created contact
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            await LocalCache.CacheContactAsync(MapToDbContact(createdContact));
                        }
                        catch { }
                    });

                    return new ContactServiceResult<Contact>
                    {
                        Success = true,
                        Data = createdContact
                    };
                }

                // If no response body, return original with success
                return new ContactServiceResult<Contact>
                {
                    Success = true,
                    Data = contact
                };
            }

            // Handle duplicate detection (409 Conflict)
            if (response.StatusCode == HttpStatusCode.Conflict)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiContactService] Duplicate contact detected: {content}");
                try
                {
                    var duplicateResponse = JsonSerializer.Deserialize<ApiDuplicateResponse>(content, _jsonOptions);
                    if (duplicateResponse?.Code == "DUPLICATE_DETECTED")
                    {
                        return new ContactServiceResult<Contact>
                        {
                            Success = false,
                            Error = "DUPLICATE_DETECTED",
                            StatusCode = HttpStatusCode.Conflict
                        };
                    }
                }
                catch { }
            }

            System.Diagnostics.Debug.WriteLine($"[ApiContactService] Create failed: {response.StatusCode} - {content}");
            return new ContactServiceResult<Contact>
            {
                Success = false,
                Error = $"Failed to create contact: {response.StatusCode} - {content}",
                StatusCode = response.StatusCode
            };
        }
        catch (HttpRequestException ex)
        {
            // Network error - return error (offline queueing disabled)
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] Network error: {ex.Message}");
            return new ContactServiceResult<Contact>
            {
                Success = false,
                Error = $"Network error: {ex.Message}. Please check your connection."
            };
        }
        catch (TaskCanceledException ex) when (ex.InnerException is TimeoutException)
        {
            // Timeout - return error
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] Request timeout: {ex.Message}");
            return new ContactServiceResult<Contact>
            {
                Success = false,
                Error = "Request timed out. Please try again."
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] CreateContact error: {ex.Message}");
            return new ContactServiceResult<Contact>
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    /// <summary>
    /// Queues a contact for offline creation when API is unreachable
    /// </summary>
    private async Task<ContactServiceResult<Contact>> QueueContactForOfflineCreation(Contact contact)
    {
        // Generate a temporary ID if not set
        if (string.IsNullOrEmpty(contact.Id))
        {
            contact.Id = $"temp-{Guid.NewGuid()}";
        }

        // Cache the contact locally
        try
        {
            await LocalCache.CacheContactAsync(MapToDbContact(contact));
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] Cached contact locally: {contact.Id}");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] Failed to cache contact: {ex.Message}");
        }

        // Queue the create operation
        var contactPayload = new
        {
            displayName = contact.DisplayName,
            firstName = contact.FirstName,
            lastName = contact.LastName,
            emailAddresses = contact.EmailAddresses,
            phoneNumbers = contact.PhoneNumbers,
            mobilePhone = contact.MobilePhone,
            company = contact.Company,
            jobTitle = contact.JobTitle,
            department = contact.Department,
            office = contact.Office,
            address = contact.Address,
            city = contact.City,
            state = contact.State,
            postalCode = contact.PostalCode,
            country = contact.Country,
            notes = contact.Notes,
            birthday = contact.Birthday,
            anniversary = contact.Anniversary,
            spouse = contact.Spouse,
            website = contact.Website,
            isFavorite = contact.IsFavorite,
            category = contact.Category
        };

        await SyncQueue.QueueOperationAsync(
            SyncEntityTypes.Contact,
            contact.Id,
            SyncOperationTypes.Create,
            contactPayload);

        return new ContactServiceResult<Contact>
        {
            Success = true,
            Data = contact
        };
    }

    /// <summary>
    /// Updates an existing contact with detailed result
    /// Supports offline-first: queues update when offline
    /// PUT /api/v1/contacts/{id}
    /// </summary>
    public async Task<ContactServiceResult<Contact>> UpdateContactWithResultAsync(Contact contact)
    {
        if (RateLimitTracker.Instance.ShouldThrottle())
        {
            return new ContactServiceResult<Contact>
            {
                Success = false,
                Error = $"Rate limited. Please wait {RateLimitTracker.Instance.RetryAfterSeconds}s.",
                IsRateLimited = true,
                RetryAfterSeconds = RateLimitTracker.Instance.RetryAfterSeconds,
                StatusCode = HttpStatusCode.TooManyRequests
            };
        }

        try
        {
            if (contact == null)
            {
                return new ContactServiceResult<Contact>
                {
                    Success = false,
                    Error = "Contact is required"
                };
            }

            if (string.IsNullOrEmpty(contact.Id))
            {
                return new ContactServiceResult<Contact>
                {
                    Success = false,
                    Error = "Contact ID is required for update"
                };
            }

            // If offline, cache locally and queue for sync
            if (!IsOnline)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiContactService] Offline - queueing contact update: {contact.DisplayName}");

                // Update local cache
                try
                {
                    await LocalCache.CacheContactAsync(MapToDbContact(contact));
                    System.Diagnostics.Debug.WriteLine($"[ApiContactService] Updated contact in local cache: {contact.Id}");
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[ApiContactService] Failed to update local cache: {ex.Message}");
                }

                // Queue the update operation
                var contactPayload = new
                {
                    displayName = contact.DisplayName,
                    firstName = contact.FirstName,
                    lastName = contact.LastName,
                    emailAddresses = contact.EmailAddresses,
                    phoneNumbers = contact.PhoneNumbers,
                    mobilePhone = contact.MobilePhone,
                    company = contact.Company,
                    jobTitle = contact.JobTitle,
                    department = contact.Department,
                    office = contact.Office,
                    address = contact.Address,
                    city = contact.City,
                    state = contact.State,
                    postalCode = contact.PostalCode,
                    country = contact.Country,
                    notes = contact.Notes,
                    birthday = contact.Birthday,
                    anniversary = contact.Anniversary,
                    spouse = contact.Spouse,
                    website = contact.Website,
                    isFavorite = contact.IsFavorite,
                    category = contact.Category
                };

                await SyncQueue.QueueOperationAsync(
                    SyncEntityTypes.Contact,
                    contact.Id,
                    SyncOperationTypes.Update,
                    contactPayload);

                return new ContactServiceResult<Contact>
                {
                    Success = true,
                    Data = contact
                };
            }

            var dto = MapToDto(contact);
            var endpoint = $"contacts/{Uri.EscapeDataString(contact.Id)}";

            System.Diagnostics.Debug.WriteLine($"[ApiContactService] PUT {endpoint} - {contact.DisplayName}");

            var response = await _httpClientFactory.PutAsync(ApiEndpoint.InspireCodex, endpoint, dto);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                // Try API response wrapper first
                try
                {
                    var apiResponse = JsonSerializer.Deserialize<ApiContactSingleResponse>(content, _jsonOptions);
                    if (apiResponse?.Contact != null)
                    {
                        var updatedContact = MapToContact(apiResponse.Contact);
                        System.Diagnostics.Debug.WriteLine($"[ApiContactService] Updated contact: {updatedContact.Id}");

                        // Update cache
                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                await LocalCache.CacheContactAsync(MapToDbContact(updatedContact));
                            }
                            catch { }
                        });

                        return new ContactServiceResult<Contact>
                        {
                            Success = true,
                            Data = updatedContact
                        };
                    }
                }
                catch { }

                // Try direct parsing
                var updatedDto = JsonSerializer.Deserialize<ContactDto>(content, _jsonOptions);
                if (updatedDto != null)
                {
                    var updatedContact = MapToContact(updatedDto);
                    System.Diagnostics.Debug.WriteLine($"[ApiContactService] Updated contact: {updatedContact.Id}");

                    // Update cache
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            await LocalCache.CacheContactAsync(MapToDbContact(updatedContact));
                        }
                        catch { }
                    });

                    return new ContactServiceResult<Contact>
                    {
                        Success = true,
                        Data = updatedContact
                    };
                }

                // If no response body, return original with success
                System.Diagnostics.Debug.WriteLine($"[ApiContactService] Updated contact (no body): {contact.Id}");
                return new ContactServiceResult<Contact>
                {
                    Success = true,
                    Data = contact
                };
            }

            System.Diagnostics.Debug.WriteLine($"[ApiContactService] Update failed: {response.StatusCode} - {content}");
            return new ContactServiceResult<Contact>
            {
                Success = false,
                Error = $"Failed to update contact: {response.StatusCode}",
                StatusCode = response.StatusCode
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] UpdateContact error: {ex.Message}");
            return new ContactServiceResult<Contact>
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    /// <summary>
    /// Deletes a contact with detailed result
    /// Supports offline-first: queues delete when offline
    /// DELETE /api/v1/contacts/{id}
    /// </summary>
    public async Task<ContactServiceResult<bool>> DeleteContactWithResultAsync(string contactId)
    {
        if (RateLimitTracker.Instance.ShouldThrottle())
        {
            return new ContactServiceResult<bool>
            {
                Success = false,
                Error = $"Rate limited. Please wait {RateLimitTracker.Instance.RetryAfterSeconds}s.",
                IsRateLimited = true,
                RetryAfterSeconds = RateLimitTracker.Instance.RetryAfterSeconds,
                StatusCode = HttpStatusCode.TooManyRequests
            };
        }

        try
        {
            if (string.IsNullOrEmpty(contactId))
            {
                return new ContactServiceResult<bool>
                {
                    Success = false,
                    Error = "Contact ID is required",
                    Data = false
                };
            }

            // Mark as deleted in local cache (optimistic update)
            try
            {
                await LocalCache.DeleteContactAsync(contactId);
                System.Diagnostics.Debug.WriteLine($"[ApiContactService] Deleted contact from local cache: {contactId}");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiContactService] Failed to delete from local cache: {ex.Message}");
            }

            // If offline, queue the delete operation
            if (!IsOnline)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiContactService] Offline - queueing contact deletion: {contactId}");
                await SyncQueue.QueueOperationAsync(
                    SyncEntityTypes.Contact,
                    contactId,
                    SyncOperationTypes.Delete);

                return new ContactServiceResult<bool>
                {
                    Success = true,
                    Data = true
                };
            }

            var endpoint = $"contacts/{Uri.EscapeDataString(contactId)}";
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] DELETE {endpoint}");

            var response = await _httpClientFactory.DeleteAsync(ApiEndpoint.InspireCodex, endpoint);

            if (response.IsSuccessStatusCode)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiContactService] Deleted contact: {contactId}");
                return new ContactServiceResult<bool>
                {
                    Success = true,
                    Data = true
                };
            }

            // 404 is acceptable - contact may already be deleted
            if (response.StatusCode == HttpStatusCode.NotFound)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiContactService] Contact not found (already deleted?): {contactId}");
                return new ContactServiceResult<bool>
                {
                    Success = true,
                    Data = true,
                    Error = "Contact not found"
                };
            }

            var content = await response.Content.ReadAsStringAsync();
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] Delete failed: {response.StatusCode} - {content}");

            return new ContactServiceResult<bool>
            {
                Success = false,
                Error = $"Failed to delete contact: {response.StatusCode}",
                StatusCode = response.StatusCode,
                Data = false
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] DeleteContact error: {ex.Message}");
            return new ContactServiceResult<bool>
            {
                Success = false,
                Error = ex.Message,
                Data = false
            };
        }
    }

    /// <summary>
    /// Searches contacts with detailed result
    /// GET /api/v1/contacts/search?q={query}
    /// </summary>
    public async Task<ContactServiceResult<List<Contact>>> SearchContactsWithResultAsync(string query, int page = 1, int pageSize = 50)
    {
        if (RateLimitTracker.Instance.ShouldThrottle())
        {
            System.Diagnostics.Debug.WriteLine("[ApiContactService] Rate limited - returning cached contacts for search");
            return await GetRateLimitedContactsResultAsync();
        }

        try
        {
            if (string.IsNullOrEmpty(query))
            {
                return new ContactServiceResult<List<Contact>>
                {
                    Success = false,
                    Error = "Search query is required",
                    Data = new List<Contact>()
                };
            }

            // If offline, search in cache
            if (!IsOnline)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiContactService] Offline - searching contacts in cache: {query}");
                var cachedContacts = await LocalCache.SearchContactsAsync(query);
                var mappedContacts = cachedContacts.Select(MapFromDbContact).ToList();
                return new ContactServiceResult<List<Contact>>
                {
                    Success = true,
                    Data = mappedContacts
                };
            }

            var queryParams = new List<string>
            {
                $"q={Uri.EscapeDataString(query)}",
                $"page={page}",
                $"pageSize={pageSize}"
            };

            var endpoint = $"contacts/search?{string.Join("&", queryParams)}";
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] GET {endpoint}");

            var response = await _httpClientFactory.GetAsync(ApiEndpoint.InspireCodex, endpoint);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                // Try API response wrapper first
                try
                {
                    var apiResponse = JsonSerializer.Deserialize<ApiContactsListResponse>(content, _jsonOptions);
                    if (apiResponse?.Contacts != null)
                    {
                        var contacts = apiResponse.Contacts.Select(MapToContact).ToList();
                        System.Diagnostics.Debug.WriteLine($"[ApiContactService] Search returned {contacts.Count} contacts");
                        return new ContactServiceResult<List<Contact>>
                        {
                            Success = true,
                            Data = contacts,
                            TotalCount = apiResponse.TotalCount
                        };
                    }
                }
                catch { }

                // Try direct list parsing
                var directContacts = JsonSerializer.Deserialize<List<ContactDto>>(content, _jsonOptions);
                if (directContacts != null)
                {
                    var contacts = directContacts.Select(MapToContact).ToList();
                    System.Diagnostics.Debug.WriteLine($"[ApiContactService] Search returned {contacts.Count} contacts (direct)");
                    return new ContactServiceResult<List<Contact>>
                    {
                        Success = true,
                        Data = contacts
                    };
                }

                return new ContactServiceResult<List<Contact>>
                {
                    Success = false,
                    Error = "Failed to parse search response",
                    Data = new List<Contact>()
                };
            }

            System.Diagnostics.Debug.WriteLine($"[ApiContactService] Search failed: {response.StatusCode}");
            return new ContactServiceResult<List<Contact>>
            {
                Success = false,
                Error = $"Search failed: {response.StatusCode}",
                StatusCode = response.StatusCode,
                Data = new List<Contact>()
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] Search error: {ex.Message}");

            // On network error, try to search in cache
            try
            {
                var cachedContacts = await LocalCache.SearchContactsAsync(query);
                var mappedContacts = cachedContacts.Select(MapFromDbContact).ToList();
                return new ContactServiceResult<List<Contact>>
                {
                    Success = true,
                    Data = mappedContacts,
                    Error = $"Searched cache due to: {ex.Message}"
                };
            }
            catch
            {
                return new ContactServiceResult<List<Contact>>
                {
                    Success = false,
                    Error = ex.Message,
                    Data = new List<Contact>()
                };
            }
        }
    }

    #endregion

    #region Mapping Methods

    private static Contact MapToContact(ContactDto dto)
    {
        return new Contact
        {
            Id = dto.Id ?? Guid.NewGuid().ToString(),
            DisplayName = dto.DisplayName ?? string.Empty,
            FirstName = dto.FirstName,
            LastName = dto.LastName,
            Title = dto.Title,
            MiddleName = dto.MiddleName,
            Suffix = dto.Suffix,
            Nickname = dto.Nickname,
            EmailAddresses = dto.EmailAddresses ?? new List<string>(),
            PhoneNumbers = dto.PhoneNumbers ?? new List<string>(),
            MobilePhone = dto.MobilePhone,
            Company = dto.Company,
            JobTitle = dto.JobTitle,
            Department = dto.Department,
            Office = dto.Office,
            Address = dto.Address,
            City = dto.City,
            State = dto.State,
            PostalCode = dto.PostalCode,
            Country = dto.Country,
            Notes = dto.Notes,
            PhotoUrl = dto.PhotoUrl,
            Birthday = dto.Birthday,
            Anniversary = dto.Anniversary,
            Spouse = dto.Spouse,
            Website = dto.Website,
            IsFavorite = dto.IsFavorite,
            IsDeleted = dto.IsDeleted,
            DeletedAt = dto.DeletedAt,
            Category = dto.Category,
            CreatedDate = dto.CreatedAt ?? DateTime.Now,
            ModifiedDate = dto.UpdatedAt ?? DateTime.Now
        };
    }

    private static ContactDto MapToDto(Contact contact)
    {
        return new ContactDto
        {
            Id = contact.Id,
            UserId = ServiceConfiguration.RequireUserId(),
            DisplayName = contact.DisplayName,
            FirstName = contact.FirstName,
            LastName = contact.LastName,
            Title = contact.Title,
            MiddleName = contact.MiddleName,
            Suffix = contact.Suffix,
            Nickname = contact.Nickname,
            EmailAddresses = contact.EmailAddresses,
            PhoneNumbers = contact.PhoneNumbers,
            MobilePhone = contact.MobilePhone,
            Company = contact.Company,
            JobTitle = contact.JobTitle,
            Department = contact.Department,
            Office = contact.Office,
            Address = contact.Address,
            City = contact.City,
            State = contact.State,
            PostalCode = contact.PostalCode,
            Country = contact.Country,
            Notes = contact.Notes,
            PhotoUrl = contact.PhotoUrl,
            Birthday = contact.Birthday,
            Anniversary = contact.Anniversary,
            Spouse = contact.Spouse,
            Website = contact.Website,
            IsFavorite = contact.IsFavorite,
            IsDeleted = contact.IsDeleted,
            DeletedAt = contact.DeletedAt,
            Category = contact.Category,
            SkipDuplicateCheck = contact.SkipDuplicateCheck
        };
    }

    /// <summary>
    /// Maps from LocalCacheService Contact (DbContact) to Models.Contact
    /// </summary>
    private static Contact MapFromDbContact(Models.Contact dbContact)
    {
        // DbContact and Models.Contact are the same class
        return dbContact;
    }

    /// <summary>
    /// Maps from Models.Contact to LocalCacheService Contact (DbContact)
    /// </summary>
    private static Models.Contact MapToDbContact(Contact contact)
    {
        // They are the same class
        return contact;
    }

    #endregion

    #region Contact Groups

    /// <summary>
    /// Gets all contact groups for the current user
    /// GET /api/v1/contact-groups
    /// </summary>
    public async Task<ContactServiceResult<List<ContactGroupDto>>> GetContactGroupsAsync()
    {
        try
        {
            var userId = ServiceConfiguration.RequireUserId();
            var endpoint = $"contact-groups?userId={Uri.EscapeDataString(userId)}";
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] GET {endpoint}");

            var response = await _httpClientFactory.GetAsync(ApiEndpoint.InspireCodex, endpoint);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                var apiResponse = JsonSerializer.Deserialize<ApiContactGroupsListResponse>(content, _jsonOptions);
                if (apiResponse?.Success == true && apiResponse.Data != null)
                {
                    System.Diagnostics.Debug.WriteLine($"[ApiContactService] Retrieved {apiResponse.Data.Count} contact groups");
                    return new ContactServiceResult<List<ContactGroupDto>>
                    {
                        Success = true,
                        Data = apiResponse.Data
                    };
                }
            }

            System.Diagnostics.Debug.WriteLine($"[ApiContactService] GET contact-groups failed: {response.StatusCode}");
            return new ContactServiceResult<List<ContactGroupDto>>
            {
                Success = false,
                Error = $"Failed to get contact groups: {response.StatusCode}",
                Data = new List<ContactGroupDto>()
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] GetContactGroups error: {ex.Message}");
            return new ContactServiceResult<List<ContactGroupDto>>
            {
                Success = false,
                Error = ex.Message,
                Data = new List<ContactGroupDto>()
            };
        }
    }

    /// <summary>
    /// Gets a single contact group with its members
    /// GET /api/v1/contact-groups/{id}
    /// </summary>
    public async Task<ContactServiceResult<ContactGroupDetailDto>> GetContactGroupAsync(string groupId)
    {
        try
        {
            var userId = ServiceConfiguration.RequireUserId();
            var endpoint = $"contact-groups/{Uri.EscapeDataString(groupId)}?userId={Uri.EscapeDataString(userId)}";
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] GET {endpoint}");

            var response = await _httpClientFactory.GetAsync(ApiEndpoint.InspireCodex, endpoint);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                var apiResponse = JsonSerializer.Deserialize<ApiContactGroupDetailResponse>(content, _jsonOptions);
                if (apiResponse?.Success == true && apiResponse.Data != null)
                {
                    return new ContactServiceResult<ContactGroupDetailDto>
                    {
                        Success = true,
                        Data = apiResponse.Data
                    };
                }
            }

            return new ContactServiceResult<ContactGroupDetailDto>
            {
                Success = false,
                Error = $"Failed to get contact group: {response.StatusCode}"
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] GetContactGroup error: {ex.Message}");
            return new ContactServiceResult<ContactGroupDetailDto>
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    /// <summary>
    /// Creates a new contact group
    /// POST /api/v1/contact-groups
    /// </summary>
    public async Task<ContactServiceResult<ContactGroupDto>> CreateContactGroupAsync(string name, string? description = null)
    {
        try
        {
            var userId = ServiceConfiguration.RequireUserId();
            var endpoint = $"contact-groups?userId={Uri.EscapeDataString(userId)}";
            var payload = new { name, description };

            System.Diagnostics.Debug.WriteLine($"[ApiContactService] POST {endpoint} - {name}");

            var response = await _httpClientFactory.PostAsync(ApiEndpoint.InspireCodex, endpoint, payload);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                var apiResponse = JsonSerializer.Deserialize<ApiContactGroupSingleResponse>(content, _jsonOptions);
                if (apiResponse?.Success == true && apiResponse.Data != null)
                {
                    System.Diagnostics.Debug.WriteLine($"[ApiContactService] Created contact group: {apiResponse.Data.Id}");
                    return new ContactServiceResult<ContactGroupDto>
                    {
                        Success = true,
                        Data = apiResponse.Data
                    };
                }
            }

            return new ContactServiceResult<ContactGroupDto>
            {
                Success = false,
                Error = $"Failed to create contact group: {response.StatusCode}"
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] CreateContactGroup error: {ex.Message}");
            return new ContactServiceResult<ContactGroupDto>
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    /// <summary>
    /// Renames/updates a contact group
    /// PUT /api/v1/contact-groups/{id}
    /// </summary>
    public async Task<ContactServiceResult<ContactGroupDto>> UpdateContactGroupAsync(string groupId, string name, string? description = null)
    {
        try
        {
            var userId = ServiceConfiguration.RequireUserId();
            var endpoint = $"contact-groups/{Uri.EscapeDataString(groupId)}?userId={Uri.EscapeDataString(userId)}";
            var payload = new { name, description };
            var json = JsonSerializer.Serialize(payload, _jsonOptions);
            var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

            System.Diagnostics.Debug.WriteLine($"[ApiContactService] PUT {endpoint}");

            var response = await _httpClientFactory.PutAsync(ApiEndpoint.InspireCodex, endpoint, content);
            if (response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync();
                var apiResponse = JsonSerializer.Deserialize<ApiContactGroupSingleResponse>(responseContent, _jsonOptions);

                if (apiResponse?.Success == true && apiResponse.Data != null)
                {
                    return new ContactServiceResult<ContactGroupDto>
                    {
                        Success = true,
                        Data = apiResponse.Data
                    };
                }
            }

            return new ContactServiceResult<ContactGroupDto>
            {
                Success = false,
                Error = $"Failed to update contact group: {response.StatusCode}"
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] UpdateContactGroup error: {ex.Message}");
            return new ContactServiceResult<ContactGroupDto>
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    /// <summary>
    /// Deletes a contact group
    /// DELETE /api/v1/contact-groups/{id}
    /// </summary>
    public async Task<ContactServiceResult<bool>> DeleteContactGroupAsync(string groupId)
    {
        try
        {
            var userId = ServiceConfiguration.RequireUserId();
            var endpoint = $"contact-groups/{Uri.EscapeDataString(groupId)}?userId={Uri.EscapeDataString(userId)}";
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] DELETE {endpoint}");

            var response = await _httpClientFactory.DeleteAsync(ApiEndpoint.InspireCodex, endpoint);

            if (response.IsSuccessStatusCode)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiContactService] Deleted contact group: {groupId}");
                return new ContactServiceResult<bool> { Success = true, Data = true };
            }

            return new ContactServiceResult<bool>
            {
                Success = false,
                Error = $"Failed to delete contact group: {response.StatusCode}",
                Data = false
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] DeleteContactGroup error: {ex.Message}");
            return new ContactServiceResult<bool> { Success = false, Error = ex.Message, Data = false };
        }
    }

    /// <summary>
    /// Adds contacts to a group
    /// POST /api/v1/contact-groups/{id}/members
    /// </summary>
    public async Task<ContactServiceResult<int>> AddContactsToGroupAsync(string groupId, List<string> contactIds)
    {
        try
        {
            var userId = ServiceConfiguration.RequireUserId();
            var endpoint = $"contact-groups/{Uri.EscapeDataString(groupId)}/members?userId={Uri.EscapeDataString(userId)}";
            var payload = new { contactIds };

            System.Diagnostics.Debug.WriteLine($"[ApiContactService] POST {endpoint} - {contactIds.Count} contacts");

            var response = await _httpClientFactory.PostAsync(ApiEndpoint.InspireCodex, endpoint, payload);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                var apiResponse = JsonSerializer.Deserialize<ApiAddMembersResponse>(content, _jsonOptions);
                if (apiResponse?.Success == true)
                {
                    return new ContactServiceResult<int>
                    {
                        Success = true,
                        Data = apiResponse.Added
                    };
                }
            }

            return new ContactServiceResult<int>
            {
                Success = false,
                Error = $"Failed to add contacts to group: {response.StatusCode}"
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] AddContactsToGroup error: {ex.Message}");
            return new ContactServiceResult<int> { Success = false, Error = ex.Message };
        }
    }

    /// <summary>
    /// Removes a contact from a group
    /// DELETE /api/v1/contact-groups/{id}/members/{contactId}
    /// </summary>
    public async Task<ContactServiceResult<bool>> RemoveContactFromGroupAsync(string groupId, string contactId)
    {
        try
        {
            var userId = ServiceConfiguration.RequireUserId();
            var endpoint = $"contact-groups/{Uri.EscapeDataString(groupId)}/members/{Uri.EscapeDataString(contactId)}?userId={Uri.EscapeDataString(userId)}";
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] DELETE {endpoint}");

            var response = await _httpClientFactory.DeleteAsync(ApiEndpoint.InspireCodex, endpoint);

            if (response.IsSuccessStatusCode)
            {
                return new ContactServiceResult<bool> { Success = true, Data = true };
            }

            return new ContactServiceResult<bool>
            {
                Success = false,
                Error = $"Failed to remove contact from group: {response.StatusCode}",
                Data = false
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiContactService] RemoveContactFromGroup error: {ex.Message}");
            return new ContactServiceResult<bool> { Success = false, Error = ex.Message, Data = false };
        }
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

    #endregion
}

#region Service Result and DTOs

/// <summary>
/// Generic result wrapper for contact service operations
/// </summary>
public class ContactServiceResult<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }
    public string? Error { get; set; }
    public HttpStatusCode StatusCode { get; set; } = HttpStatusCode.OK;
    public int? TotalCount { get; set; }
    public bool IsRateLimited { get; set; }
    public int? RetryAfterSeconds { get; set; }
}

/// <summary>
/// API response for contacts list
/// </summary>
internal class ApiContactsListResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("error")]
    public string? Error { get; set; }

    [JsonPropertyName("contacts")]
    public List<ContactDto>? Contacts { get; set; }

    [JsonPropertyName("totalCount")]
    public int? TotalCount { get; set; }

    [JsonPropertyName("page")]
    public int? Page { get; set; }

    [JsonPropertyName("pageSize")]
    public int? PageSize { get; set; }
}

/// <summary>
/// API response for single contact
/// </summary>
internal class ApiContactSingleResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("error")]
    public string? Error { get; set; }

    [JsonPropertyName("contact")]
    public ContactDto? Contact { get; set; }
}

/// <summary>
/// Contact data transfer object for API communication
/// </summary>
public class ContactDto
{
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    [JsonPropertyName("userId")]
    public string? UserId { get; set; }

    [JsonPropertyName("displayName")]
    public string? DisplayName { get; set; }

    [JsonPropertyName("firstName")]
    public string? FirstName { get; set; }

    [JsonPropertyName("lastName")]
    public string? LastName { get; set; }

    [JsonPropertyName("title")]
    public string? Title { get; set; }

    [JsonPropertyName("middleName")]
    public string? MiddleName { get; set; }

    [JsonPropertyName("suffix")]
    public string? Suffix { get; set; }

    [JsonPropertyName("nickname")]
    public string? Nickname { get; set; }

    [JsonPropertyName("emailAddresses")]
    public List<string>? EmailAddresses { get; set; }

    [JsonPropertyName("phoneNumbers")]
    public List<string>? PhoneNumbers { get; set; }

    [JsonPropertyName("mobilePhone")]
    public string? MobilePhone { get; set; }

    [JsonPropertyName("company")]
    public string? Company { get; set; }

    [JsonPropertyName("jobTitle")]
    public string? JobTitle { get; set; }

    [JsonPropertyName("department")]
    public string? Department { get; set; }

    [JsonPropertyName("office")]
    public string? Office { get; set; }

    [JsonPropertyName("address")]
    public string? Address { get; set; }

    [JsonPropertyName("city")]
    public string? City { get; set; }

    [JsonPropertyName("state")]
    public string? State { get; set; }

    [JsonPropertyName("postalCode")]
    public string? PostalCode { get; set; }

    [JsonPropertyName("country")]
    public string? Country { get; set; }

    [JsonPropertyName("notes")]
    public string? Notes { get; set; }

    [JsonPropertyName("photoUrl")]
    public string? PhotoUrl { get; set; }

    [JsonPropertyName("birthday")]
    public DateTime? Birthday { get; set; }

    [JsonPropertyName("anniversary")]
    public DateTime? Anniversary { get; set; }

    [JsonPropertyName("spouse")]
    public string? Spouse { get; set; }

    [JsonPropertyName("website")]
    public string? Website { get; set; }

    [JsonPropertyName("isFavorite")]
    public bool IsFavorite { get; set; }

    [JsonPropertyName("isDeleted")]
    public bool IsDeleted { get; set; }

    [JsonPropertyName("deletedAt")]
    public DateTime? DeletedAt { get; set; }

    [JsonPropertyName("category")]
    public string? Category { get; set; }

    [JsonPropertyName("skipDuplicateCheck")]
    public bool SkipDuplicateCheck { get; set; }

    [JsonPropertyName("createdAt")]
    public DateTime? CreatedAt { get; set; }

    [JsonPropertyName("updatedAt")]
    public DateTime? UpdatedAt { get; set; }
}

/// <summary>
/// Contact group data transfer object
/// </summary>
public class ContactGroupDto
{
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    [JsonPropertyName("userId")]
    public string? UserId { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("memberCount")]
    public int MemberCount { get; set; }

    [JsonPropertyName("createdAt")]
    public DateTime? CreatedAt { get; set; }

    [JsonPropertyName("updatedAt")]
    public DateTime? UpdatedAt { get; set; }
}

/// <summary>
/// Contact group detail with members list
/// </summary>
public class ContactGroupDetailDto : ContactGroupDto
{
    [JsonPropertyName("members")]
    public List<ContactDto>? Members { get; set; }
}

/// <summary>
/// API response for contact groups list
/// </summary>
internal class ApiContactGroupsListResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("data")]
    public List<ContactGroupDto>? Data { get; set; }
}

/// <summary>
/// API response for single contact group
/// </summary>
internal class ApiContactGroupSingleResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("data")]
    public ContactGroupDto? Data { get; set; }
}

/// <summary>
/// API response for contact group detail with members
/// </summary>
internal class ApiContactGroupDetailResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("data")]
    public ContactGroupDetailDto? Data { get; set; }
}

/// <summary>
/// API response for adding members to a group
/// </summary>
internal class ApiAddMembersResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("added")]
    public int Added { get; set; }
}

/// <summary>
/// API response for duplicate detection
/// </summary>
internal class ApiDuplicateResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("error")]
    public string? Error { get; set; }

    [JsonPropertyName("code")]
    public string? Code { get; set; }

    [JsonPropertyName("duplicates")]
    public List<ContactDto>? Duplicates { get; set; }
}

#endregion
