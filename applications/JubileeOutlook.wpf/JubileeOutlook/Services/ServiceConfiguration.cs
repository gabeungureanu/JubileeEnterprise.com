namespace JubileeOutlook.Services;

public static class ServiceConfiguration
{
    private static ICalendarService? _calendarService;
    private static IMailService? _mailService;
    private static bool _useApiServices = false;
    private static string? _apiBaseUrl;
    private static string? _userId;

    public static bool UseApiServices
    {
        get => _useApiServices;
        set
        {
            _useApiServices = value;
            _calendarService = null;
            _mailService = null;
        }
    }

    public static string? ApiBaseUrl
    {
        get => _apiBaseUrl;
        set => _apiBaseUrl = value;
    }

    public static string? UserId
    {
        get => _userId;
        set => _userId = value;
    }

    public static ICalendarService GetCalendarService()
    {
        if (_calendarService == null)
        {
            _calendarService = _useApiServices
                ? new ApiCalendarService(_apiBaseUrl, _userId)
                : new MockCalendarService();
        }
        return _calendarService;
    }

    public static IMailService GetMailService()
    {
        if (_mailService == null)
        {
            _mailService = new MockMailService();
        }
        return _mailService;
    }

    public static void Initialize(bool useApi = false, string? apiUrl = null, string? userId = null)
    {
        _useApiServices = useApi;
        _apiBaseUrl = apiUrl ?? Environment.GetEnvironmentVariable("CONTINUUM_API_URL");
        _userId = userId ?? Environment.GetEnvironmentVariable("JUBILEE_USER_ID");

        Console.WriteLine($"[ServiceConfiguration] Initialized - UseAPI: {_useApiServices}, BaseUrl: {_apiBaseUrl}");
    }
}
