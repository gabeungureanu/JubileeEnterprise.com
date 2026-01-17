using System;
using System.IO;
using System.Windows;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using JubileeAvatar.Services;
using JubileeAvatar.ViewModels;
using JubileeAvatar.Models;

namespace JubileeAvatar
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

        private void ConfigureServices(IServiceCollection services)
        {
            // Configuration
            services.AddSingleton<ISettingsService, SettingsService>();

            // Logging
            services.AddLogging(configure =>
            {
                configure.AddConsole();
                configure.SetMinimumLevel(LogLevel.Debug);
            });

            // HTTP Client
            services.AddHttpClient();

            // Services
            services.AddSingleton<IAudioService, AudioService>();
            services.AddSingleton<ISpeechToTextService, SpeechToTextService>();
            services.AddSingleton<IAIResponseService, AIResponseService>();
            services.AddSingleton<ITextToSpeechService, TextToSpeechService>();
            services.AddSingleton<IAvatarService, AvatarService>();
            services.AddSingleton<IBackendService, BackendService>();
            services.AddSingleton<IConversationLogger, ConversationLogger>();

            // ViewModels
            services.AddTransient<MainViewModel>();
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
