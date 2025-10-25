using WebApplication1.Models;

namespace WebApplication1.Services
{
    public interface IPhotoService
    {
        Task<TempUploadDto?> UploadTempAsync(IFormFile file, int uploaderId);
        Task<int> CommitTempToOrderAsync(int orderId, List<int> tempIds, int uploaderId);
        Task DeletePhotoFilesAsync(int photoId);
        Task CleanupExpiredTempsAsync();  // For background
        Task<OrderPhotoDto?> GetPhotoDtoAsync(int photoId);
        string GetTempPreviewUrl(int tempId);  // For UI
        string GetPhotoUrl(int photoId, bool isThumb = false);  // Proxy paths

    }
}