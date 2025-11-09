using Franchisee.Web.Models;

namespace Franchisee.Web.Services
{
    public interface IPhotoService
    {
        Task<TempUploadDto?> UploadTempAsync(IFormFile file, int uploaderId);
        Task<int> CommitTempToOrderAsync(int orderId, List<int> tempIds, int uploaderId);
        Task DeletePhotoFilesAsync(int photoId);
        Task CleanupExpiredTempsAsync();
        Task<OrderPhotoDto?> GetPhotoDtoAsync(int photoId);
        string GetTempPreviewUrl(int tempId); 
        string GetPhotoUrl(int photoId, bool isThumb = false);

    }
}