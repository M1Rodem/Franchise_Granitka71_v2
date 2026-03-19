using Franchisee.Web.Configuration;
using Franchisee.Web.Models;
using Franchisee.Web.Services.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Franchisee.Web.Services
{
    public class PostponedNotificationCleanupService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<PostponedNotificationCleanupService> _logger;

        // Проверяем каждую минуту для точности
        private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(1);

        public PostponedNotificationCleanupService(
            IServiceProvider serviceProvider,
            ILogger<PostponedNotificationCleanupService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Сервис возврата отложенных уведомлений запущен. Проверка каждые {Seconds} секунд",
                _checkInterval.TotalSeconds);

            await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await ReturnPostponedNotificationsAsync(stoppingToken);
                    await Task.Delay(_checkInterval, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Ошибка в сервисе возврата отложенных уведомлений");
                    await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
                }
            }
        }

        private async Task ReturnPostponedNotificationsAsync(CancellationToken cancellationToken)
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<NotificationHub, INotificationClient>>();
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<PostponedNotificationCleanupService>>();

            var now = DateTime.UtcNow;

            var postponedRecipients = await context.NotificationRecipients
                .Include(nr => nr.Notification)
                    .ThenInclude(n => n.Order)
                .Include(nr => nr.Notification)
                    .ThenInclude(n => n.Initiator)
                .Where(nr => nr.Status == NotificationStatus.Postponed &&
                           nr.ReturnsAt.HasValue &&
                           nr.ReturnsAt <= now)
                .ToListAsync(cancellationToken);

            if (!postponedRecipients.Any()) return;

            logger.LogInformation("Найдено {Count} отложенных уведомлений для возврата в Pending",
                postponedRecipients.Count);

            // Группируем по пользователям для отправки SignalR
            var usersToUpdate = new Dictionary<int, List<NotificationRecipient>>();

            foreach (var recipient in postponedRecipients)
            {
                // Сохраняем старые данные для SignalR
                var oldStatus = recipient.Status;
                var returnsAt = recipient.ReturnsAt;

                // Обновляем в БД
                recipient.Status = NotificationStatus.Pending;
                recipient.ResolvedAt = null;
                recipient.ReturnsAt = null;
                recipient.ResolutionNote = null;

                // Добавляем в словарь для группировки по пользователям
                if (!usersToUpdate.ContainsKey(recipient.UserId))
                {
                    usersToUpdate[recipient.UserId] = new List<NotificationRecipient>();
                }
                usersToUpdate[recipient.UserId].Add(recipient);
            }

            // Обновляем глобальные статусы Notification
            var notificationGroups = postponedRecipients
                .GroupBy(r => r.NotificationId)
                .ToList();

            foreach (var group in notificationGroups)
            {
                var notification = await context.Notifications
                    .Include(n => n.Recipients)
                    .FirstOrDefaultAsync(n => n.Id == group.Key, cancellationToken);

                if (notification != null && notification.Recipients.All(r => r.Status == NotificationStatus.Pending))
                {
                    notification.Status = NotificationStatus.Pending;
                    notification.ReturnsAt = null;
                }
            }

            await context.SaveChangesAsync(cancellationToken);

            // Отправляем SignalR события
            foreach (var userGroup in usersToUpdate)
            {
                var userId = userGroup.Key;
                var recipients = userGroup.Value;

                try
                {
                    // Отправляем UpdateNotification для каждого уведомления
                    foreach (var recipient in recipients)
                    {
                        var notification = recipient.Notification;

                        await hubContext.Clients.Group($"user-{userId}")
                            .UpdateNotification(new NotificationUpdateDto
                            {
                                Id = notification.Id,
                                Type = notification.Type,
                                Status = NotificationStatus.Pending,
                                Title = notification.Title,
                                Message = notification.Message,
                                CreatedAt = notification.CreatedAt,
                                OrderId = notification.OrderId,
                                OrderNumber = notification.Order?.OrderNumber ?? "Без номера",
                                InitiatorName = notification.Initiator?.FullName ?? "Неизвестно"
                            });
                    }

                    // Обновляем счётчик для пользователя
                    var pendingCount = await context.NotificationRecipients
                    .Where(nr => nr.UserId == userId &&
                                (nr.Status == NotificationStatus.Pending ||
                                 (nr.Status == NotificationStatus.Postponed &&
                                  nr.ReturnsAt.HasValue &&
                                  nr.ReturnsAt > now)))
                    .CountAsync(cancellationToken);

                    // Создаем DTO для бейджа (упрощенный вариант - цвет определит фронт)
                    var badge = new NotificationBadgeDto
                    {
                        Count = pendingCount,
                        Color = "red" // Или можно не указывать цвет, фронт сам определит
                    };

                    await hubContext.Clients.Group($"user-{userId}")
                        .UpdateNotificationCount(badge);

                    logger.LogDebug("Отправлены SignalR события пользователю {UserId} для {Count} уведомлений",
                        userId, recipients.Count);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Ошибка отправки SignalR пользователю {UserId}", userId);
                }
            }
        }
    }
}