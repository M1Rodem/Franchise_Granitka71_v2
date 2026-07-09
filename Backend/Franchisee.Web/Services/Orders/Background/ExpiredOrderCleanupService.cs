using Franchisee.Web.Configuration;
using Microsoft.EntityFrameworkCore;
using Franchisee.Web.Models.Entities.Orders;
using Franchisee.Web.Services.Notifications.Core;

namespace Franchisee.Web.Services.Orders.Background;

public class ExpiredOrderCleanupService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ExpiredOrderCleanupService> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromDays(1);  
    private readonly TimeSpan _deleteAfter = TimeSpan.FromDays(365);

    public ExpiredOrderCleanupService(
        IServiceProvider serviceProvider,
        ILogger<ExpiredOrderCleanupService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("ExpiredOrderCleanupService запущен. Проверка каждые {Interval} минут, удаляем через {DeleteAfter} минут", 
            _checkInterval.TotalMinutes, _deleteAfter.TotalMinutes);
        
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CleanupExpiredOrdersAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при очистке просроченных заказов");
            }
            
            await Task.Delay(_checkInterval, stoppingToken);
        }
    }

    private async Task CleanupExpiredOrdersAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var env = scope.ServiceProvider.GetRequiredService<IWebHostEnvironment>();
        var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();
        
        var now = DateTime.UtcNow;
        var deleteBefore = now.Subtract(_deleteAfter);
        
        // ========== 1. ОТПРАВКА ПРЕДУПРЕЖДЕНИЙ О СКОРОМ УДАЛЕНИИ ==========
        var daysThresholds = new[] { 14, 7, 1 };
        
        foreach (var days in daysThresholds)
        {
            // Заказы, которые будут удалены через days дней
            var warningDate = now.AddDays(days);
    
            var ordersToWarn = await context.Orders
                .IgnoreQueryFilters()
                .Where(o => o.Status == OrderStatus.Выполнено &&       // ← ОСТАВИТЬ
                            o.CompletedAt.HasValue &&                   // ← ОСТАВИТЬ
                            o.CompletedAt.Value.AddDays(365) <= warningDate && // ← ПРАВИЛЬНО
                            (o.LastExpirationWarningSentAt == null ||   // ← ВЕРНУТЬ (защита от дублей)
                            o.LastExpirationWarningSentAt.Value.Date < now.Date))
                .ToListAsync();
            
            foreach (var order in ordersToWarn)
            {
                var daysUntilDeletion = days;
                
                await SendExpirationWarningAsync(notificationService, order, daysUntilDeletion, now);
                order.LastExpirationWarningSentAt = now;
            }
            
            if (ordersToWarn.Any())
            {
                await context.SaveChangesAsync();
            }
        }
        
        // ========== 2. УДАЛЕНИЕ ПРОСРОЧЕННЫХ ЗАКАЗОВ ==========
        var expiredOrders = await context.Orders
            .IgnoreQueryFilters()
            .Where(o => o.Status == OrderStatus.Выполнено && o.CompletedAt.HasValue && o.CompletedAt < deleteBefore)
            .Include(o => o.Photos)
            .Include(o => o.WorkItems)
            .Include(o => o.Payments)
            .ToListAsync();
        
        if (!expiredOrders.Any())
        {
            _logger.LogDebug("Нет заказов для удаления (выполнены до {Date})", deleteBefore);
            return;
        }
        
        _logger.LogInformation("Найдено {Count} заказов для удаления (выполнены до {Date})", expiredOrders.Count, deleteBefore);
        
        foreach (var order in expiredOrders)
        {
            try
            {
                // Отправляем уведомление об удалении заказа
                await SendDeletionNotificationAsync(notificationService, order);
                
                // ========== 1. УДАЛЯЕМ УВЕДОМЛЕНИЯ, СВЯЗАННЫЕ С ЗАКАЗОМ ==========
                var notifications = await context.Notifications
                    .Where(n => n.OrderId == order.Id)
                    .ToListAsync();
                
                if (notifications.Any())
                {
                    var notificationIds = notifications.Select(n => n.Id).ToList();
                    var recipients = await context.NotificationRecipients
                        .Where(r => notificationIds.Contains(r.NotificationId))
                        .ToListAsync();
                    
                    if (recipients.Any())
                    {
                        context.NotificationRecipients.RemoveRange(recipients);
                        _logger.LogDebug("Удалено {Count} получателей уведомлений для заказа {OrderId}", recipients.Count, order.Id);
                    }
                    
                    context.Notifications.RemoveRange(notifications);
                    _logger.LogDebug("Удалено {Count} уведомлений для заказа {OrderId}", notifications.Count, order.Id);
                }
                
                // ========== 2. УДАЛЯЕМ МЕДИА ИЗ БД ==========
                if (order.Photos.Any())
                {
                    foreach (var photo in order.Photos)
                    {
                        if (System.IO.File.Exists(photo.FilePath))
                        {
                            try
                            {
                                System.IO.File.Delete(photo.FilePath);
                                _logger.LogDebug("Удалён файл {FilePath}", photo.FilePath);
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, "Не удалось удалить файл {FilePath}", photo.FilePath);
                            }
                        }
                    }
                    context.OrderPhotos.RemoveRange(order.Photos);
                }
                
                // ========== 3. УДАЛЯЕМ ФИЗИЧЕСКИЕ ПАПКИ ==========
                var orderFolderPath = Path.Combine(env.WebRootPath, "uploads", "orders", order.Id.ToString());
                if (Directory.Exists(orderFolderPath))
                {
                    try
                    {
                        await Task.Delay(100);
                        foreach (var file in Directory.GetFiles(orderFolderPath, "*", SearchOption.AllDirectories))
                        {
                            try { System.IO.File.Delete(file); }
                            catch (Exception ex) { _logger.LogWarning(ex, "Не удалось удалить файл {File}", file); }
                        }
                        Directory.Delete(orderFolderPath, true);
                        _logger.LogDebug("Удалена папка заказа {OrderId}", order.Id);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Не удалось удалить папку заказа {OrderId}", order.Id);
                    }
                }
                
                // ========== 4. УДАЛЯЕМ РАБОТЫ И ПЛАТЕЖИ ==========
                if (order.WorkItems.Any())
                {
                    context.OrderWorkItems.RemoveRange(order.WorkItems);
                }
                
                if (order.Payments.Any())
                {
                    context.OrderPayments.RemoveRange(order.Payments);
                }
                
                // ========== 5. УДАЛЯЕМ САМ ЗАКАЗ ==========
                context.Orders.Remove(order);
                
                _logger.LogInformation("Заказ {OrderNumber} (ID: {OrderId}) удалён. Выполнен: {CompletedAt}", 
                    order.OrderNumber, order.Id, order.CompletedAt);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при удалении заказа {OrderId}", order.Id);
            }
        }
        
        await context.SaveChangesAsync();
        _logger.LogInformation("Удалено {Count} заказов, выполненных до {Date}", expiredOrders.Count, deleteBefore);
    }
    
    private async Task SendExpirationWarningAsync(INotificationService notificationService, Order order, int daysUntilDeletion, DateTime now)
    {
        try
        {
            if (!order.CompletedAt.HasValue)
            {
                _logger.LogWarning("Заказ {OrderNumber} не имеет даты выполнения, пропускаем предупреждение", order.OrderNumber);
                return;
            }
            
            string shortMessage;
            string fullMessage;
            var deleteDate = order.CompletedAt.Value.AddDays(365);
            
            if (daysUntilDeletion == 1)
            {
                shortMessage = $"Заказ #{order.OrderNumber} будет удалён ЗАВТРА!";
                fullMessage = $"Заказ #{order.OrderNumber} будет удалён завтра в {deleteDate:dd.MM.yyyy HH:mm}. " +
                            $"Выполнен: {order.CompletedAt:dd.MM.yyyy HH:mm}.";
            }
            else
            {
                shortMessage = $"Заказ #{order.OrderNumber} будет удалён через {daysUntilDeletion} дней";
                fullMessage = $"Заказ #{order.OrderNumber} будет удалён через {daysUntilDeletion} дней в {deleteDate:dd.MM.yyyy HH:mm}. " +
                            $"Выполнен: {order.CompletedAt:dd.MM.yyyy HH:mm}.";
            }
            
            var superAdminIds = await notificationService.GetSuperAdminIdsAsync();
            
            if (!superAdminIds.Any())
                return;
            
            await notificationService.SendSystemNotificationWithFullMessageAsync(
                shortMessage,
                fullMessage,
                order.Id,
                order.OrderNumber,
                null,
                superAdminIds.ToArray());
            
            _logger.LogInformation(
                "[OrderExpiration] Отправлено предупреждение для заказа {OrderNumber}. Дней до удаления: {Days}",
                order.OrderNumber, daysUntilDeletion);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка отправки предупреждения об удалении заказа {OrderId}", order.Id);
        }
    }
    
    private async Task SendDeletionNotificationAsync(INotificationService notificationService, Order order)
    {
        try
        {
            var superAdminIds = await notificationService.GetSuperAdminIdsAsync();
            
            if (!superAdminIds.Any())
                return;
            
            var shortMessage = $"Заказ #{order.OrderNumber} УДАЛЁН (выполнен {order.CompletedAt:dd.MM.yyyy})";
            var fullMessage = $"Заказ #{order.OrderNumber} удалён из системы. " +
                             $"Выполнен: {order.CompletedAt:dd.MM.yyyy HH:mm}. " +
                             $"Удалён: {DateTime.UtcNow:dd.MM.yyyy HH:mm}.";
            
            await notificationService.SendSystemNotificationWithFullMessageAsync(
                shortMessage,
                fullMessage,
                order.Id,
                order.OrderNumber,
                null,
                superAdminIds.ToArray());
            
            _logger.LogDebug("Отправлено уведомление об удалении заказа {OrderNumber}", order.OrderNumber);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка отправки уведомления об удалении заказа {OrderId}", order.Id);
        }
    }
}