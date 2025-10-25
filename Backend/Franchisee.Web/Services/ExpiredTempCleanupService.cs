using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace WebApplication1.Services
{
    public class ExpiredTempCleanupService : BackgroundService
    {
        private readonly IServiceProvider _services;
        private readonly ILogger<ExpiredTempCleanupService> _logger;

        public ExpiredTempCleanupService(IServiceProvider services, ILogger<ExpiredTempCleanupService> logger)
        {
            _services = services;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
            while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken))
            {
                using var scope = _services.CreateScope();
                var photoService = scope.ServiceProvider.GetRequiredService<IPhotoService>();
                await photoService.CleanupExpiredTempsAsync();
            }
        }
    }
}