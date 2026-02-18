using Microsoft.EntityFrameworkCore;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;
using System.Security.Cryptography;
using Franchisee.Web.Configuration;
using Franchisee.Web.Models;

namespace Franchisee.Web.Services
{
    public class MediaService : IMediaService
    {
        private readonly ApplicationDbContext _context;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<MediaService> _logger;

        // Увеличиваем лимит до 500 МБ
        private const long MaxFileSize = 500 * 1024 * 1024;
        private const int MaxPhotosPerOrder = 10;
        private const int MaxVideosPerOrder = 5; // Новый лимит для видео
        private const int MaxDimension = 4096;

        private static readonly string[] AllowedImageMimeTypes = {
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp"
        };

        // Новые MIME-типы для видео
        private static readonly string[] AllowedVideoMimeTypes = {
            "video/mp4",
            "video/webm",
            "video/quicktime", // mov
            "video/x-msvideo"  // avi
        };

        private static readonly Dictionary<string, string> MimeToExt = new()
        {
            // Изображения
            { "image/jpeg", ".jpg" },
            { "image/png", ".png" },
            { "image/gif", ".gif" },
            { "image/webp", ".webp" },
            // Видео
            { "video/mp4", ".mp4" },
            { "video/webm", ".webm" },
            { "video/quicktime", ".mov" },
            { "video/x-msvideo", ".avi" }
        };

        public MediaService(ApplicationDbContext context, IWebHostEnvironment env, ILogger<MediaService> logger)
        {
            _context = context;
            _env = env;
            _logger = logger;
        }

        public async Task<TempUploadDto?> UploadTempAsync(IFormFile file, int uploaderId, MediaType mediaType)
        {
            _logger.LogInformation("UploadTempAsync: Файл получен - Имя: {Name}, Размер: {Size}B, Тип: {Type}, MediaType: {MediaType}",
                file?.FileName ?? "null", file?.Length ?? 0, file?.ContentType ?? "null", mediaType);

            if (file == null || file.Length == 0 || file.Length > MaxFileSize)
            {
                _logger.LogWarning("UploadTempAsync: Файл null/пустой или слишком большой ({Size} > {Max}B)",
                    file?.Length ?? 0, MaxFileSize);
                return null;
            }

            var fileContentType = file.ContentType?.ToLowerInvariant() ?? "";
            string[] allowedTypes = mediaType == MediaType.Photo ? AllowedImageMimeTypes : AllowedVideoMimeTypes;

            if (!allowedTypes.Contains(fileContentType))
            {
                _logger.LogWarning("UploadTempAsync: Неверный MIME '{Type}' для {Name} (не в {Allowed})",
                    fileContentType, file.FileName, string.Join(", ", allowedTypes));
                return null;
            }

            // Для фото обрабатываем изображения, для видео просто сохраняем файл
            if (mediaType == MediaType.Photo)
            {
                return await ProcessImageUploadAsync(file, uploaderId, fileContentType);
            }
            else
            {
                return await ProcessVideoUploadAsync(file, uploaderId, fileContentType);
            }
        }

        private async Task<TempUploadDto?> ProcessImageUploadAsync(IFormFile file, int uploaderId, string contentType)
        {
            using var tempStream = file.OpenReadStream();
            try
            {
                using var image = await Image.LoadAsync(tempStream);
                var size = image.Size;
                _logger.LogInformation("ProcessImageUploadAsync: Изображение загружено - Размеры: {W}x{H}", size.Width, size.Height);

                if (size.Width > MaxDimension || size.Height > MaxDimension)
                {
                    _logger.LogWarning("ProcessImageUploadAsync: Размеры слишком большие {W}x{H} > {Max} для {Name}",
                        size.Width, size.Height, MaxDimension, file.FileName);
                    return null;
                }

                var decodedFormat = image.Metadata.DecodedImageFormat?.Name?.ToLowerInvariant() ?? "";
                var finalContentType = !string.IsNullOrEmpty(decodedFormat) ? $"image/{decodedFormat}" : contentType;

                if (!AllowedImageMimeTypes.Contains(finalContentType))
                {
                    _logger.LogWarning("ProcessImageUploadAsync: Неверный декодированный тип «{Decoded}» для {Name}", finalContentType, file.FileName);
                    return null;
                }

                var ext = MimeToExt.GetValueOrDefault(finalContentType, ".jpg");
                var fileName = $"{Guid.NewGuid():N}{ext}";
                var tempDir = Path.Combine(_env.WebRootPath, "uploads", "temp");
                Directory.CreateDirectory(tempDir);
                var filePath = Path.Combine(tempDir, fileName);
                long savedSize = 0;

                await using (var outStream = new FileStream(filePath, FileMode.Create))
                {
                    await image.SaveAsJpegAsync(outStream, new JpegEncoder { Quality = 85 });
                    savedSize = outStream.Length;
                }

                tempStream.Position = 0;
                var checksum = await ComputeSha256Async(tempStream);

                var tempUpload = new TempUpload
                {
                    FilePath = filePath,
                    ContentType = finalContentType,
                    Checksum = checksum,
                    Width = size.Width,
                    Height = size.Height,
                    OriginalFileName = file.FileName,
                    Size = savedSize,
                    MediaType = MediaType.Photo,
                    UploaderId = uploaderId,
                    UploadedAt = DateTime.UtcNow,
                    ExpiresAt = DateTime.UtcNow.AddHours(1)
                };

                _context.TempUploads.Add(tempUpload);
                await _context.SaveChangesAsync();

                _logger.LogInformation("ProcessImageUploadAsync: временная загрузка {Id} создана для пользователя {UserId}, путь: {Path}",
                    tempUpload.Id, uploaderId, filePath);

                return new TempUploadDto
                {
                    Id = tempUpload.Id,
                    OriginalFileName = tempUpload.OriginalFileName,
                    Size = tempUpload.Size,
                    PreviewUrl = $"/api/media/temp-preview/{tempUpload.Id}",
                    Width = tempUpload.Width ?? 0,
                    Height = tempUpload.Height ?? 0
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ProcessImageUploadAsync: Ошибка обработки файла {Name}: {Message}", file.FileName, ex.Message);
                return null;
            }
        }

        private async Task<TempUploadDto?> ProcessVideoUploadAsync(IFormFile file, int uploaderId, string contentType)
        {
            var ext = MimeToExt.GetValueOrDefault(contentType, ".mp4");
            var fileName = $"{Guid.NewGuid():N}{ext}";
            var tempDir = Path.Combine(_env.WebRootPath, "uploads", "temp", "videos");
            Directory.CreateDirectory(tempDir);
            var filePath = Path.Combine(tempDir, fileName);

            try
            {
                await using var fileStream = new FileStream(filePath, FileMode.Create);
                await file.CopyToAsync(fileStream);

                var checksum = await ComputeSha256Async(fileStream);

                var tempUpload = new TempUpload
                {
                    FilePath = filePath,
                    ContentType = contentType,
                    Checksum = checksum,
                    Width = null, // Для видео не определяем размеры
                    Height = null,
                    OriginalFileName = file.FileName,
                    Size = file.Length,
                    MediaType = MediaType.Video,
                    UploaderId = uploaderId,
                    UploadedAt = DateTime.UtcNow,
                    ExpiresAt = DateTime.UtcNow.AddHours(1)
                };

                _context.TempUploads.Add(tempUpload);
                await _context.SaveChangesAsync();

                _logger.LogInformation("ProcessVideoUploadAsync: временная загрузка видео {Id} создана для пользователя {UserId}, путь: {Path}",
                    tempUpload.Id, uploaderId, filePath);

                return new TempUploadDto
                {
                    Id = tempUpload.Id,
                    OriginalFileName = tempUpload.OriginalFileName,
                    Size = tempUpload.Size,
                    PreviewUrl = $"/api/media/temp-preview/{tempUpload.Id}",
                    Width = 0,
                    Height = 0
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ProcessVideoUploadAsync: Ошибка сохранения видео {Name}: {Message}", file.FileName, ex.Message);

                // Удаляем файл если он был создан
                if (File.Exists(filePath))
                {
                    File.Delete(filePath);
                }

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
            if (mediaType == MediaType.Photo && order.Photos.Count(p => p.MediaType == MediaType.Photo) + tempIds.Count > MaxPhotosPerOrder)
            {
                _logger.LogWarning("CommitTempToOrderAsync: превышен лимит фото для заказа {Id}", orderId);
                return 0;
            }

            if (mediaType == MediaType.Video && order.Photos.Count(p => p.MediaType == MediaType.Video) + tempIds.Count > MaxVideosPerOrder)
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
                Url = $"/api/media/{media.Id}/file",
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
    }
}