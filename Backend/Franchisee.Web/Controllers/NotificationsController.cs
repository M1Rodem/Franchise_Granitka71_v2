using DocumentFormat.OpenXml.Spreadsheet;
using Franchisee.Web.Configuration;
using Franchisee.Web.Models.DTOs.Notifications;
using Franchisee.Web.Models.Entities;
using Franchisee.Web.Models.Entities.Notification;
using Franchisee.Web.Services.Notifications.Core;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Franchisee.Web.Services.Notifications.Dispatch;


[Route("api/[controller]")]
[ApiController]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _notificationService;
    private readonly ILogger<NotificationsController> _logger;
    private readonly IWebHostEnvironment _environment;

    public NotificationsController(
        INotificationService notificationService,
        ILogger<NotificationsController> logger,
        IWebHostEnvironment environment)
    {
        _notificationService = notificationService;
        _logger = logger;
        _environment = environment;
    }

    [HttpGet("list")]
    public async Task<ActionResult> GetNotifications(
    [FromQuery] string? status = null, // "active", "postponed", "pending", "approved", "rejected", "all"
    [FromQuery] int page = 1,
    [FromQuery] int pageSize = 20)
    {
        var userId = GetCurrentUserId();

        try
        {
            var notifications = await _notificationService.GetUserNotificationsAsync(
                userId,
                statusFilter: status ?? "active"); // По умолчанию "active"

            var notificationsList = notifications.ToList();
            var totalCount = notificationsList.Count;

            var paged = notificationsList
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            return Ok(new
            {
                items = paged,
                totalCount = totalCount,
                page = page,
                pageSize = pageSize,
                totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка получения уведомлений");
            return StatusCode(500, "Ошибка получения уведомлений");
        }
    }
    
    [HttpGet("{id}")]
    public async Task<ActionResult<NotificationDetailsDto>> GetNotificationDetails(int id)
    {
        var userId = GetCurrentUserId();

        var result = await _notificationService.GetNotificationDetailsAsync(id, userId);

        if (result == null)
            return NotFound();

        return Ok(result);
    }

    [HttpGet("summary")]
    public async Task<ActionResult> GetSummary()
    {
        var userId = GetCurrentUserId();
        var summary = await _notificationService.GetNotificationSummaryAsync(userId);
        return Ok(summary);
    }

    [HttpGet("count")]
    public async Task<ActionResult<NotificationBadgeDto>> GetNotificationBadge()
    {
        var userId = GetCurrentUserId();
        var badge = await _notificationService.GetNotificationBadgeAsync(userId);
        return Ok(badge);
    }

    [HttpGet("counts")]
    public async Task<ActionResult<NotificationCountsDto>> GetNotificationCounts()
    {
        var userId = GetCurrentUserId();
        
        try
        {
            var counts = await _notificationService.GetNotificationCountsAsync(userId);
            return Ok(counts);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка получения counts уведомлений для пользователя {UserId}", userId);
            return StatusCode(500, "Ошибка получения статистики уведомлений");
        }
    }


    [HttpPost("{id}/resolve")]
    public async Task<ActionResult> ResolveNotification(
        int id,
        [FromBody] ResolveNotificationRequest request)
    {
        var userId = GetCurrentUserId();

        try
        {
            var status = request.GetStatus();

            // Используем новый метод, который возвращает уведомление
            var updatedNotification = await _notificationService.ResolveNotificationWithResultAsync(
                notificationId: id,
                userId: userId,
                status: status,
                note: request.Note
            );

            if (updatedNotification == null)
                return BadRequest("Не удалось обработать уведомление");

            return Ok(new
            {
                success = true,
                message = "Уведомление обработано",
                notificationId = id,
                notification = updatedNotification 
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка обработки уведомления");
            return StatusCode(500, "Ошибка обработки уведомления");
        }
    }

    [HttpPost("{id}/postpone")]
    public async Task<ActionResult> PostponeNotification(int id, [FromQuery] int minutes = 30)
    {
        var userId = GetCurrentUserId();

        try
        {
            var success = await _notificationService.PostponeNotificationAsync(id, userId, minutes);

            if (!success)
                return BadRequest("Не удалось отложить уведомление");

            var updatedNotification = await _notificationService.GetNotificationByIdAsync(id, userId);

            return Ok(new
            {
                success = true,
                message = $"Уведомление отложено на {minutes} минут",
                notificationId = id,
                minutes = minutes,
                notification = updatedNotification  // ← НОВОЕ ПОЛЕ
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка откладывания уведомления");
            return StatusCode(500, "Ошибка откладывания уведомления");
        }
    }
    
    private int GetCurrentUserId()
    {
        var userIdStr = User.FindFirst(ClaimTypes.Name)?.Value;
        return int.TryParse(userIdStr, out int id) ? id : throw new UnauthorizedAccessException("Неверный ID пользователя");
    }

    #region Admin Test Endpoints (Development only)

    [HttpPost("cleanup-test")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<ActionResult> CleanupTest([FromQuery] int daysOld = 1)
    {
        // Доступно только в Development
        if (!_environment.IsDevelopment())
        {
            return NotFound();
        }

        _logger.LogWarning("РУЧНОЙ ТЕСТ ОЧИСТКИ УВЕДОМЛЕНИЙ! daysOld = {DaysOld}", daysOld);

        using var scope = HttpContext.RequestServices.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var cutoffDate = DateTime.UtcNow.Subtract(TimeSpan.FromDays(daysOld));

        // Тестовая очистка
        var oldRecipients = await context.NotificationRecipients
            .Where(nr => (nr.Status == NotificationStatus.Approved ||
                         nr.Status == NotificationStatus.Rejected) &&
                         nr.ResolvedAt.HasValue &&
                         nr.ResolvedAt < cutoffDate)
            .ToListAsync();

        return Ok(new
        {
            message = "Тест очистки выполнен",
            cutoffDate,
            foundCount = oldRecipients.Count,
            recipientIds = oldRecipients.Select(r => r.Id).ToList()
        });
    }

    [HttpPost("force-cleanup")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<ActionResult> ForceCleanup([FromQuery] int minutesOld = 5)
    {
        // Доступно только в Development
        if (!_environment.IsDevelopment())
        {
            return NotFound();
        }

        _logger.LogWarning("ПРИНУДИТЕЛЬНАЯ ОЧИСТКА УВЕДОМЛЕНИЙ! minutesOld = {MinutesOld}", minutesOld);

        using var scope = HttpContext.RequestServices.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var cutoffDate = DateTime.UtcNow.Subtract(TimeSpan.FromMinutes(minutesOld));

        try
        {
            // 1. Удаляем старых получателей
            var oldRecipients = await context.NotificationRecipients
                .Include(nr => nr.Notification)
                .Where(nr => nr.ResolvedAt.HasValue && nr.ResolvedAt < cutoffDate)
                .ToListAsync();

            var recipientIds = oldRecipients.Select(r => r.Id).ToList();
            var recipientNotificationIds = oldRecipients.Select(r => r.NotificationId).Distinct().ToList();

            if (oldRecipients.Any())
            {
                context.NotificationRecipients.RemoveRange(oldRecipients);
            }

            // 2. Удаляем старые уведомления
            var oldNotifications = await context.Notifications
                .Where(n => n.CreatedAt < cutoffDate)
                .ToListAsync();

            var notificationIds = oldNotifications.Select(n => n.Id).ToList();

            if (oldNotifications.Any())
            {
                context.Notifications.RemoveRange(oldNotifications);
            }

            await context.SaveChangesAsync();

            return Ok(new
            {
                message = "Принудительная очистка выполнена",
                cutoffDate,
                recipientsDeleted = oldRecipients.Count,
                notificationsDeleted = oldNotifications.Count,
                recipientIds,
                notificationIds,
                recipientNotificationIds
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка принудительной очистки");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("check-blocking")]
    public async Task<ActionResult> CheckBlocking()
    {
        var userId = GetCurrentUserId();

        try
        {
            // Проверяем роль пользователя
            bool isAdminOrSuperAdmin = User.IsInRole("Admin") || User.IsInRole("SuperAdmin");
            
            // Для админов блокировка всегда false
            if (isAdminOrSuperAdmin)
            {
                _logger.LogInformation("[Blocking] UserId={UserId} is Admin/SuperAdmin, blocking disabled", userId);
                
                return Ok(new
                {
                    isBlocked = false,
                    blockingCount = 0,
                    message = (string?)null,
                    timestamp = DateTime.UtcNow
                });
            }
            
            // Для обычных пользователей — стандартная логика
            var blockingCount = await _notificationService.GetBlockingNotificationsCount(userId);
            _logger.LogInformation("[Blocking] UserId={UserId} Result={IsBlocked}", userId, blockingCount > 0);

            return Ok(new
            {
                isBlocked = blockingCount > 0,
                blockingCount = blockingCount,
                message = blockingCount > 0
                    ? $"Сначала выполните действия в {blockingCount} уведомлении(ях)"
                    : null,
                timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка проверки блокировки для пользователя {UserId}", userId);
            return StatusCode(500, "Ошибка проверки блокировки");
        }
    }

    [HttpPost("test-postponed")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<ActionResult> TestPostponedCleanup()
    {
        // Доступно только в Development
        if (!_environment.IsDevelopment())
        {
            return NotFound();
        }

        _logger.LogInformation("Тест возврата отложенных уведомлений");

        using var scope = HttpContext.RequestServices.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // Создаем тестовое отложенное уведомление (с прошедшим временем)
        var testUserId = GetCurrentUserId();
        var now = DateTime.UtcNow;

        // Ищем любое уведомление
        var anyNotification = await context.Notifications.FirstOrDefaultAsync();
        if (anyNotification == null)
        {
            return Ok(new { message = "Нет уведомлений для теста" });
        }

        // Создаем отложенного получателя с ПРОШЕДШИМ временем
        var testRecipient = new NotificationRecipient
        {
            NotificationId = anyNotification.Id,
            UserId = testUserId,
            Status = NotificationStatus.Postponed,
            ResolvedAt = now.AddMinutes(-5), // Время УЖЕ прошло
            ResolutionNote = "Тестовое отложенное уведомление"
        };

        context.NotificationRecipients.Add(testRecipient);
        await context.SaveChangesAsync();

        var postponedCount = await context.NotificationRecipients
            .CountAsync(nr => nr.Status == NotificationStatus.Postponed);

        return Ok(new
        {
            message = "Тестовое отложенное уведомление создано",
            testRecipientId = testRecipient.Id,
            notificationId = anyNotification.Id,
            totalPostponed = postponedCount,
            note = "Сервис проверит его при следующем запуске (каждые 5 минут)"
        });
    }

    #endregion
}
