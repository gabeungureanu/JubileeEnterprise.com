using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using JubileeOutlook.Models;

namespace JubileeOutlook.Services;

/// <summary>
/// API service for calendar operations via InspireContinuum API
/// Uses HttpClientFactory for centralized HTTP client management with auto-auth
/// Supports offline-first operation with LocalCacheService and NetworkStatusService
/// </summary>
public class ApiCalendarService : ICalendarService
{
    private static ApiCalendarService? _instance;
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
    /// Singleton instance of the calendar service
    /// </summary>
    public static ApiCalendarService Instance
    {
        get
        {
            if (_instance == null)
            {
                lock (_lock)
                {
                    _instance ??= new ApiCalendarService();
                }
            }
            return _instance;
        }
    }

    public ApiCalendarService()
    {
        _httpClientFactory = HttpClientFactory.Instance;
        _config = ConfigurationService.Instance;

        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            NumberHandling = System.Text.Json.Serialization.JsonNumberHandling.AllowReadingFromString,
            Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
        };

        System.Diagnostics.Debug.WriteLine($"ApiCalendarService initialized with HttpClientFactory");
        System.Diagnostics.Debug.WriteLine($"  InspireContinuum API: {_config.Api.InspireContinuum.BaseUrl}");
    }

    // Legacy constructor for compatibility
    public ApiCalendarService(string? baseUrl = null, string? userId = null) : this()
    {
    }

    #region ICalendarService Implementation

    /// <summary>
    /// Gets calendar events for a date range
    /// GET /api/outlook/events
    /// </summary>
    public async Task<List<CalendarEvent>> GetEventsAsync(DateTime startDate, DateTime endDate)
    {
        var result = await GetEventsWithResultAsync(startDate, endDate);
        return result.Data ?? new List<CalendarEvent>();
    }

    /// <summary>
    /// Gets a single calendar event by ID
    /// GET /api/outlook/events/{id}
    /// </summary>
    public async Task<CalendarEvent?> GetEventByIdAsync(string eventId)
    {
        var result = await GetEventByIdWithResultAsync(eventId);
        return result.Data;
    }

    /// <summary>
    /// Creates a new calendar event
    /// POST /api/outlook/events
    /// </summary>
    public async Task CreateEventAsync(CalendarEvent calendarEvent)
    {
        var result = await CreateEventWithResultAsync(calendarEvent);
        if (result.Success && result.Data != null)
        {
            calendarEvent.Id = result.Data.Id;
        }
    }

    /// <summary>
    /// Updates an existing calendar event
    /// PUT /api/outlook/events/{id}
    /// </summary>
    public async Task UpdateEventAsync(CalendarEvent calendarEvent)
    {
        await UpdateEventWithResultAsync(calendarEvent);
    }

    /// <summary>
    /// Deletes a calendar event
    /// DELETE /api/outlook/events/{id}
    /// </summary>
    public async Task DeleteEventAsync(string eventId)
    {
        await DeleteEventWithResultAsync(eventId);
    }

    #endregion

    #region Extended Methods with Result Objects

    /// <summary>
    /// Gets calendar events for a date range with detailed result
    /// Supports offline-first: returns cached events when offline
    /// GET /api/outlook/events?startDate={startDate}&endDate={endDate}
    /// </summary>
    public async Task<CalendarServiceResult<List<CalendarEvent>>> GetEventsWithResultAsync(
        DateTime startDate,
        DateTime endDate,
        string? calendarName = null)
    {
        try
        {
            System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] GetEventsWithResultAsync called: {startDate:yyyy-MM-dd} to {endDate:yyyy-MM-dd}");
            System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] NetworkStatus.IsOnline={NetworkStatus.IsOnline}, IsApiReachable={NetworkStatus.IsApiReachable}");
            try { System.IO.File.AppendAllText(@"C:\temp\calendar_debug.txt", $"\n[{DateTime.Now:HH:mm:ss}] GetEventsWithResultAsync: {startDate:yyyy-MM-dd} to {endDate:yyyy-MM-dd}, IsOnline={NetworkStatus.IsOnline}, IsApiReachable={NetworkStatus.IsApiReachable}\n"); } catch { }

            // If offline, return cached events
            if (!IsOnline)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Offline - returning cached events for {startDate:yyyy-MM-dd} to {endDate:yyyy-MM-dd}");
                try { System.IO.File.AppendAllText(@"C:\temp\calendar_debug.txt", $"[{DateTime.Now:HH:mm:ss}] OFFLINE - returning cached events\n"); } catch { }
                var cachedEvents = await LocalCache.GetCachedEventsAsync(startDate, endDate);
                return new CalendarServiceResult<List<CalendarEvent>>
                {
                    Success = true,
                    Data = cachedEvents
                };
            }

            var userId = ServiceConfiguration.UserId ?? "00000000-0000-0000-0000-000000000001";
            var queryParams = new List<string>
            {
                $"userId={Uri.EscapeDataString(userId)}",
                $"startDate={startDate:yyyy-MM-ddTHH:mm:ss}Z",
                $"endDate={endDate:yyyy-MM-ddTHH:mm:ss}Z"
            };

            if (!string.IsNullOrEmpty(calendarName))
                queryParams.Add($"calendar={Uri.EscapeDataString(calendarName)}");

            var endpoint = $"outlook/events?{string.Join("&", queryParams)}";
            System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] GET {endpoint}");
            try { System.IO.File.AppendAllText(@"C:\temp\calendar_debug.txt", $"[{DateTime.Now:HH:mm:ss}] GET {endpoint}\n"); } catch { }

            var response = await _httpClientFactory.GetAsync(ApiEndpoint.InspireContinuum, endpoint);
            var content = await response.Content.ReadAsStringAsync();
            try { System.IO.File.AppendAllText(@"C:\temp\calendar_debug.txt", $"[{DateTime.Now:HH:mm:ss}] Response: {response.StatusCode}, Content length: {content.Length}\n"); } catch { }
            try { System.IO.File.AppendAllText(@"C:\temp\calendar_debug.txt", $"[{DateTime.Now:HH:mm:ss}] Response content (first 500 chars): {content.Substring(0, Math.Min(500, content.Length))}\n"); } catch { }

            if (response.IsSuccessStatusCode)
            {
                // Try to parse as API response wrapper first
                try
                {
                    var apiResponse = JsonSerializer.Deserialize<ApiEventsListResponse>(content, _jsonOptions);
                    try { System.IO.File.AppendAllText(@"C:\temp\calendar_debug.txt", $"[{DateTime.Now:HH:mm:ss}] Parsed apiResponse, Events: {apiResponse?.Events?.Count ?? -1}\n"); } catch { }
                    if (apiResponse?.Events != null)
                    {
                        var events = apiResponse.Events.Select(MapToCalendarEvent).ToList();
                        System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Retrieved {events.Count} events");
                        try { System.IO.File.AppendAllText(@"C:\temp\calendar_debug.txt", $"[{DateTime.Now:HH:mm:ss}] Retrieved {events.Count} events from API\n"); } catch { }

                        // Cache events for offline use
                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                foreach (var evt in events)
                                {
                                    await LocalCache.CacheEventAsync(evt);
                                }
                                System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Cached {events.Count} events");
                            }
                            catch (Exception ex)
                            {
                                System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Failed to cache events: {ex.Message}");
                            }
                        });

                        return new CalendarServiceResult<List<CalendarEvent>>
                        {
                            Success = true,
                            Data = events
                        };
                    }
                }
                catch (Exception ex)
                {
                    // Fall back to direct list parsing
                    try { System.IO.File.AppendAllText(@"C:\temp\calendar_debug.txt", $"[{DateTime.Now:HH:mm:ss}] ApiEventsListResponse parse failed: {ex.Message}, falling back to direct list\n"); } catch { }
                }

                // Try parsing as direct list
                try { System.IO.File.AppendAllText(@"C:\temp\calendar_debug.txt", $"[{DateTime.Now:HH:mm:ss}] Trying direct list parse...\n"); } catch { }
                List<CalendarEventDto>? directEvents = null;
                try
                {
                    directEvents = JsonSerializer.Deserialize<List<CalendarEventDto>>(content, _jsonOptions);
                    try { System.IO.File.AppendAllText(@"C:\temp\calendar_debug.txt", $"[{DateTime.Now:HH:mm:ss}] Direct parse result: {directEvents?.Count ?? -1} events\n"); } catch { }
                }
                catch (Exception parseEx)
                {
                    try { System.IO.File.AppendAllText(@"C:\temp\calendar_debug.txt", $"[{DateTime.Now:HH:mm:ss}] Direct list parse EXCEPTION: {parseEx.Message}\n"); } catch { }
                }
                if (directEvents != null)
                {
                    try { System.IO.File.AppendAllText(@"C:\temp\calendar_debug.txt", $"[{DateTime.Now:HH:mm:ss}] About to call MapToCalendarEvent for {directEvents.Count} items\n"); } catch { }
                    var events = directEvents.Select(MapToCalendarEvent).ToList();
                    System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Retrieved {events.Count} events (direct)");
                    try { System.IO.File.AppendAllText(@"C:\temp\calendar_debug.txt", $"[{DateTime.Now:HH:mm:ss}] Retrieved {events.Count} events (direct)\n"); } catch { }

                    // Cache events for offline use
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            foreach (var evt in events)
                            {
                                await LocalCache.CacheEventAsync(evt);
                            }
                            System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Cached {events.Count} events");
                        }
                        catch (Exception ex)
                        {
                            System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Failed to cache events: {ex.Message}");
                        }
                    });

                    return new CalendarServiceResult<List<CalendarEvent>>
                    {
                        Success = true,
                        Data = events
                    };
                }

                return new CalendarServiceResult<List<CalendarEvent>>
                {
                    Success = false,
                    Error = "Failed to parse events response",
                    Data = new List<CalendarEvent>()
                };
            }

            System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] GET events failed: {response.StatusCode}");
            return new CalendarServiceResult<List<CalendarEvent>>
            {
                Success = false,
                Error = $"Failed to get events: {response.StatusCode}",
                StatusCode = response.StatusCode,
                Data = new List<CalendarEvent>()
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] GetEvents error: {ex.Message}");
            return new CalendarServiceResult<List<CalendarEvent>>
            {
                Success = false,
                Error = ex.Message,
                Data = new List<CalendarEvent>()
            };
        }
    }

    /// <summary>
    /// Gets a single calendar event by ID with detailed result
    /// GET /api/outlook/events/{id}
    /// </summary>
    public async Task<CalendarServiceResult<CalendarEvent>> GetEventByIdWithResultAsync(string eventId)
    {
        try
        {
            if (string.IsNullOrEmpty(eventId))
            {
                return new CalendarServiceResult<CalendarEvent>
                {
                    Success = false,
                    Error = "Event ID is required"
                };
            }

            var endpoint = $"outlook/events/{Uri.EscapeDataString(eventId)}";
            System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] GET {endpoint}");

            var response = await _httpClientFactory.GetAsync(ApiEndpoint.InspireContinuum, endpoint);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                // Try API response wrapper first
                try
                {
                    var apiResponse = JsonSerializer.Deserialize<ApiEventSingleResponse>(content, _jsonOptions);
                    if (apiResponse?.Event != null)
                    {
                        return new CalendarServiceResult<CalendarEvent>
                        {
                            Success = true,
                            Data = MapToCalendarEvent(apiResponse.Event)
                        };
                    }
                }
                catch { }

                // Try direct parsing
                var dto = JsonSerializer.Deserialize<CalendarEventDto>(content, _jsonOptions);
                if (dto != null)
                {
                    return new CalendarServiceResult<CalendarEvent>
                    {
                        Success = true,
                        Data = MapToCalendarEvent(dto)
                    };
                }

                return new CalendarServiceResult<CalendarEvent>
                {
                    Success = false,
                    Error = "Failed to parse event response"
                };
            }

            return new CalendarServiceResult<CalendarEvent>
            {
                Success = false,
                Error = $"Failed to get event: {response.StatusCode}",
                StatusCode = response.StatusCode
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] GetEventById error: {ex.Message}");
            return new CalendarServiceResult<CalendarEvent>
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    /// <summary>
    /// Creates a new calendar event with detailed result
    /// Attempts API call first, falls back to offline queue only on network failure
    /// POST /api/outlook/events
    /// </summary>
    public async Task<CalendarServiceResult<CalendarEvent>> CreateEventWithResultAsync(CalendarEvent calendarEvent)
    {
        try
        {
            if (calendarEvent == null)
            {
                return new CalendarServiceResult<CalendarEvent>
                {
                    Success = false,
                    Error = "Calendar event is required"
                };
            }

            var dto = MapToDto(calendarEvent);
            var endpoint = "outlook/events";

            System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] POST {endpoint} - {calendarEvent.Subject}, IsPrivate={calendarEvent.IsPrivate}");
            var dtoJson = JsonSerializer.Serialize(dto, _jsonOptions);
            System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Request body: {dtoJson}");
            try { System.IO.File.AppendAllText(@"C:\temp\calendar_debug.txt", $"\n[{DateTime.Now:HH:mm:ss}] POST {endpoint} - IsPrivate={calendarEvent.IsPrivate}\n[{DateTime.Now:HH:mm:ss}] Request body: {dtoJson}\n"); } catch { }

            var response = await _httpClientFactory.PostAsync(ApiEndpoint.InspireContinuum, endpoint, dto);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                // Try API response wrapper first
                try
                {
                    var apiResponse = JsonSerializer.Deserialize<ApiEventSingleResponse>(content, _jsonOptions);
                    if (apiResponse?.Event != null)
                    {
                        var createdEvent = MapToCalendarEvent(apiResponse.Event);
                        System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Created event: {createdEvent.Id}");
                        return new CalendarServiceResult<CalendarEvent>
                        {
                            Success = true,
                            Data = createdEvent
                        };
                    }
                }
                catch { }

                // Try direct parsing
                var createdDto = JsonSerializer.Deserialize<CalendarEventDto>(content, _jsonOptions);
                if (createdDto != null)
                {
                    var createdEvent = MapToCalendarEvent(createdDto);
                    System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Created event: {createdEvent.Id}");
                    return new CalendarServiceResult<CalendarEvent>
                    {
                        Success = true,
                        Data = createdEvent
                    };
                }

                // If no response body, return original with success
                return new CalendarServiceResult<CalendarEvent>
                {
                    Success = true,
                    Data = calendarEvent
                };
            }

            System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Create failed: {response.StatusCode} - {content}");
            return new CalendarServiceResult<CalendarEvent>
            {
                Success = false,
                Error = $"Failed to create event: {response.StatusCode}",
                StatusCode = response.StatusCode
            };
        }
        catch (HttpRequestException ex)
        {
            // Network error - queue for offline sync
            System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Network error, queueing event: {ex.Message}");
            return await QueueEventForOfflineCreation(calendarEvent);
        }
        catch (TaskCanceledException ex) when (ex.InnerException is TimeoutException)
        {
            // Timeout - queue for offline sync
            System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Request timeout, queueing event: {ex.Message}");
            return await QueueEventForOfflineCreation(calendarEvent);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] CreateEvent error: {ex.Message}");
            return new CalendarServiceResult<CalendarEvent>
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    /// <summary>
    /// Queues an event for offline creation when API is unreachable
    /// </summary>
    private async Task<CalendarServiceResult<CalendarEvent>> QueueEventForOfflineCreation(CalendarEvent calendarEvent)
    {
        // Generate a temporary ID if not set
        if (string.IsNullOrEmpty(calendarEvent.Id))
        {
            calendarEvent.Id = $"temp-{Guid.NewGuid()}";
        }

        // Cache the event locally
        try
        {
            await LocalCache.CacheEventAsync(calendarEvent);
            System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Cached event locally: {calendarEvent.Id}");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Failed to cache event: {ex.Message}");
        }

        // Queue the create operation
        var eventPayload = new
        {
            subject = calendarEvent.Subject,
            location = calendarEvent.Location,
            description = calendarEvent.Description,
            startTime = calendarEvent.StartTime,
            endTime = calendarEvent.EndTime,
            isAllDay = calendarEvent.IsAllDay,
            isPrivate = calendarEvent.IsPrivate,
            calendarName = calendarEvent.CalendarName,
            attendees = calendarEvent.Attendees,
            reminder = calendarEvent.Reminder.ToString()
        };

        await SyncQueue.QueueOperationAsync(
            SyncEntityTypes.Event,
            calendarEvent.Id,
            SyncOperationTypes.Create,
            eventPayload);

        return new CalendarServiceResult<CalendarEvent>
        {
            Success = true,
            Data = calendarEvent
        };
    }

    /// <summary>
    /// Updates an existing calendar event with detailed result
    /// Supports offline-first: queues update when offline
    /// PUT /api/outlook/events/{id}
    /// </summary>
    public async Task<CalendarServiceResult<CalendarEvent>> UpdateEventWithResultAsync(CalendarEvent calendarEvent)
    {
        try
        {
            if (calendarEvent == null)
            {
                return new CalendarServiceResult<CalendarEvent>
                {
                    Success = false,
                    Error = "Calendar event is required"
                };
            }

            if (string.IsNullOrEmpty(calendarEvent.Id))
            {
                return new CalendarServiceResult<CalendarEvent>
                {
                    Success = false,
                    Error = "Event ID is required for update"
                };
            }

            // If offline, cache locally and queue for sync
            if (!IsOnline)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Offline - queueing event update: {calendarEvent.Subject}");

                // Update local cache
                try
                {
                    await LocalCache.CacheEventAsync(calendarEvent);
                    System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Updated event in local cache: {calendarEvent.Id}");
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Failed to update local cache: {ex.Message}");
                }

                // Queue the update operation
                var eventPayload = new
                {
                    subject = calendarEvent.Subject,
                    location = calendarEvent.Location,
                    description = calendarEvent.Description,
                    startTime = calendarEvent.StartTime,
                    endTime = calendarEvent.EndTime,
                    isAllDay = calendarEvent.IsAllDay,
                    isPrivate = calendarEvent.IsPrivate,
                    calendarName = calendarEvent.CalendarName,
                    attendees = calendarEvent.Attendees,
                    reminder = calendarEvent.Reminder.ToString()
                };

                await SyncQueue.QueueOperationAsync(
                    SyncEntityTypes.Event,
                    calendarEvent.Id,
                    SyncOperationTypes.Update,
                    eventPayload);

                return new CalendarServiceResult<CalendarEvent>
                {
                    Success = true,
                    Data = calendarEvent
                };
            }

            var dto = MapToDto(calendarEvent);
            var endpoint = $"outlook/events/{Uri.EscapeDataString(calendarEvent.Id)}";

            System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] PUT {endpoint} - {calendarEvent.Subject}, IsPrivate={calendarEvent.IsPrivate}");
            var dtoJson = JsonSerializer.Serialize(dto, _jsonOptions);
            System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Request body: {dtoJson}");
            try { System.IO.File.AppendAllText(@"C:\temp\calendar_debug.txt", $"\n[{DateTime.Now:HH:mm:ss}] PUT {endpoint} - IsPrivate={calendarEvent.IsPrivate}\n[{DateTime.Now:HH:mm:ss}] Request body: {dtoJson}\n"); } catch { }

            var response = await _httpClientFactory.PutAsync(ApiEndpoint.InspireContinuum, endpoint, dto);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                // Try API response wrapper first
                try
                {
                    var apiResponse = JsonSerializer.Deserialize<ApiEventSingleResponse>(content, _jsonOptions);
                    if (apiResponse?.Event != null)
                    {
                        var updatedEvent = MapToCalendarEvent(apiResponse.Event);
                        System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Updated event: {updatedEvent.Id}");
                        return new CalendarServiceResult<CalendarEvent>
                        {
                            Success = true,
                            Data = updatedEvent
                        };
                    }
                }
                catch { }

                // Try direct parsing
                var updatedDto = JsonSerializer.Deserialize<CalendarEventDto>(content, _jsonOptions);
                if (updatedDto != null)
                {
                    var updatedEvent = MapToCalendarEvent(updatedDto);
                    System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Updated event: {updatedEvent.Id}");
                    return new CalendarServiceResult<CalendarEvent>
                    {
                        Success = true,
                        Data = updatedEvent
                    };
                }

                // If no response body, return original with success
                System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Updated event (no body): {calendarEvent.Id}");
                return new CalendarServiceResult<CalendarEvent>
                {
                    Success = true,
                    Data = calendarEvent
                };
            }

            System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Update failed: {response.StatusCode} - {content}");
            return new CalendarServiceResult<CalendarEvent>
            {
                Success = false,
                Error = $"Failed to update event: {response.StatusCode}",
                StatusCode = response.StatusCode
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] UpdateEvent error: {ex.Message}");
            return new CalendarServiceResult<CalendarEvent>
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    /// <summary>
    /// Deletes a calendar event with detailed result
    /// DELETE /api/outlook/events/{id}
    /// </summary>
    public async Task<CalendarServiceResult<bool>> DeleteEventWithResultAsync(string eventId)
    {
        try
        {
            if (string.IsNullOrEmpty(eventId))
            {
                return new CalendarServiceResult<bool>
                {
                    Success = false,
                    Error = "Event ID is required",
                    Data = false
                };
            }

            // Mark as deleted in local cache (optimistic update)
            try
            {
                await LocalCache.MarkEventDeletedAsync(eventId);
                System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Marked event as deleted in local cache: {eventId}");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Failed to mark event deleted locally: {ex.Message}");
            }

            // If offline, queue the delete operation
            if (!IsOnline)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Offline - queueing event deletion: {eventId}");
                await SyncQueue.QueueOperationAsync(
                    SyncEntityTypes.Event,
                    eventId,
                    SyncOperationTypes.Delete);

                return new CalendarServiceResult<bool>
                {
                    Success = true,
                    Data = true
                };
            }

            var endpoint = $"outlook/events/{Uri.EscapeDataString(eventId)}";
            System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] DELETE {endpoint}");

            var response = await _httpClientFactory.DeleteAsync(ApiEndpoint.InspireContinuum, endpoint);

            if (response.IsSuccessStatusCode)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Deleted event: {eventId}");
                return new CalendarServiceResult<bool>
                {
                    Success = true,
                    Data = true
                };
            }

            // 404 is acceptable - event may already be deleted
            if (response.StatusCode == HttpStatusCode.NotFound)
            {
                System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Event not found (already deleted?): {eventId}");
                return new CalendarServiceResult<bool>
                {
                    Success = true,
                    Data = true,
                    Error = "Event not found"
                };
            }

            var content = await response.Content.ReadAsStringAsync();
            System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] Delete failed: {response.StatusCode} - {content}");

            return new CalendarServiceResult<bool>
            {
                Success = false,
                Error = $"Failed to delete event: {response.StatusCode}",
                StatusCode = response.StatusCode,
                Data = false
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ApiCalendarService] DeleteEvent error: {ex.Message}");
            return new CalendarServiceResult<bool>
            {
                Success = false,
                Error = ex.Message,
                Data = false
            };
        }
    }

    #endregion

    #region Convenience Methods

    /// <summary>
    /// Gets events for a specific day
    /// </summary>
    public Task<List<CalendarEvent>> GetEventsForDayAsync(DateTime date)
    {
        var startOfDay = date.Date;
        var endOfDay = date.Date.AddDays(1).AddTicks(-1);
        return GetEventsAsync(startOfDay, endOfDay);
    }

    /// <summary>
    /// Gets events for a specific month
    /// </summary>
    public Task<List<CalendarEvent>> GetEventsForMonthAsync(int year, int month)
    {
        var startOfMonth = new DateTime(year, month, 1);
        var endOfMonth = startOfMonth.AddMonths(1).AddTicks(-1);
        return GetEventsAsync(startOfMonth, endOfMonth);
    }

    #endregion

    #region Mapping Methods

    private static CalendarEvent MapToCalendarEvent(CalendarEventDto dto)
    {
        var eventColor = new System.Windows.Media.SolidColorBrush(
            ParseHexColor(dto.EventColor ?? "#5B9BD5"));

        return new CalendarEvent
        {
            Id = dto.Id ?? Guid.NewGuid().ToString(),
            Subject = dto.Subject ?? string.Empty,
            Location = dto.Location ?? string.Empty,
            StartTime = dto.StartTime,
            EndTime = dto.EndTime,
            Description = dto.Description ?? string.Empty,
            IsAllDay = dto.IsAllDay,
            Status = ParseEventStatus(dto.Status),
            Category = ParseEventCategory(dto.Category),
            CalendarName = dto.CalendarName ?? "My Calendar",
            EventColor = eventColor,
            Attendees = dto.Attendees ?? new List<string>(),
            Organizer = dto.Organizer ?? string.Empty,
            IsPrivate = dto.IsPrivate,
            IsInPerson = dto.IsInPerson,
            Attachments = dto.Attachments?.Select(a => new EventAttachment
            {
                Id = a.Id ?? Guid.NewGuid().ToString(),
                FileName = a.FileName ?? string.Empty,
                FilePath = a.FilePath ?? string.Empty,
                FileSize = a.FileSize ?? 0,
                Url = a.Url,
                AddedDate = a.AddedDate
            }).ToList() ?? new List<EventAttachment>(),
            Images = dto.Images?.Select(i => new EventImage
            {
                Id = i.Id ?? Guid.NewGuid().ToString(),
                FileName = i.FileName ?? string.Empty,
                FilePath = i.FilePath ?? string.Empty,
                FileSize = i.FileSize ?? 0,
                ContentType = i.MimeType ?? "image/jpeg",
                Url = i.Url,
                ThumbnailUrl = i.ThumbnailUrl,
                AddedDate = i.AddedDate
            }).ToList() ?? new List<EventImage>(),
            IsRecurring = dto.IsRecurring,
            Reminder = ParseReminderTime(dto.ReminderMinutes)
        };
    }

    private static CalendarEventDto MapToDto(CalendarEvent calendarEvent)
    {
        return new CalendarEventDto
        {
            Id = calendarEvent.Id,
            UserId = ServiceConfiguration.UserId ?? "00000000-0000-0000-0000-000000000001",
            Subject = calendarEvent.Subject,
            Location = calendarEvent.Location,
            StartTime = calendarEvent.StartTime,
            EndTime = calendarEvent.EndTime,
            Description = calendarEvent.Description,
            IsAllDay = calendarEvent.IsAllDay,
            Status = calendarEvent.Status.ToString().ToLower(),
            Category = calendarEvent.Category.ToString().ToLower(),
            CalendarName = calendarEvent.CalendarName,
            EventColor = GetColorHex(calendarEvent.EventColor),
            Attendees = calendarEvent.Attendees,
            Organizer = calendarEvent.Organizer,
            IsPrivate = calendarEvent.IsPrivate,
            IsInPerson = calendarEvent.IsInPerson,
            Attachments = calendarEvent.Attachments?.Select(a => new AttachmentDto
            {
                Id = a.Id,
                FileName = a.FileName,
                FilePath = a.FilePath,
                FileSize = a.FileSize,
                Url = a.Url,
                AddedDate = a.AddedDate
            }).ToList(),
            Images = calendarEvent.Images?.Select(i => new ImageDto
            {
                Id = i.Id,
                FileName = i.FileName,
                FilePath = i.FilePath,
                FileSize = i.FileSize,
                MimeType = i.ContentType,
                Url = i.Url,
                ThumbnailUrl = i.ThumbnailUrl,
                AddedDate = i.AddedDate
            }).ToList(),
            IsRecurring = calendarEvent.IsRecurring,
            ReminderMinutes = GetReminderMinutes(calendarEvent.Reminder)
        };
    }

    private static System.Windows.Media.Color ParseHexColor(string hex)
    {
        try
        {
            hex = hex.TrimStart('#');
            if (hex.Length == 6)
            {
                return System.Windows.Media.Color.FromRgb(
                    Convert.ToByte(hex.Substring(0, 2), 16),
                    Convert.ToByte(hex.Substring(2, 2), 16),
                    Convert.ToByte(hex.Substring(4, 2), 16));
            }
        }
        catch { }
        return System.Windows.Media.Color.FromRgb(91, 155, 213);
    }

    private static string GetColorHex(System.Windows.Media.Brush brush)
    {
        if (brush is System.Windows.Media.SolidColorBrush solidBrush)
        {
            var color = solidBrush.Color;
            return $"#{color.R:X2}{color.G:X2}{color.B:X2}";
        }
        return "#5B9BD5";
    }

    private static EventStatus ParseEventStatus(string? status)
    {
        return status?.ToLower() switch
        {
            "free" => EventStatus.Free,
            "tentative" => EventStatus.Tentative,
            "busy" => EventStatus.Busy,
            "outofoffice" => EventStatus.OutOfOffice,
            _ => EventStatus.Free
        };
    }

    private static EventCategory ParseEventCategory(string? category)
    {
        return category?.ToLower() switch
        {
            "business" => EventCategory.Business,
            "personal" => EventCategory.Personal,
            "holiday" => EventCategory.Holiday,
            "birthday" => EventCategory.Birthday,
            _ => EventCategory.None
        };
    }

    private static ReminderTime ParseReminderTime(int? minutes)
    {
        return minutes switch
        {
            0 => ReminderTime.AtTimeOfEvent,
            5 => ReminderTime.FiveMinutes,
            15 => ReminderTime.FifteenMinutes,
            30 => ReminderTime.ThirtyMinutes,
            60 => ReminderTime.OneHour,
            120 => ReminderTime.TwoHours,
            1440 => ReminderTime.OneDay,
            10080 => ReminderTime.OneWeek,
            _ => ReminderTime.None
        };
    }

    private static int GetReminderMinutes(ReminderTime reminder)
    {
        return reminder switch
        {
            ReminderTime.AtTimeOfEvent => 0,
            ReminderTime.FiveMinutes => 5,
            ReminderTime.FifteenMinutes => 15,
            ReminderTime.ThirtyMinutes => 30,
            ReminderTime.OneHour => 60,
            ReminderTime.TwoHours => 120,
            ReminderTime.OneDay => 1440,
            ReminderTime.OneWeek => 10080,
            _ => -1
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

    #endregion
}

#region Service Result and DTOs

/// <summary>
/// Generic result wrapper for calendar service operations
/// </summary>
public class CalendarServiceResult<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }
    public string? Error { get; set; }
    public HttpStatusCode StatusCode { get; set; } = HttpStatusCode.OK;
}

/// <summary>
/// API response for events list
/// </summary>
internal class ApiEventsListResponse
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public List<CalendarEventDto>? Events { get; set; }
    public int? TotalCount { get; set; }
}

/// <summary>
/// API response for single event
/// </summary>
internal class ApiEventSingleResponse
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public CalendarEventDto? Event { get; set; }
}

/// <summary>
/// Calendar event data transfer object for API communication
/// </summary>
public class CalendarEventDto
{
    public string? Id { get; set; }
    public string? UserId { get; set; }
    public string? CalendarId { get; set; }
    public string? Subject { get; set; }
    public string? Location { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string? Description { get; set; }
    public bool IsAllDay { get; set; }
    public string? Status { get; set; }
    public string? Category { get; set; }
    public string? CalendarName { get; set; }
    public string? EventColor { get; set; }
    public List<string>? Attendees { get; set; }
    public string? Organizer { get; set; }
    public bool IsPrivate { get; set; }
    public bool IsInPerson { get; set; } = true;
    public List<AttachmentDto>? Attachments { get; set; }
    public List<ImageDto>? Images { get; set; }
    public bool IsRecurring { get; set; }
    public int? ReminderMinutes { get; set; }
    public DateTime? CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

/// <summary>
/// Attachment data transfer object
/// </summary>
public class AttachmentDto
{
    public string? Id { get; set; }
    public string? FileName { get; set; }
    public string? FilePath { get; set; }
    public long? FileSize { get; set; }
    public string? Url { get; set; }
    public DateTime AddedDate { get; set; }
    public string? StorageKey { get; set; }
}

/// <summary>
/// Image data transfer object for event images
/// </summary>
public class ImageDto
{
    public string? Id { get; set; }
    public string? FileName { get; set; }
    public string? FilePath { get; set; }
    public long? FileSize { get; set; }
    public string? MimeType { get; set; }
    public string? Url { get; set; }
    public string? ThumbnailUrl { get; set; }
    public DateTime AddedDate { get; set; }
}

#endregion
