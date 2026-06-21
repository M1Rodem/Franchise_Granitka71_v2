using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using Franchisee.Web.Configuration;
using Franchisee.Web.Models.Entities.Media;
using Franchisee.Web.Models.Entities.Orders;
using Franchisee.Web.Models.DTOs.Orders;
using Franchisee.Web.Models.DTOs.Media;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using SixLabors.ImageSharp.Formats.Jpeg;
using Serilog;

namespace Franchisee.Web.Services.Media.Core
{
    public class MediaService : IMediaService
    {
        private readonly ApplicationDbContext _context;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<MediaService> _logger;
        private readonly IHttpContextAccessor _httpContextAccessor;
        
        private readonly long _maxFileSize;
        private readonly int _maxPhotosPerOrder;
        private readonly int _maxVideosPerOrder;
        private readonly long _maxVideoSize;
        
        private const int MaxDimension = 4096;
        private const int MaxCompletionPhotos = 3;   // Максимум фото для completion
        private const int MaxCompletionVideos = 1;   // Максимум видео для completion

        private static readonly string[] AllowedImageMimeTypes = {
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp"
        };

        private static readonly string[] AllowedVideoMimeTypes = {
            "video/mp4",
            "video/webm",
            "video/quicktime",
            "video/x-msvideo"
        };

        private static readonly Dictionary<string, string> MimeToExt = new()
        {
            { "image/jpeg", ".jpg" },
            { "image/png", ".png" },
            { "image/gif", ".gif" },
            { "image/webp", ".webp" },
            { "video/mp4", ".mp4" },
            { "video/webm", ".webm" },
            { "video/quicktime", ".mov" },
            { "video/x-msvideo", ".avi" }
        };

        public MediaService(
            ApplicationDbContext context,
            IWebHostEnvironment env,
            ILogger<MediaService> logger,
            IHttpContextAccessor httpContextAccessor,
            IConfiguration configuration)
        {
            _context = context;
            _env = env;
            _logger = logger;
            _httpContextAccessor = httpContextAccessor;
            
            _maxFileSize = configuration.GetValue<long>("Media:MaxFileSize", 500 * 1024 * 1024);
            _maxPhotosPerOrder = configuration.GetValue<int>("Media:MaxPhotosPerOrder", 5);
            _maxVideosPerOrder = configuration.GetValue<int>("Media:MaxVideosPerOrder", 4);
            _maxVideoSize = configuration.GetValue<long>("Media:MaxVideoSize", 100 * 1024 * 1024);
            
            Log.Information("MediaService configured: MaxFileSize={MaxFileSize}, MaxPhotos={MaxPhotos}, MaxVideos={MaxVideos}, MaxVideoSize={MaxVideoSize}",
                _maxFileSize, _maxPhotosPerOrder, _maxVideosPerOrder, _maxVideoSize);
        }

        public async Task<TempUploadDto?> UploadTempAsync(IFormFile file, int uploaderId, MediaType mediaType, string source = "completion")
        {
            _logger.LogInformation("UploadTempAsync: Файл получен - Имя: {Name}, Размер: {Size}B, Тип: {Type}, MediaType: {MediaType}",
                file?.FileName ?? "null", file?.Length ?? 0, file?.ContentType ?? "null", mediaType);

            if (file == null || file.Length == 0 || file.Length > _maxFileSize)
            {
                _logger.LogWarning("UploadTempAsync: Файл null/пустой или слишком большой ({Size} > {Max}B)",
                    file?.Length ?? 0, _maxFileSize);
                return null;
            }

            var fileContentType = file.ContentType?.ToLowerInvariant() ?? "";
            string[] allowedTypes = mediaType == MediaType.Photo ? AllowedImageMimeTypes : AllowedVideoMimeTypes;

            if (!allowedTypes.Contains(fileContentType))
            {
                _logger.LogWarning("UploadTempAsync: Invalid MIME type '{Type}' for {Name}", 
                    fileContentType, file.FileName);
                return null;
            }

            var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
            var allowedExtensions = mediaType == MediaType.Photo 
                ? new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" }
                : new[] { ".mp4", ".webm", ".mov", ".avi" };

            if (!allowedExtensions.Contains(fileExtension))
            {
                _logger.LogWarning("UploadTempAsync: Invalid file extension '{Ext}' for {Name}", 
                    fileExtension, file.FileName);
                return null;
            }

            // Для фото обрабатываем изображения, для видео просто сохраняем файл
            if (mediaType == MediaType.Photo)
            {
                return await ProcessImageUploadAsync(file, uploaderId, fileContentType, source);
            }
            else
            {
                return await ProcessVideoUploadAsync(file, uploaderId, fileContentType, source);
            }
        }

        /// <summary>
        /// Переместить временные файлы в папку completion заказа
        /// </summary>
        public async Task<int> CommitTempToCompletionAsync(int orderId, List<int> tempIds, int uploaderId)
        {
            _logger.LogInformation(
                "CommitTempToCompletionAsync: OrderId={OrderId}, TempIdsCount={Count}, UploaderId={UploaderId}",
                orderId, tempIds.Count, uploaderId);

            // 1. Получаем заказ
            var order = await _context.Orders
                .Include(o => o.Photos)
                .FirstOrDefaultAsync(o => o.Id == orderId);

            if (order == null)
            {
                _logger.LogWarning("CommitTempToCompletionAsync: заказ {OrderId} не найден", orderId);
                return 0;
            }

            // 2. Получаем временные файлы, принадлежащие загрузившему пользователю
            var temps = await _context.TempUploads
                .Where(t => tempIds.Contains(t.Id) && t.UploaderId == uploaderId)
                .ToListAsync();

            if (!temps.Any())
            {
                _logger.LogWarning("CommitTempToCompletionAsync: временные файлы не найдены для OrderId={OrderId}", orderId);
                return 0;
            }

            // 3. Проверяем лимиты для completion
            var photoCount = temps.Count(t => t.MediaType == MediaType.Photo);
            var videoCount = temps.Count(t => t.MediaType == MediaType.Video);

            if (photoCount > MaxCompletionPhotos)
            {
                _logger.LogWarning("CommitTempToCompletionAsync: превышен лимит фото ({Current} > {Max})",
                    photoCount, MaxCompletionPhotos);
                return 0;
            }

            if (videoCount > MaxCompletionVideos)
            {
                _logger.LogWarning("CommitTempToCompletionAsync: превышен лимит видео ({Current} > {Max})",
                    videoCount, MaxCompletionVideos);
                return 0;
            }

            var committed = 0;

            foreach (var temp in temps)
            {
                try
                {
                    // 4. Создаём папку completion/photo или completion/video
                    var completionDir = Path.Combine(
                        _env.WebRootPath,
                        "uploads",
                        "orders",
                        orderId.ToString(),
                        "completion",
                        temp.MediaType == MediaType.Photo ? "photo" : "video");

                    Directory.CreateDirectory(completionDir);

                    // 5. Генерируем новое имя файла
                    var ext = Path.GetExtension(temp.OriginalFileName ?? "")?.ToLowerInvariant();
                    if (string.IsNullOrEmpty(ext))
                    {
                        ext = temp.MediaType == MediaType.Photo ? ".jpg" : ".mp4";
                    }

                    var newFileName = $"{Guid.NewGuid():N}{ext}";
                    var newPath = Path.Combine(completionDir, newFileName);

                    // 6. Перемещаем файл (копируем + удаляем оригинал, т.к. может быть на разных дисках)
                    if (File.Exists(temp.FilePath))
                    {
                        // Копируем в новое место
                        using (var sourceStream = new FileStream(temp.FilePath, FileMode.Open, FileAccess.Read))
                        using (var destStream = new FileStream(newPath, FileMode.Create, FileAccess.Write))
                        {
                            await sourceStream.CopyToAsync(destStream);
                        }

                        // Удаляем оригинал
                        File.Delete(temp.FilePath);
                    }
                    else
                    {
                        _logger.LogWarning("CommitTempToCompletionAsync: временный файл не найден {FilePath}", temp.FilePath);
                        continue;
                    }

                    // 7. Создаём запись OrderMedia
                    var media = new OrderMedia
                    {
                        OrderId = orderId,
                        FilePath = newPath,
                        ContentType = temp.ContentType,
                        Checksum = temp.Checksum,
                        Width = temp.Width,
                        Height = temp.Height,
                        OriginalFileName = temp.OriginalFileName ?? "unknown",
                        Size = temp.Size,
                        MediaType = temp.MediaType,
                        UploaderId = uploaderId,
                        UploadedAt = DateTime.UtcNow,
                        IsCompletionMedia = true
                    };

                    _context.OrderPhotos.Add(media);

                    // 8. Удаляем временную запись
                    _context.TempUploads.Remove(temp);

                    committed++;
                    _logger.LogDebug(
                        "CommitTempToCompletionAsync: перемещён файл {TempId} -> {NewPath}, Type={MediaType}",
                        temp.Id, newPath, temp.MediaType);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "CommitTempToCompletionAsync: ошибка при перемещении файла {TempId}", temp.Id);
                }
            }

            if (committed > 0)
            {
                await _context.SaveChangesAsync();
                _logger.LogInformation(
                    "CommitTempToCompletionAsync: перемещено {Count} файлов для заказа {OrderId}",
                    committed, orderId);
            }

            return committed;
        }

        public async Task<bool> DeleteCompletionFolderAsync(int orderId)
        {
            var completionDir = Path.Combine(_env.WebRootPath, "uploads", "orders", orderId.ToString(), "completion");

            if (!Directory.Exists(completionDir))
            {
                _logger.LogDebug("DeleteCompletionFolderAsync: папка не существует {Path}", completionDir);
                return false;
            }

            try
            {
                // Удаляем все файлы из OrderMedia, связанные с completion папкой
                var completionMedia = await _context.OrderPhotos
                    .Where(m => m.OrderId == orderId && m.FilePath.Contains("/completion/"))
                    .ToListAsync();

                if (completionMedia.Any())
                {
                    _context.OrderPhotos.RemoveRange(completionMedia);
                    await _context.SaveChangesAsync();
                }

                // Удаляем физическую папку
                Directory.Delete(completionDir, true);

                _logger.LogInformation("DeleteCompletionFolderAsync: удалена папка {Path}", completionDir);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "DeleteCompletionFolderAsync: ошибка при удалении папки {Path}", completionDir);
                return false;
            }
        }

        private async Task<TempUploadDto?> ProcessImageUploadAsync(
            IFormFile file,
            int uploaderId,
            string contentType,
            string source = "completion")
        {
            using var tempStream = file.OpenReadStream();

            try
            {
                using var image = await Image.LoadAsync(tempStream);

                var originalWidth = image.Width;
                var originalHeight = image.Height;

                _logger.LogInformation(
                    "Image loaded: {W}x{H}, Size: {Size}B",
                    originalWidth,
                    originalHeight,
                    file.Length
                );

                const int maxSize = 1920;

                if (image.Width > maxSize || image.Height > maxSize)
                {
                    var ratio = Math.Min(
                        (double)maxSize / image.Width,
                        (double)maxSize / image.Height
                    );

                    var newWidth = (int)(image.Width * ratio);
                    var newHeight = (int)(image.Height * ratio);

                    image.Mutate(x => x.Resize(newWidth, newHeight));

                    _logger.LogInformation(
                        "Image resized: {OldW}x{OldH} → {NewW}x{NewH}",
                        originalWidth,
                        originalHeight,
                        newWidth,
                        newHeight
                    );
                }

                int quality;

                if (file.Length > 10_000_000) // >10MB
                    quality = 65;
                else if (file.Length > 5_000_000)
                    quality = 70;
                else if (file.Length > 2_000_000)
                    quality = 75;
                else
                    quality = 80;

                var fileName = $"{Guid.NewGuid():N}.jpg";
                var tempDir = Path.Combine(_env.WebRootPath, "uploads", "temp");
                Directory.CreateDirectory(tempDir);

                var filePath = Path.Combine(tempDir, fileName);

                long savedSize;

                await using (var outStream = new FileStream(filePath, FileMode.Create))
                {
                    await image.SaveAsJpegAsync(outStream, new JpegEncoder
                    {
                        Quality = quality
                    });

                    savedSize = outStream.Length;
                }

                tempStream.Position = 0;
                var checksum = await ComputeSha256Async(tempStream);

                TimeSpan ttl;
                if (source == "offline")
                {
                    ttl = TimeSpan.FromHours(1);   // 1 час для оффлайн
                }
                else
                {
                    ttl = TimeSpan.FromDays(20);   // 20 дней для completion
                }

                var tempUpload = new TempUpload
                {
                    FilePath = filePath,
                    ContentType = "image/jpeg",
                    Checksum = checksum,
                    Width = image.Width,
                    Height = image.Height,
                    OriginalFileName = file.FileName,
                    Size = savedSize,
                    MediaType = MediaType.Photo,
                    UploaderId = uploaderId,
                    UploadedAt = DateTime.UtcNow,
                    ExpiresAt = DateTime.UtcNow.Add(ttl)  // ← изменено
                };

                _context.TempUploads.Add(tempUpload);
                await _context.SaveChangesAsync();

                _logger.LogInformation(
                    "Temp image saved: {Id}, Size: {Size}B (original: {Original}B)",
                    tempUpload.Id,
                    savedSize,
                    file.Length
                );

                return new TempUploadDto
                {
                    Id = tempUpload.Id,
                    OriginalFileName = tempUpload.OriginalFileName,
                    Size = tempUpload.Size,
                    PreviewUrl = $"/api/Media/temp-preview/{tempUpload.Id}",
                    Width = tempUpload.Width ?? 0,
                    Height = tempUpload.Height ?? 0
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "ProcessImageUploadAsync error: {File} - {Message}",
                    file.FileName,
                    ex.Message
                );

                return null;
            }
        }

        private async Task<TempUploadDto?> ProcessVideoUploadAsync(
            IFormFile file,
            int uploaderId,
            string contentType,
            string source = "completion")
        {
            if (file.Length > _maxVideoSize)
            {
                _logger.LogWarning("Video too large: {Size}", file.Length);
                return null;
            }

            var ext = MimeToExt.GetValueOrDefault(contentType, ".mp4");
            if (string.IsNullOrEmpty(ext))
                ext = ".mp4";

            var fileName = $"{Guid.NewGuid():N}{ext}";
            var tempDir = Path.Combine(_env.WebRootPath, "uploads", "temp", "videos");
            Directory.CreateDirectory(tempDir);

            var filePath = Path.Combine(tempDir, fileName);

            try
            {
                await using (var fileStream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(fileStream);
                    await fileStream.FlushAsync();
                }

                await using var readStream = new FileStream(filePath, FileMode.Open, FileAccess.Read);
                var checksum = await ComputeSha256Async(readStream);

                _logger.LogInformation(
                    "Video uploaded: {SizeMB} MB",
                    Math.Round(file.Length / 1024.0 / 1024.0, 2)
                );

                TimeSpan ttl;
                if (source == "offline")
                {
                    ttl = TimeSpan.FromHours(1);   // 1 час для оффлайн
                }
                else
                {
                    ttl = TimeSpan.FromDays(20);   // 20 дней для completion
                }

                var tempUpload = new TempUpload
                {
                    FilePath = filePath,
                    ContentType = contentType,
                    Checksum = checksum,
                    Width = null,
                    Height = null,
                    OriginalFileName = file.FileName,
                    Size = file.Length,
                    MediaType = MediaType.Video,
                    UploaderId = uploaderId,
                    UploadedAt = DateTime.UtcNow,
                    ExpiresAt = DateTime.UtcNow.Add(ttl)  // ← изменено
                };


                _context.TempUploads.Add(tempUpload);
                await _context.SaveChangesAsync();

                return new TempUploadDto
                {
                    Id = tempUpload.Id,
                    OriginalFileName = tempUpload.OriginalFileName,
                    Size = tempUpload.Size,
                    PreviewUrl = BuildAbsoluteUrl($"/api/media/temp-preview/{tempUpload.Id}"),
                    Width = 0,
                    Height = 0
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "ProcessVideoUploadAsync error: {File} - {Message}",
                    file.FileName,
                    ex.Message
                );

                if (File.Exists(filePath))
                    File.Delete(filePath);

                return null;
            }
        }

        public async Task<int> CommitTempToOrderAsync(int orderId, List<int> tempIds, int uploaderId, MediaType mediaType)
        {
            var committed = 0;
            var order = await _context.Orders.FindAsync(orderId);
            if (order == null)
            {
                _logger.LogWarning("CommitTempToOrderAsync: заказ {Id} не найден", orderId);
                return 0;
            }

            // Проверяем лимиты в зависимости от типа медиа
            if (mediaType == MediaType.Photo && order.Photos.Count(p => p.MediaType == MediaType.Photo) + tempIds.Count > _maxPhotosPerOrder)
            {
                _logger.LogWarning("CommitTempToOrderAsync: превышен лимит фото для заказа {Id}", orderId);
                return 0;
            }

            if (mediaType == MediaType.Video && order.Photos.Count(p => p.MediaType == MediaType.Video) + tempIds.Count > _maxVideosPerOrder)
            {
                _logger.LogWarning("CommitTempToOrderAsync: превышен лимит видео для заказа {Id}", orderId);
                return 0;
            }

            var temps = await _context.TempUploads
                .Where(t => tempIds.Contains(t.Id) && t.UploaderId == uploaderId && t.MediaType == mediaType)
                .ToListAsync();

            foreach (var temp in temps)
            {
                var orderDir = Path.Combine(_env.WebRootPath, "uploads", "orders", orderId.ToString(), mediaType.ToString().ToLower());
                Directory.CreateDirectory(orderDir);

                var ext = Path.GetExtension(temp.OriginalFileName ?? "")?.ToLowerInvariant()
                    ?? MimeToExt.GetValueOrDefault(temp.ContentType, mediaType == MediaType.Photo ? ".jpg" : ".mp4");

                var newName = $"{Guid.NewGuid():N}{ext}";
                var newPath = Path.Combine(orderDir, newName);

                System.IO.File.Move(temp.FilePath, newPath);

                var media = new OrderMedia
                {
                    OrderId = orderId,
                    FilePath = newPath,
                    ContentType = temp.ContentType,
                    Checksum = temp.Checksum,
                    Width = temp.Width,
                    Height = temp.Height,
                    OriginalFileName = temp.OriginalFileName ?? "unknown",
                    Size = temp.Size,
                    MediaType = mediaType,
                    UploaderId = uploaderId,
                    UploadedAt = DateTime.UtcNow
                };

                _context.OrderPhotos.Add(media);
                _context.TempUploads.Remove(temp);
                committed++;
            }

            await _context.SaveChangesAsync();
            return committed;
        }

        public async Task DeleteMediaFilesAsync(int mediaId)
        {
            var media = await _context.OrderPhotos.FindAsync(mediaId);
            if (media == null) return;

            if (File.Exists(media.FilePath)) File.Delete(media.FilePath);

            _context.OrderPhotos.Remove(media);
            await _context.SaveChangesAsync();
        }

        public async Task<OrderMediaDto?> GetMediaDtoAsync(int mediaId)
        {
            var media = await _context.OrderPhotos.FindAsync(mediaId);
            if (media == null) return null;

            return new OrderMediaDto
            {
                Id = media.Id,
                Url = $"/api/Media/{media.Id}/file",
                OriginalFileName = media.OriginalFileName,
                Size = media.Size,
                UploadedAt = media.UploadedAt,
                Width = media.Width ?? 0,
                Height = media.Height ?? 0,
                MediaType = media.MediaType
            };
        }

        public async Task CleanupExpiredTempsAsync()
        {
            var expired = await _context.TempUploads
                .IgnoreQueryFilters()
                .Where(t => t.ExpiresAt <= DateTime.UtcNow)
                .ToListAsync();

            foreach (var temp in expired)
            {
                if (File.Exists(temp.FilePath)) File.Delete(temp.FilePath);
                _context.TempUploads.Remove(temp);
            }

            if (expired.Any()) await _context.SaveChangesAsync();
            _logger.LogInformation("Очищено {Count} просроченных временных файлов", expired.Count);
        }

        public string GetTempPreviewUrl(int tempId) => $"/api/media/temp-preview/{tempId}";
        public string GetMediaUrl(int mediaId, bool isThumb = false) => $"/api/media/{mediaId}/file";

        public async Task<string?> SaveVideoFileAsync(IFormFile file, string fileName, string contentType)
        {
            try
            {
                var uploadsDir = Path.Combine(_env.WebRootPath, "uploads", "videos");
                Directory.CreateDirectory(uploadsDir);

                var filePath = Path.Combine(uploadsDir, fileName);

                await using var stream = new FileStream(filePath, FileMode.Create);
                await file.CopyToAsync(stream);

                return filePath;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка сохранения видео файла {FileName}", fileName);
                return null;
            }
        }

        private static async Task<string> ComputeSha256Async(Stream stream)
        {
            using var sha = SHA256.Create();
            stream.Position = 0;
            var hash = await sha.ComputeHashAsync(stream);
            return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
        }

        private string BuildAbsoluteUrl(string relativePath)
        {
            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext == null)
                throw new InvalidOperationException("HttpContext is not available");

            var request = httpContext.Request;
            return $"{request.Scheme}://{request.Host}{relativePath}";
        }
    }
}