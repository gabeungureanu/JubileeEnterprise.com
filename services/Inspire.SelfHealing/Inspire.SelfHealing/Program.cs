using Inspire.SelfHealing;
using Inspire.SelfHealing.Configuration;
using Inspire.SelfHealing.Services;
using Microsoft.Extensions.Hosting.WindowsServices;

var builder = Host.CreateApplicationBuilder(args);

// Configure as Windows Service
builder.Services.AddWindowsService(options =>
{
    options.ServiceName = "Inspire 8.0: Self-Healing";
});

// Load configuration from external JSON file
var configPath = Path.Combine(AppContext.BaseDirectory, "monitored-services.json");
if (File.Exists(configPath))
{
    builder.Configuration.AddJsonFile(configPath, optional: false, reloadOnChange: true);
}

// Register configuration
builder.Services.Configure<MonitoredServicesConfig>(
    builder.Configuration.GetSection("MonitoredServices"));

// Register services
builder.Services.AddHttpClient();
builder.Services.AddSingleton<IHealthCheckService, HealthCheckService>();
builder.Services.AddSingleton<IRecoveryService, RecoveryService>();
builder.Services.AddSingleton<IEventLogService, EventLogService>();
builder.Services.AddHostedService<SelfHealingWorker>();

// Configure logging
builder.Logging.AddEventLog(settings =>
{
    settings.SourceName = "Inspire.SelfHealing";
    settings.LogName = "Application";
});

var host = builder.Build();
host.Run();
