using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using System.ComponentModel.DataAnnotations;
using System.IO;
using WebApplication1.Configuration;
using WebApplication1.Models;
using WebApplication1.Services;

namespace WebApplication1.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    [RequestSizeLimit(10 * 1024 * 1024)] // 10MB
    public class PhotosController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IWebHostEnvironment _environment;
        private readonly ILogger<PhotosController> _logger;
        private const long MaxFileSize = 10 * 1024 * 1024;
        private static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png", ".gif" };
        private const int ThumbSize = 150;
        private readonly IPhotoService _photoService;  // ✅ Добавь поле

        public PhotosController(ApplicationDbContext context, IWebHostEnvironment environment, ILogger<PhotosController> logger, IPhotoService photoService)
        {
            _context = context;
            _environment = environment;
            _logger = logger;
            _photoService = photoService;  // ✅ Инжекция
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

        // POST: api/Photos/upload-temp
        [HttpPost("upload-temp")]
        [Consumes("multipart/form-data")]
        public async Task<ActionResult<TempUploadDto>> UploadTemp(IFormFile file) // ✅ Без [FromForm]
        {
            try
            {
                if (file == null || file.Length == 0)
                {
                    _logger.LogWarning("UploadTemp: Файл не предоставлен");
                    return BadRequest("Файл не предоставлен");
                }

                // ✅ Pre-check size (early reject)
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
        public async Task<ActionResult> MoveTempToOrder(int orderId, [FromBody] List<int> tempIds) // ✅ параметр tempIds
        {
            if (tempIds == null || !tempIds.Any())
                return BadRequest("Нет файлов для перемещения");

            var order = await _context.Orders.FirstOrDefaultAsync(o => o.Id == orderId && !o.IsDeleted);
            if (order == null)
                return NotFound("Заказ не найден");

            try
            {
                var uploaderId = int.Parse(User.FindFirst("UserId")?.Value ?? "0");
                var committedCount = await _photoService.CommitTempToOrderAsync(orderId, tempIds, uploaderId); // ✅ используем tempIds

                _logger.LogInformation("Moved {Count} temp photos to order {OrderId}", committedCount, orderId);
                return Ok(new { message = $"Перемещено {committedCount} фото", addedCount = committedCount });
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
                if (photo == null || !System.IO.File.Exists(photo.FilePath))
                    return NotFound("Фото не найдено");

                // Все авторизованные пользователи видят все фото
                if (User.Identity?.IsAuthenticated != true)
                    return Unauthorized("Требуется авторизация");

                var fileBytes = await System.IO.File.ReadAllBytesAsync(photo.FilePath);
                var fileName = photo.OriginalFileName ?? $"photo_{id}{Path.GetExtension(photo.FilePath)}";

                return File(fileBytes, photo.ContentType, fileName);
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
            if (photo == null || !System.IO.File.Exists(photo.FilePath))
                return NotFound("Фото не найдено");

            // ✅ ИСПРАВЛЯЕМ: все менеджеры видят все фото заказов
            // Проверяем, что пользователь имеет доступ к заказу
            var order = await _context.Orders
                .FirstOrDefaultAsync(o => o.Id == photo.OrderId && !o.IsDeleted);

            if (order == null)
                return NotFound("Заказ не найден");

            // Все авторизованные менеджеры видят все заказы и их фото
            if (User.Identity?.IsAuthenticated != true)
                return Unauthorized("Требуется авторизация");

            var contentType = photo.ContentType ?? "image/jpeg";
            return PhysicalFile(photo.FilePath, contentType, enableRangeProcessing: true);
        }

        // GET: api/Photos/proxy/{id} - специальный endpoint для фронтенда
        [HttpGet("proxy/{id}")]
        public async Task<IActionResult> GetPhotoProxy(int id)
        {
            try
            {
                var photo = await _context.OrderPhotos.FindAsync(id);
                if (photo == null || !System.IO.File.Exists(photo.FilePath))
                    return NotFound("Фото не найдено");

                // ✅ Более мягкая проверка авторизации
                if (User.Identity?.IsAuthenticated != true)
                    return Unauthorized("Требуется авторизация");

                // ✅ Проверяем, что заказ существует и пользователь имеет к нему доступ
                var order = await _context.Orders
                    .Include(o => o.Photos)
                    .FirstOrDefaultAsync(o => o.Id == photo.OrderId && !o.IsDeleted);

                if (order == null)
                    return NotFound("Заказ не найден");

                // ✅ Проверяем права доступа к заказу
                var userIdClaim = User.FindFirst("UserId");
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
                    return Unauthorized("Invalid user ID");

                var contentType = photo.ContentType ?? "image/jpeg";
                return PhysicalFile(photo.FilePath, contentType, enableRangeProcessing: true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetPhotoProxy for photo {PhotoId}", id);
                return StatusCode(500, "Ошибка загрузки фото");
            }
        }

        //// DELETE: api/Photos/{id}
        //[HttpDelete("{id}")]
        //public async Task<IActionResult> DeletePhoto(int id)
        //{
        //    try
        //    {
        //        var photo = await _context.OrderPhotos.FindAsync(id);
        //        if (photo == null)
        //            return NoContent();

        //        if (System.IO.File.Exists(photo.FilePath))
        //            await Task.Run(() => System.IO.File.Delete(photo.FilePath));

        //        _context.OrderPhotos.Remove(photo);
        //        await _context.SaveChangesAsync();

        //        _logger.LogInformation("Photo {PhotoId} deleted", id);
        //        return NoContent();
        //    }
        //    catch (Exception ex)
        //    {
        //        _logger.LogError(ex, "Error deleting photo {PhotoId}", id);
        //        return Problem("Ошибка удаления фото");
        //    }
        //}

        // ✅ ДОБАВЛЯЕМ - удаление фото только при редактировании заказа
        [HttpDelete("edit/{id}")]
        public async Task<IActionResult> DeletePhotoDuringEdit(int id)
        {
            try
            {
                var userId = GetCurrentUserId(); // ✅ Теперь метод существует
                var photo = await _context.OrderPhotos.FindAsync(id);

                if (photo == null) return NoContent();

                // ✅ ПРАВИЛО: Любой авторизованный менеджер или админ может удалять
                if (User.Identity?.IsAuthenticated != true) // ✅ Исправлено разыменование
                    return Unauthorized("Требуется авторизация");

                if (System.IO.File.Exists(photo.FilePath))
                    await Task.Run(() => System.IO.File.Delete(photo.FilePath));

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

            if (temp == null) return NotFound("Temp file not found");

            // ✅ ИСПРАВЛЯЕМ: безопасное получение userId
            var userIdClaim = User.FindFirst("UserId");
            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
                return Unauthorized("Invalid user ID");

            if (temp.UploaderId != userId) return Forbid("Access denied");

            if (!System.IO.File.Exists(temp.FilePath)) return NotFound("File not found on disk");

            var contentType = temp.ContentType ?? "application/octet-stream";
            return PhysicalFile(temp.FilePath, contentType, enableRangeProcessing: true);
        }

        // DELETE: api/Photos/temp/{fileName}
        [HttpDelete("temp/{tempId:int}")]
        public async Task<IActionResult> DeleteTempPhoto(int tempId)
        {
            try
            {
                var tempPhoto = await _context.TempUploads
                    .IgnoreQueryFilters() // Чтобы увидеть expired
                    .FirstOrDefaultAsync(t => t.Id == tempId);

                if (tempPhoto == null)
                {
                    _logger.LogInformation("Temp photo not found: {TempId}", tempId);
                    return NoContent(); // Нет ошибки, просто NoContent
                }

                var tempPath = tempPhoto.FilePath; // Используем FilePath из модели
                if (!string.IsNullOrEmpty(tempPath) && System.IO.File.Exists(tempPath))
                {
                    await Task.Run(() => System.IO.File.Delete(tempPath));
                    _logger.LogInformation("Temp photo deleted: {FilePath}", tempPath);
                }
                else
                {
                    _logger.LogWarning("Temp file not found on disk: {FilePath}", tempPath);
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

        // Private thumb gen — 🔥 Sync Load + async Save (fix CS8417)
        private async Task<string?> GenerateThumbnailAsync(string filePath, string thumbPath)
        {
            try
            {
                using var image = Image.Load(filePath); // 🔥 Sync Load, no await using issue
                image.Mutate(x => x.Resize(ThumbSize, ThumbSize));

                await using var outStream = new FileStream(thumbPath, FileMode.Create, FileAccess.Write, FileShare.None, bufferSize: 4096, useAsync: true);
                await image.SaveAsJpegAsync(outStream);

                return thumbPath;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to generate thumb for {FilePath}", filePath);
                return null;
            }
        }
    }
}