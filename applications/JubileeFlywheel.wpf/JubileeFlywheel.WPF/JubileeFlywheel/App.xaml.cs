using System.Windows;
using Microsoft.Extensions.DependencyInjection;
using JubileeFlywheel.Services;
using JubileeFlywheel.ViewModels;

namespace JubileeFlywheel
{
    public partial class App : Application
    {
        public static IServiceProvider ServiceProvider { get; private set; } = null!;

        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);

            var services = new ServiceCollection();
            ConfigureServices(services);
            ServiceProvider = services.BuildServiceProvider();
        }

        private static void ConfigureServices(IServiceCollection services)
        {
            services.AddHttpClient();

            services.AddSingleton<IApiService, ApiService>();
            services.AddSingleton<ISettingsService, SettingsService>();
            services.AddSingleton<IDataCacheService, DataCacheService>();
            services.AddSingleton<ISymbolService, SymbolService>();
            services.AddSingleton<IOhlcAggregationEngine, OhlcAggregationEngine>();

            services.AddTransient<MainViewModel>();
            services.AddTransient<DashboardViewModel>();
            services.AddTransient<ApiConfigViewModel>();
            services.AddTransient<DataGridViewModel>();
        }

        protected override void OnExit(ExitEventArgs e)
        {
            if (ServiceProvider is IDisposable disposable)
            {
                disposable.Dispose();
            }
            base.OnExit(e);
        }
    }
}
