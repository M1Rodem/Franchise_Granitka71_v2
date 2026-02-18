using Franchisee.Web.Models;

namespace Franchisee.Web.Services
{
    public interface IMediaService
    {
        Task<TempUploadDto?> UploadTempAsync(IFormFile file, int uploaderId, MediaType mediaType);
        Task<int> CommitTempToOrderAsync(int orderId, List<int> tempIds, int uploaderId, MediaType mediaType);
        Task DeleteMediaFilesAsync(int mediaId);
        Task CleanupExpiredTempsAsync();
        Task<OrderMediaDto?> GetMediaDtoAsync(int mediaId);
        string GetTempPreviewUrl(int tempId);
        string GetMediaUrl(int mediaId, bool isThumb = false);

        Task<string?> SaveVideoFileAsync(IFormFile file, string fileName, string contentType);
    }
}