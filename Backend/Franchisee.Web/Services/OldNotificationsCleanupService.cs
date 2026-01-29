using Franchisee.Web.Configuration;
using Franchisee.Web.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Franchisee.Web.Services
{
    public class OldNotificationsCleanupService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<OldNotificationsCleanupService> _logger;

        private readonly TimeSpan _checkInterval = TimeSpan.FromDays(1);
        private readonly TimeSpan _retentionPeriod = TimeSpan.FromDays(30);

        public OldNotificationsCleanupService(
            IServiceProvider serviceProvider,
            ILogger<OldNotificationsCleanupService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Сервис очистки уведомлений запущен. Проверка каждый {Days} день, удаляем старше {RetentionDays} дней",
                _checkInterval.TotalDays, _retentionPeriod.TotalDays);

            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    _logger.LogInformation("Начинаем проверку очистки...");

                    await CleanupOldNotificationsAsync(stoppingToken);

                    _logger.LogInformation("Проверка завершена. Следующая через {Days} дней",
                        _checkInterval.TotalDays);

                    await Task.Delay(_checkInterval, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    _logger.LogInformation("Сервис остановлен");
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Ошибка в сервисе очистки уведомлений");
                    await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
                }
            }
        }

        private async Task CleanupOldNotificationsAsync(CancellationToken cancellationToken)
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var cutoffDate = DateTime.UtcNow.Subtract(_retentionPeriod);

            _logger.LogInformation("Удаляем уведомления старше {CutoffDate} ({Days} дней)",
                cutoffDate, _retentionPeriod.TotalDays);

            var oldProcessedRecipients = await context.NotificationRecipients
                .Include(nr => nr.Notification)
                .Where(nr => (nr.Status == NotificationStatus.Approved ||
                             nr.Status == NotificationStatus.Rejected) &&
                             nr.ResolvedAt.HasValue &&
                             nr.ResolvedAt < cutoffDate)
                .ToListAsync(cancellationToken);

            if (!oldProcessedRecipients.Any())
            {
                _logger.LogInformation("Нет старых уведомлений для очистки (старше {Days} дней)",
                    _retentionPeriod.TotalDays);
                return;
            }

            _logger.LogInformation("Найдено {Count} старых обработанных получателей уведомлений",
                oldProcessedRecipients.Count);

            foreach (var recipient in oldProcessedRecipients.Take(5))
            {
                _logger.LogDebug("Удаляем получателя ID: {Id}, Уведомление: {NotificationId}, Status: {Status}, ResolvedAt: {ResolvedAt}",
                    recipient.Id, recipient.NotificationId, recipient.Status, recipient.ResolvedAt);
            }

            context.NotificationRecipients.RemoveRange(oldProcessedRecipients);
            var recipientsDeleted = await context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Удалено {Count} старых получателей уведомлений", recipientsDeleted);

            var affectedNotificationIds = oldProcessedRecipients
                .Select(nr => nr.NotificationId)
                .Distinct()
                .ToList();

            var orphanedNotifications = await context.Notifications
                .Where(n => affectedNotificationIds.Contains(n.Id) &&
                           !n.Recipients.Any())
                .ToListAsync(cancellationToken);

            if (orphanedNotifications.Any())
            {
                context.Notifications.RemoveRange(orphanedNotifications);
                var notificationsDeleted = await context.SaveChangesAsync(cancellationToken);

                _logger.LogInformation("Удалено {Count} уведомлений без получателей", notificationsDeleted);
            }

            _logger.LogInformation("Очистка завершена. Итого удалено: {Recipients} получателей, {Notifications} уведомлений",
                oldProcessedRecipients.Count, orphanedNotifications.Count);
        }
    }
}