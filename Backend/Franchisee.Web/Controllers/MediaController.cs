using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Franchisee.Web.Configuration;
using Franchisee.Web.Models;
using Franchisee.Web.Services;

namespace Franchisee.Web.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    [RequestSizeLimit(500 * 1024 * 1024)] // Увеличено до 500 MB
    public class MediaController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IWebHostEnvironment _environment;
        private readonly ILogger<MediaController> _logger;
        private readonly IMediaService _mediaService;
        private const long MaxFileSize = 500 * 1024 * 1024; // 500 MB

        public MediaController(
            ApplicationDbContext context,
            IWebHostEnvironment environment,
            ILogger<MediaController> logger,
            IMediaService mediaService)
        {
            _context = context;
            _environment = environment;
            _logger = logger;
            _mediaService = mediaService;
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

        // POST: api/media/upload-temp?type=photo|video
        [HttpPost("upload-temp")]
        [Consumes("multipart/form-data")]
        public async Task<ActionResult<TempUploadDto>> UploadTemp(
            IFormFile file,
            [FromQuery] MediaType type = MediaType.Photo)
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

                _logger.LogInformation("UploadTemp: Файл - {Name}, {Size}B, {Type}, MediaType: {MediaType}",
                    file.FileName ?? "unknown", file.Length, file.ContentType, type);

                var uploaderId = GetCurrentUserId();
                var dto = await _mediaService.UploadTempAsync(file, uploaderId, type);

                if (dto == null)
                {
                    _logger.LogWarning("UploadTemp: Валидация fail для {Name}", file.FileName ?? "unknown");
                    return BadRequest("Invalid file: size/type/dims");
                }

                _logger.LogInformation("UploadTemp: Успех, Id: {Id}, Preview: {Url}, Type: {Type}",
                    dto.Id, dto.PreviewUrl, type);
                return Ok(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "UploadTemp: Неожиданная ошибка");
                return StatusCode(500, "Внутренняя ошибка сервера");
            }
        }

        // POST: api/media/move-temp-to-order/{orderId}?type=photo|video
        [HttpPost("move-temp-to-order/{orderId}")]
        public async Task<ActionResult> MoveTempToOrder(
    int orderId,
    [FromBody] List<int> tempIds,
    [FromQuery] MediaType type = MediaType.Photo)
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
                var uploaderId = GetCurrentUserId();
                var committedCount = await _mediaService.CommitTempToOrderAsync(orderId, tempIds, uploaderId, type);

                _logger.LogInformation("Moved {Count} temp media to order {OrderId}, Type: {Type}",
                    committedCount, orderId, type);

                return Ok(new
                {
                    message = $"Перемещено {committedCount} файлов",
                    addedCount = committedCount,
                    type = type.ToString()
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error moving temp media to order {OrderId}", orderId);
                return Problem("Ошибка перемещения файлов");
            }
        }

        // GET: api/media/{id}/file
        [HttpGet("{id}/file")]
        public async Task<IActionResult> GetMediaFile(int id)
        {
            var media = await _context.OrderPhotos.FindAsync(id);
            if (media == null)
                return NotFound("Медиа файл не найден");

            // Проверяем безопасность пути
            var safePath = GetSafeFilePath(media.FilePath);
            if (string.IsNullOrEmpty(safePath))
                return BadRequest("Некорректный путь к файлу");

            if (!System.IO.File.Exists(safePath))
                return NotFound("Файл не найден на диске");

            var order = await _context.Orders
                .FirstOrDefaultAsync(o => o.Id == media.OrderId && !o.IsDeleted);

            if (order == null)
                return NotFound("Заказ не найден");

            if (User.Identity?.IsAuthenticated != true)
                return Unauthorized("Требуется авторизация");

            var contentType = media.ContentType ??
                (media.MediaType == MediaType.Photo ? "image/jpeg" : "video/mp4");

            return PhysicalFile(safePath, contentType, enableRangeProcessing: true);
        }

        // GET: api/media/order/{orderId}
        [HttpGet("order/{orderId}")]
        public async Task<ActionResult<List<OrderMediaDto>>> GetOrderMedia(int orderId)
        {
            try
            {
                var media = await _context.OrderPhotos
                    .Where(p => p.OrderId == orderId)
                    .OrderByDescending(p => p.UploadedAt)
                    .Select(p => new OrderMediaDto
                    {
                        Id = p.Id,
                        Url = $"/api/Media/{p.Id}/file",
                        OriginalFileName = p.OriginalFileName ?? string.Empty,
                        Size = p.Size,
                        UploadedAt = p.UploadedAt,
                        Width = p.Width.GetValueOrDefault(),
                        Height = p.Height.GetValueOrDefault(),
                        MediaType = p.MediaType
                    })
                    .ToListAsync();

                _logger.LogDebug("Fetched {Count} media files for order {OrderId}", media.Count, orderId);
                return Ok(media);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching media for order {OrderId}", orderId);
                return Problem("Ошибка получения медиа файлов");
            }
        }

        // GET: api/media/temp-preview/{tempId}
        [HttpGet("temp-preview/{tempId}")]
        public async Task<IActionResult> GetTempPreview(int tempId)
        {
            var temp = await _context.TempUploads
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(t => t.Id == tempId);

            if (temp == null)
                return NotFound("Temp file not found");

            // Любой авторизованный пользователь может просматривать временные файлы
            if (User.Identity?.IsAuthenticated != true)
                return Unauthorized("Требуется авторизация");

            // Проверяем безопасность пути
            var safePath = GetSafeFilePath(temp.FilePath);
            if (string.IsNullOrEmpty(safePath))
                return BadRequest("Некорректный путь к файлу");

            if (!System.IO.File.Exists(safePath))
                return NotFound("File not found on disk");

            var contentType = temp.ContentType ?? "application/octet-stream";
            return PhysicalFile(safePath, contentType, enableRangeProcessing: true);
        }

        // DELETE: api/media/temp/{tempId}
        [HttpDelete("temp/{tempId:int}")]
        public async Task<IActionResult> DeleteTempMedia(int tempId)
        {
            try
            {
                var tempMedia = await _context.TempUploads
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(t => t.Id == tempId);

                if (tempMedia == null)
                {
                    _logger.LogInformation("Temp media not found: {TempId}", tempId);
                    return NoContent();
                }

                // Проверяем безопасность пути перед удалением
                var safePath = GetSafeFilePath(tempMedia.FilePath);
                if (!string.IsNullOrEmpty(safePath) && System.IO.File.Exists(safePath))
                {
                    await Task.Run(() => System.IO.File.Delete(safePath));
                    _logger.LogInformation("Temp media deleted: {FilePath}", safePath);
                }
                else
                {
                    _logger.LogWarning("Temp file not found on disk: {FilePath}", tempMedia.FilePath);
                }

                _context.TempUploads.Remove(tempMedia);
                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting temp media {TempId}", tempId);
                return Problem("Ошибка удаления временного файла");
            }
        }

        // DELETE: api/media/edit/{id} - удаление медиа при редактировании заказа
        [HttpDelete("edit/{id}")]
        public async Task<IActionResult> DeleteMediaDuringEdit(int id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var media = await _context.OrderPhotos
                    .Include(p => p.Order)
                    .FirstOrDefaultAsync(p => p.Id == id);

                if (media == null)
                    return NoContent();

                if (media.Order == null)
                    return BadRequest("Медиа файл не принадлежит заказу");

                var order = media.Order;

                // Проверка прав: админ или владелец заказа
                if (!IsAdminOrHigher() && order.ManagerId != userId)
                {
                    _logger.LogWarning(
                        "Менеджер {UserId} пытается удалить медиа {MediaId} из чужого заказа {OrderId} (владелец: {ManagerId}) - ДОСТУП ЗАПРЕЩЕН",
                        userId, id, order.Id, order.ManagerId);

                    return Forbid("Только владелец заказа или администратор может удалять медиафайлы");
                }

                if (User.Identity?.IsAuthenticated != true)
                    return Unauthorized("Требуется авторизация");

                var safePath = GetSafeFilePath(media.FilePath);
                if (!string.IsNullOrEmpty(safePath) && System.IO.File.Exists(safePath))
                {
                    await Task.Run(() => System.IO.File.Delete(safePath));
                }

                _context.OrderPhotos.Remove(media);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Media {MediaId} deleted during edit by user {UserId}", id, userId);
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting media {MediaId} during edit", id);
                return Problem("Ошибка удаления медиа файла");
            }
        }

        // GET: api/media/types - получение информации о поддерживаемых типах
        [HttpGet("types")]
        public ActionResult GetSupportedTypes()
        {
            return Ok(new
            {
                photo = new
                {
                    maxSize = MaxFileSize,
                    allowedMimeTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" },
                    maxPerOrder = 10
                },
                video = new
                {
                    maxSize = MaxFileSize,
                    allowedMimeTypes = new[] { "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo" },
                    maxPerOrder = 5
                }
            });
        }
    }
}