using Microsoft.EntityFrameworkCore;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;
using System.Security.Cryptography;
using WebApplication1.Configuration;
using WebApplication1.Models;

namespace WebApplication1.Services
{
    public class PhotoService : IPhotoService
    {
        private readonly ApplicationDbContext _context;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<PhotoService> _logger;
        private const long MaxFileSize = 10 * 1024 * 1024;
        private const int MaxPhotosPerOrder = 10;
        private const int MaxDimension = 4096;
        private static readonly string[] AllowedMimeTypes = { "image/jpeg", "image/png", "image/gif", "image/webp" };
        private static readonly Dictionary<string, string> MimeToExt = new()
        {
            { "image/jpeg", ".jpg" }, { "image/png", ".png" }, { "image/gif", ".gif" }, { "image/webp", ".webp" }
        };

        public PhotoService(ApplicationDbContext context, IWebHostEnvironment env, ILogger<PhotoService> logger)
        {
            _context = context;
            _env = env;
            _logger = logger;
        }

        public async Task<TempUploadDto?> UploadTempAsync(IFormFile file, int uploaderId)
        {
            _logger.LogInformation("UploadTempAsync: Файл получен - Имя: {Name}, Размер: {Size}B, Тип: {Type}",
                file?.FileName ?? "null", file?.Length ?? 0, file?.ContentType ?? "null");

            if (file == null || file.Length == 0 || file.Length > MaxFileSize)
            {
                _logger.LogWarning("UploadTempAsync: Файл null/пустой или слишком большой ({Size} > {Max}B)",
                    file?.Length ?? 0, MaxFileSize);
                return null;
            }

            var fileContentType = file.ContentType?.ToLowerInvariant() ?? "";
            if (!AllowedMimeTypes.Contains(fileContentType))
            {
                _logger.LogWarning("UploadTempAsync: Неверный MIME '{Type}' для {Name} (не в {Allowed})",
                    fileContentType, file.FileName, string.Join(", ", AllowedMimeTypes));
                return null;
            }

            using var tempStream = file.OpenReadStream();
            try
            {
                using var image = await Image.LoadAsync(tempStream);
                var size = image.Size;
                _logger.LogInformation("UploadTempAsync: Изображение загружено - Размеры: {W}x{H}", size.Width, size.Height);

                if (size.Width > MaxDimension || size.Height > MaxDimension)
                {
                    _logger.LogWarning("UploadTempAsync: Размеры слишком большие {W}x{H} > {Max} для {Name}",
                        size.Width, size.Height, MaxDimension, file.FileName);
                    return null;
                }

                var decodedFormat = image.Metadata.DecodedImageFormat?.Name?.ToLowerInvariant() ?? "";
                var contentType = !string.IsNullOrEmpty(decodedFormat) ? $"image/{decodedFormat}" : fileContentType;
                if (!AllowedMimeTypes.Contains(contentType))
                {
                    _logger.LogWarning("UploadTempAsync: Неверный декодированный тип «{Decoded}» для {Name}", contentType, file.FileName);
                    return null;
                }

                var ext = MimeToExt.GetValueOrDefault(contentType, ".jpg");
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
                    ContentType = contentType,
                    Checksum = checksum,
                    Width = size.Width,
                    Height = size.Height,
                    OriginalFileName = file.FileName,
                    Size = savedSize,
                    UploaderId = uploaderId,
                    UploadedAt = DateTime.UtcNow,
                    ExpiresAt = DateTime.UtcNow.AddHours(1)
                };
                _context.TempUploads.Add(tempUpload);
                await _context.SaveChangesAsync();
                _logger.LogInformation("UploadTempAsync: временная загрузка {Id} создана для пользователя {UserId}, путь: {Path}",
                    tempUpload.Id, uploaderId, filePath);

                return new TempUploadDto
                {
                    Id = tempUpload.Id,
                    OriginalFileName = tempUpload.OriginalFileName,
                    Size = tempUpload.Size,
                    PreviewUrl = $"/api/photos/temp-preview/{tempUpload.Id}",
                    Width = tempUpload.Width ?? 0,
                    Height = tempUpload.Height ?? 0
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "UploadTempAsync: Ошибка обработки файла {Name}: {Message}", file.FileName, ex.Message);
                return null;
            }
        }

        public async Task<int> CommitTempToOrderAsync(int orderId, List<int> tempIds, int uploaderId)
        {
            var committed = 0;
            var order = await _context.Orders.FindAsync(orderId);
            if (order == null || order.Photos.Count >= MaxPhotosPerOrder)
            {
                _logger.LogWarning("Фиксация: заказ null или ограничение {Max} для {Id}", MaxPhotosPerOrder, orderId);
                return 0;
            }

            var temps = await _context.TempUploads.Where(t => tempIds.Contains(t.Id) && t.UploaderId == uploaderId).ToListAsync();

            foreach (var temp in temps)
            {
                var orderDir = Path.Combine(_env.WebRootPath, "uploads", "orders", orderId.ToString());
                Directory.CreateDirectory(orderDir);
                var ext = Path.GetExtension(temp.OriginalFileName ?? "")?.ToLowerInvariant() ?? ".jpg";
                var newName = $"{Guid.NewGuid():N}{ext}";
                var newPath = Path.Combine(orderDir, newName);

                System.IO.File.Move(temp.FilePath, newPath);

                var photo = new OrderPhoto
                {
                    OrderId = orderId,
                    FilePath = newPath,
                    ContentType = temp.ContentType,
                    Checksum = temp.Checksum,
                    Width = temp.Width,
                    Height = temp.Height,
                    OriginalFileName = temp.OriginalFileName ?? "unknown.jpg",
                    Size = temp.Size,
                    UploaderId = uploaderId,
                    UploadedAt = DateTime.UtcNow
                };

                _context.OrderPhotos.Add(photo);
                _context.TempUploads.Remove(temp);
                committed++;
            }

            await _context.SaveChangesAsync();
            return committed;
        }

        public async Task DeletePhotoFilesAsync(int photoId)
        {
            var photo = await _context.OrderPhotos.FindAsync(photoId);
            if (photo == null) return;

            if (File.Exists(photo.FilePath)) File.Delete(photo.FilePath);

            _context.OrderPhotos.Remove(photo);
            await _context.SaveChangesAsync();
        }

        public async Task<Models.OrderPhotoDto?> GetPhotoDtoAsync(int photoId)
        {
            var photo = await _context.OrderPhotos.FindAsync(photoId);
            if (photo == null) return null;

            return new Models.OrderPhotoDto
            {
                Id = photo.Id,
                Url = $"/api/photos/{photo.Id}/file",
                OriginalFileName = photo.OriginalFileName,
                Size = photo.Size,
                UploadedAt = photo.UploadedAt,
                Width = photo.Width ?? 0,
                Height = photo.Height ?? 0
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

        public string GetTempPreviewUrl(int tempId) => $"/api/photos/temp-preview/{tempId}";
        public string GetPhotoUrl(int photoId, bool isThumb = false) => $"/api/photos/{photoId}/file";

        private static async Task<string> ComputeSha256Async(Stream stream)
        {
            using var sha = SHA256.Create();
            stream.Position = 0;
            var hash = await sha.ComputeHashAsync(stream);
            return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
        }
    }
}