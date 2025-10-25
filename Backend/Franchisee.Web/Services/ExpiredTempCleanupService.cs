using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using WebApplication1.Configuration;

namespace WebApplication1.Services
{
    public class ExpiredTempCleanupService : BackgroundService
    {
        private readonly ILogger<ExpiredTempCleanupService> _logger;
        private readonly IServiceProvider _serviceProvider;
        private readonly TimeSpan _cleanupInterval = TimeSpan.FromHours(1); // Проверка каждый час
        private readonly TimeSpan _archiveRetention = TimeSpan.FromDays(7); // Хранить 7 дней

        public ExpiredTempCleanupService(ILogger<ExpiredTempCleanupService> logger, IServiceProvider serviceProvider)
        {
            _logger = logger;
            _serviceProvider = serviceProvider;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("ExpiredTempCleanupService запущен");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CleanupExpiredTempsAsync();
                    await CleanupExpiredArchivedOrdersAsync();
                    await Task.Delay(_cleanupInterval, stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Ошибка в ExpiredTempCleanupService");
                    await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken); // Пауза при ошибке
                }
            }
        }

        private async Task CleanupExpiredTempsAsync()
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var expired = await context.TempUploads
                .IgnoreQueryFilters()
                .Where(t => t.ExpiresAt <= DateTime.UtcNow)
                .ToListAsync();

            foreach (var temp in expired)
            {
                if (System.IO.File.Exists(temp.FilePath))
                {
                    System.IO.File.Delete(temp.FilePath);
                    _logger.LogInformation("Удален временный файл: {FilePath}", temp.FilePath);
                }
                context.TempUploads.Remove(temp);
            }

            if (expired.Any())
            {
                await context.SaveChangesAsync();
                _logger.LogInformation("Очищено {Count} временных файлов", expired.Count);
            }
        }

        private async Task CleanupExpiredArchivedOrdersAsync()
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var cutoffDate = DateTime.UtcNow.Subtract(_archiveRetention);
            var expiredArchivedOrders = await context.Orders
                .IgnoreQueryFilters()
                .Where(o => o.IsDeleted && o.DeletedAt <= cutoffDate)
                .ToListAsync();

            foreach (var order in expiredArchivedOrders)
            {
                // Удаляем связанные файлы фото
                var photos = await context.OrderPhotos
                    .Where(p => p.OrderId == order.Id)
                    .ToListAsync();

                foreach (var photo in photos)
                {
                    if (System.IO.File.Exists(photo.FilePath))
                    {
                        System.IO.File.Delete(photo.FilePath);
                    }
                    context.OrderPhotos.Remove(photo);
                }

                // Удаляем work items и payments
                var workItems = await context.OrderWorkItems
                    .Where(w => w.OrderId == order.Id)
                    .ToListAsync();
                context.OrderWorkItems.RemoveRange(workItems);

                var payments = await context.OrderPayments
                    .Where(p => p.OrderId == order.Id)
                    .ToListAsync();
                context.OrderPayments.RemoveRange(payments);

                // Удаляем сам заказ
                context.Orders.Remove(order);

                _logger.LogInformation("Полностью удален архивный заказ {OrderId} (удален {DeletedAt})",
                    order.Id, order.DeletedAt);
            }

            if (expiredArchivedOrders.Any())
            {
                await context.SaveChangesAsync();
                _logger.LogInformation("Очищено {Count} архивных заказов", expiredArchivedOrders.Count);
            }
        }
    }
}