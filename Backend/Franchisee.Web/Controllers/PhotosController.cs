using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using System.ComponentModel.DataAnnotations;
using System.IO;
using Franchisee.Web.Configuration;
using Franchisee.Web.Models;
using Franchisee.Web.Services;

namespace Franchisee.Web.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public class PhotosController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IWebHostEnvironment _environment;
        private readonly ILogger<PhotosController> _logger;
        private const long MaxFileSize = 10 * 1024 * 1024;
        private static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png", ".gif" };
        private const int ThumbSize = 150;
        private readonly IPhotoService _photoService;

        public PhotosController(ApplicationDbContext context, IWebHostEnvironment environment, ILogger<PhotosController> logger, IPhotoService photoService)
        {
            _context = context;
            _environment = environment;
            _logger = logger;
            _photoService = photoService;
        }
        private string? GetSafeFilePath(string filePath)
        {
            if (string.IsNullOrEmpty(filePath))
                return null;

            try
            {
                var fullPath = Path.GetFullPath(filePath);
                var uploadsRoot = Path.GetFullPath(Path.Combine(_environment.WebRootPath, "uploads"));

                return fullPath.StartsWith(uploadsRoot) ? fullPath : null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка проверки пути к файлу");
                return null;
            }
        }
        private int GetCurrentUserId()
        {
            var userIdStr = User.FindFirst("UserId")?.Value;
            if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out int userId))
            {
                throw new UnauthorizedAccessException("Неверный ID пользователя");
            }
            return userId;
        }

        private bool IsAdminOrHigher() => User.IsInRole("Admin") || User.IsInRole("SuperAdmin");
        private bool IsSuperAdmin() => User.IsInRole("SuperAdmin");

        // POST: api/Photos/upload-temp
        [HttpPost("upload-temp")]
        [Consumes("multipart/form-data")]
        public async Task<ActionResult<TempUploadDto>> UploadTemp(IFormFile file)
        {
            try
            {
                if (file == null || file.Length == 0)
                {
                    _logger.LogWarning("UploadTemp: Файл не предоставлен");
                    return BadRequest("Файл не предоставлен");
                }

                if (file.Length > MaxFileSize)
                {
                    _logger.LogWarning("UploadTemp: Файл слишком большой {Size} > {Max}B", file.Length, MaxFileSize);
                    return BadRequest($"Файл слишком большой (max {MaxFileSize / 1024 / 1024}MB)");
                }

                _logger.LogInformation("UploadTemp: Файл - {Name}, {Size}B, {Type}", file.FileName ?? "unknown", file.Length, file.ContentType);

                var uploaderId = int.Parse(User.FindFirst("UserId")?.Value ?? "0");
                var dto = await _photoService.UploadTempAsync(file, uploaderId);
                if (dto == null)
                {
                    _logger.LogWarning("UploadTemp: Валидация fail для {Name}", file.FileName ?? "unknown");
                    return BadRequest("Invalid file: size/type/dims");
                }

                _logger.LogInformation("UploadTemp: Успех, Id: {Id}, Preview: {Url}", dto.Id, dto.PreviewUrl);
                return Ok(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "UploadTemp: Неожиданная ошибка");
                return StatusCode(500, "Внутренняя ошибка сервера");
            }
        }

        // POST: api/Photos/move-temp-to-order/{orderId}
        [HttpPost("move-temp-to-order/{orderId}")]
        public async Task<ActionResult> MoveTempToOrder(int orderId, [FromBody] List<int> tempIds)
        {
            if (tempIds == null || !tempIds.Any())
                return BadRequest("Нет файлов для перемещения");

            var order = await _context.Orders
                .Include(o => o.Photos)
                .FirstOrDefaultAsync(o => o.Id == orderId && !o.IsDeleted);

            if (order == null)
                return NotFound("Заказ не найден");

            var userId = GetCurrentUserId();

            try
            {
                if (!IsAdminOrHigher() && order.ManagerId != userId)
                {
                    _logger.LogInformation(
                        "Менеджер {UserId} запрашивает добавление фото в чужой заказ {OrderId} (владелец: {ManagerId})",
                        userId, orderId, order.ManagerId);

                    // Проверяем лимит фото
                    if (order.Photos.Count + tempIds.Count > 10) // MaxPhotosPerOrder = 10
                    {
                        return BadRequest($"Максимальное количество фото в заказе: 10. Текущее: {order.Photos.Count}, хотите добавить: {tempIds.Count}");
                    }

                    var notificationService = HttpContext.RequestServices.GetRequiredService<INotificationService>();

                    var proposedChanges = new Dictionary<string, object>
                    {
                        ["Photos"] = new
                        {
                            addedTempIds = tempIds,
                            removedPhotoIds = new List<int>() // Нет удаляемых фото
                        }
                    };

                    var notificationId = await notificationService.CreateOrderUpdateRequestAsync(
                        orderId: orderId,
                        initiatorId: userId,
                        proposedChanges: proposedChanges,
                        comment: $"Добавление {tempIds.Count} фото в заказ"
                    );

                    _logger.LogInformation(
                        "Создано уведомление {NotificationId} для добавления фото в заказ {OrderId}",
                        notificationId, orderId);

                    return Ok(new
                    {
                        success = true,
                        message = $"Запрос на добавление {tempIds.Count} фото отправлен владельцу заказа и администраторам",
                        notificationId = notificationId,
                        requiresApproval = true
                    });
                }

                var uploaderId = GetCurrentUserId();
                var committedCount = await _photoService.CommitTempToOrderAsync(orderId, tempIds, uploaderId);

                _logger.LogInformation("Moved {Count} temp photos to order {OrderId}", committedCount, orderId);
                return Ok(new
                {
                    message = $"Перемещено {committedCount} фото",
                    addedCount = committedCount,
                    requiresApproval = false
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error moving temp photos to order {OrderId}", orderId);
                return Problem("Ошибка перемещения файлов");
            }
        }

        // скачивание
        [HttpGet("{id}/download")]
        public async Task<IActionResult> DownloadPhoto(int id)
        {
            try
            {
                var photo = await _context.OrderPhotos.FindAsync(id);
                if (photo == null)
                    return NotFound("Фото не найдено");

                //   ПРОВЕРЯЕМ БЕЗОПАСНОСТЬ ПУТИ
                var safePath = GetSafeFilePath(photo.FilePath);
                if (string.IsNullOrEmpty(safePath))
                    return BadRequest("Некорректный путь к файлу");

                if (!System.IO.File.Exists(safePath))
                    return NotFound("Файл не найден на диске");

                // Все авторизованные пользователи видят все фото
                if (User.Identity?.IsAuthenticated != true)
                    return Unauthorized("Требуется авторизация");

                //   ИСПОЛЬЗУЕМ ПРОВЕРЕННЫЙ ПУТЬ
                var fileBytes = await System.IO.File.ReadAllBytesAsync(safePath);
                var fileName = photo.OriginalFileName ?? $"photo_{id}{Path.GetExtension(photo.FilePath)}";

                return File(fileBytes, photo.ContentType ?? "image/jpeg", fileName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error downloading photo {PhotoId}", id);
                return StatusCode(500, "Ошибка загрузки фото");
            }
        }

        // GET: api/Photos/order/{orderId}
        [HttpGet("order/{orderId}")]
        public async Task<ActionResult<List<OrderPhotoDto>>> GetOrderPhotos(int orderId)
        {
            try
            {
                var photos = await _context.OrderPhotos
                    .Where(p => p.OrderId == orderId)
                    .OrderByDescending(p => p.UploadedAt)
                    .Select(p => new OrderPhotoDto
                    {
                        Id = p.Id,
                        Url = $"/api/photos/{p.Id}/file",
                        OriginalFileName = p.OriginalFileName ?? string.Empty,
                        Size = p.Size,
                        UploadedAt = p.UploadedAt,
                        Width = p.Width.GetValueOrDefault(),
                        Height = p.Height.GetValueOrDefault()
                    })
                    .ToListAsync();
                _logger.LogDebug("Fetched {Count} photos for order {OrderId}", photos.Count, orderId);
                return Ok(photos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching photos for order {OrderId}", orderId);
                return Problem("Ошибка получения фото");
            }
        }

        // GET: api/Photos/{id}/file
        [HttpGet("{id}/file")]
        public async Task<IActionResult> GetPhotoFile(int id)
        {
            var photo = await _context.OrderPhotos.FindAsync(id);
            if (photo == null)
                return NotFound("Фото не найдено");

            //   ПРОВЕРЯЕМ БЕЗОПАСНОСТЬ ПУТИ
            var safePath = GetSafeFilePath(photo.FilePath);
            if (string.IsNullOrEmpty(safePath))
                return BadRequest("Некорректный путь к файлу");

            if (!System.IO.File.Exists(safePath))
                return NotFound("Файл не найден на диске");

            var order = await _context.Orders
                .FirstOrDefaultAsync(o => o.Id == photo.OrderId && !o.IsDeleted);

            if (order == null)
                return NotFound("Заказ не найден");

            if (User.Identity?.IsAuthenticated != true)
                return Unauthorized("Требуется авторизация");

            var contentType = photo.ContentType ?? "image/jpeg";
            return PhysicalFile(safePath, contentType, enableRangeProcessing: true);
        }

        // GET: api/Photos/proxy/{id} - специальный endpoint для фронтенда
        [HttpGet("proxy/{id}")]
        public async Task<IActionResult> GetPhotoProxy(int id)
        {
            try
            {
                var photo = await _context.OrderPhotos.FindAsync(id);
                if (photo == null)
                    return NotFound("Фото не найдено");

                //   ПРОВЕРЯЕМ БЕЗОПАСНОСТЬ ПУТИ
                var safePath = GetSafeFilePath(photo.FilePath);
                if (string.IsNullOrEmpty(safePath))
                    return BadRequest("Некорректный путь к файлу");

                if (!System.IO.File.Exists(safePath))
                    return NotFound("Файл не найден на диске");

                if (User.Identity?.IsAuthenticated != true)
                    return Unauthorized("Требуется авторизация");

                var order = await _context.Orders
                    .Include(o => o.Photos)
                    .FirstOrDefaultAsync(o => o.Id == photo.OrderId && !o.IsDeleted);

                if (order == null)
                    return NotFound("Заказ не найден");

                var userIdClaim = User.FindFirst("UserId");
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
                    return Unauthorized("Invalid user ID");

                var contentType = photo.ContentType ?? "image/jpeg";
                return PhysicalFile(safePath, contentType, enableRangeProcessing: true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetPhotoProxy for photo {PhotoId}", id);
                return StatusCode(500, "Ошибка загрузки фото");
            }
        }

        // удаление фото только при редактировании заказа
        [HttpDelete("edit/{id}")]
        public async Task<IActionResult> DeletePhotoDuringEdit(int id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var photo = await _context.OrderPhotos
                    .Include(p => p.Order)
                    .FirstOrDefaultAsync(p => p.Id == id);

                if (photo == null)
                    return NoContent();

                if (photo.Order == null)
                    return BadRequest("Фото не принадлежит заказу");

                var order = photo.Order;

                if (!IsAdminOrHigher() && order.ManagerId != userId)
                {
                    _logger.LogInformation(
                        "Менеджер {UserId} запрашивает удаление фото {PhotoId} из чужого заказа {OrderId} (владелец: {ManagerId})",
                        userId, id, order.Id, order.ManagerId);

                    var notificationService = HttpContext.RequestServices.GetRequiredService<INotificationService>();

                    var proposedChanges = new Dictionary<string, object>
                    {
                        ["Photos"] = new
                        {
                            addedTempIds = new List<int>(), // Нет добавляемых фото
                            removedPhotoIds = new List<int> { id } // Удаляем это фото
                        }
                    };

                    var notificationId = await notificationService.CreateOrderUpdateRequestAsync(
                        orderId: order.Id,
                        initiatorId: userId,
                        proposedChanges: proposedChanges,
                        comment: $"Удаление фото: {photo.OriginalFileName}"
                    );

                    _logger.LogInformation(
                        "Создано уведомление {NotificationId} для удаления фото {PhotoId} из заказа {OrderId}",
                        notificationId, id, order.Id);

                    return Ok(new
                    {
                        success = true,
                        message = "Запрос на удаление фото отправлен владельцу заказа и администраторам",
                        notificationId = notificationId,
                        requiresApproval = true
                    });
                }

                if (User.Identity?.IsAuthenticated != true)
                    return Unauthorized("Требуется авторизация");

                var safePath = GetSafeFilePath(photo.FilePath);
                if (!string.IsNullOrEmpty(safePath) && System.IO.File.Exists(safePath))
                {
                    await Task.Run(() => System.IO.File.Delete(safePath));
                }

                _context.OrderPhotos.Remove(photo);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Photo {PhotoId} deleted during edit by user {UserId}", id, userId);
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting photo {PhotoId} during edit", id);
                return Problem("Ошибка удаления фото");
            }
        }

        // GET: api/Photos/temp-preview/{tempId} — отдача temp файла для preview
        [HttpGet("temp-preview/{tempId}")]
        public async Task<IActionResult> GetTempPreview(int tempId)
        {
            var temp = await _context.TempUploads
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(t => t.Id == tempId);

            if (temp == null)
                return NotFound("Temp file not found");
            // ЛЮБОЙ авторизованный пользователь может просматривать временные фото

            // ПРОВЕРЯЕМ БЕЗОПАСНОСТЬ ПУТИ
            var safePath = GetSafeFilePath(temp.FilePath);
            if (string.IsNullOrEmpty(safePath))
                return BadRequest("Некорректный путь к файлу");

            if (!System.IO.File.Exists(safePath))
                return NotFound("File not found on disk");

            var contentType = temp.ContentType ?? "application/octet-stream";
            return PhysicalFile(safePath, contentType, enableRangeProcessing: true);
        }

        // DELETE: api/Photos/temp/{fileName}
        [HttpDelete("temp/{tempId:int}")]
        public async Task<IActionResult> DeleteTempPhoto(int tempId)
        {
            try
            {
                var tempPhoto = await _context.TempUploads
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(t => t.Id == tempId);

                if (tempPhoto == null)
                {
                    _logger.LogInformation("Temp photo not found: {TempId}", tempId);
                    return NoContent();
                }

                //   ПРОВЕРЯЕМ БЕЗОПАСНОСТЬ ПУТИ ПЕРЕД УДАЛЕНИЕМ
                var safePath = GetSafeFilePath(tempPhoto.FilePath);
                if (!string.IsNullOrEmpty(safePath) && System.IO.File.Exists(safePath))
                {
                    await Task.Run(() => System.IO.File.Delete(safePath));
                    _logger.LogInformation("Temp photo deleted: {FilePath}", safePath);
                }
                else
                {
                    _logger.LogWarning("Temp file not found on disk: {FilePath}", tempPhoto.FilePath);
                }

                _context.TempUploads.Remove(tempPhoto);
                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting temp photo {TempId}", tempId);
                return Problem("Ошибка удаления временного файла");
            }
        }
    }
}