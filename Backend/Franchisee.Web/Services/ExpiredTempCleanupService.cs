using Franchisee.Web.Configuration;
using Franchisee.Web.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Franchisee.Web.Services
{
    public class ExpiredTempCleanupService : BackgroundService
    {
        private readonly ILogger<ExpiredTempCleanupService> _logger;
        private readonly IServiceProvider _serviceProvider;
        private readonly TimeSpan _cleanupInterval = TimeSpan.FromHours(1); // Проверка каждый час
        private readonly TimeSpan _archiveRetention = TimeSpan.FromDays(7); // Хранить 7 дней
        private readonly TimeSpan _pendingApprovalRetention = TimeSpan.FromDays(14); // 14 дней для файлов ожидающих approval

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
                    await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
                }
            }
        }

        private async Task CleanupExpiredTempsAsync()
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var now = DateTime.UtcNow;

            // учитываем разные TTL в зависимости от NotificationId
            var expired = await context.TempUploads
                .IgnoreQueryFilters()
                .Where(t =>
                    // Файлы без уведомления (preview) - 1 час
                    (t.NotificationId == null && t.ExpiresAt <= now) ||
                    // Файлы с уведомлением (pending approval) - 14 дней
                    (t.NotificationId != null && t.ExpiresAt <= now)
                )
                .ToListAsync();

            foreach (var temp in expired)
            {
                // если файл связан с активным уведомлением, не удаляем
                if (temp.NotificationId.HasValue)
                {
                    var notification = await context.Notifications
                        .IgnoreQueryFilters()
                        .FirstOrDefaultAsync(n => n.Id == temp.NotificationId.Value);

                    // Если уведомление еще активно (Pending или Postponed), пропускаем удаление
                    if (notification != null &&
                        (notification.Status == NotificationStatus.Pending ||
                         notification.Status == NotificationStatus.Postponed))
                    {
                        _logger.LogDebug("Пропускаем файл {TempId}, связанный с активным уведомлением {NotificationId}",
                            temp.Id, temp.NotificationId);
                        continue;
                    }
                }

                if (System.IO.File.Exists(temp.FilePath))
                {
                    System.IO.File.Delete(temp.FilePath);
                    _logger.LogInformation("Удален временный файл: {FilePath} (NotificationId: {NotificationId}, MediaType: {MediaType})",
                        temp.FilePath, temp.NotificationId, temp.MediaType);
                }
                context.TempUploads.Remove(temp);
            }

            if (expired.Any())
            {
                await context.SaveChangesAsync();
                _logger.LogInformation("Очищено {Count} временных файлов", expired.Count);
            }

            // очищаем TempUploads с несуществующими NotificationId
            await CleanupOrphanedTempUploadsAsync(context);
        }

        // Очистка "осиротевших" TempUploads
        private async Task CleanupOrphanedTempUploadsAsync(ApplicationDbContext context)
        {
            var orphanedTempUploads = await context.TempUploads
                .IgnoreQueryFilters()
                .Where(t => t.NotificationId != null)
                .Where(t => !context.Notifications.Any(n => n.Id == t.NotificationId))
                .ToListAsync();

            foreach (var temp in orphanedTempUploads)
            {
                if (System.IO.File.Exists(temp.FilePath))
                {
                    System.IO.File.Delete(temp.FilePath);
                    _logger.LogWarning("Удален 'осиротевший' временный файл: {FilePath} (NotificationId: {NotificationId} не существует, MediaType: {MediaType})",
                        temp.FilePath, temp.NotificationId, temp.MediaType);
                }
                context.TempUploads.Remove(temp);
            }

            if (orphanedTempUploads.Any())
            {
                await context.SaveChangesAsync();
                _logger.LogInformation("Очищено {Count} 'осиротевших' временных файлов", orphanedTempUploads.Count);
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
                var media = await context.OrderPhotos
                    .Where(p => p.OrderId == order.Id)
                    .ToListAsync();

                foreach (var mediaItem in media)
                {
                    if (System.IO.File.Exists(mediaItem.FilePath))
                    {
                        System.IO.File.Delete(mediaItem.FilePath);
                    }
                    context.OrderPhotos.Remove(mediaItem);
                }

                var workItems = await context.OrderWorkItems
                    .Where(w => w.OrderId == order.Id)
                    .ToListAsync();
                context.OrderWorkItems.RemoveRange(workItems);

                var payments = await context.OrderPayments
                    .Where(p => p.OrderId == order.Id)
                    .ToListAsync();
                context.OrderPayments.RemoveRange(payments);

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