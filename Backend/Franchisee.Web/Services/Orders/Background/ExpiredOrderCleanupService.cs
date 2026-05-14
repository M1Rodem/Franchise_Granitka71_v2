using Franchisee.Web.Configuration;
using Microsoft.EntityFrameworkCore;
using Franchisee.Web.Models.Entities.Orders;

namespace Franchisee.Web.Services.Orders.Background;

public class ExpiredOrderCleanupService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ExpiredOrderCleanupService> _logger;
    
    // ДЛЯ ТЕСТА: проверка каждую минуту, удаляем через 10 минут
    private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(1);
    private readonly TimeSpan _deleteAfter = TimeSpan.FromMinutes(10);  // В продакшене: .FromDays(365)

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
        
        var deleteBefore = DateTime.UtcNow.Subtract(_deleteAfter);
        
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
                // ========== 1. СНАЧАЛА УДАЛЯЕМ УВЕДОМЛЕНИЯ, СВЯЗАННЫЕ С ЗАКАЗОМ ==========
                var notifications = await context.Notifications
                    .Where(n => n.OrderId == order.Id)
                    .ToListAsync();
                
                if (notifications.Any())
                {
                    // Удаляем получателей уведомлений
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
}