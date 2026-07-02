using Franchisee.Web.Models.DTOs.Media;
using Franchisee.Web.Models.DTOs.Orders;
using Franchisee.Web.Models.Entities.Orders;

namespace Franchisee.Web.Services.Media.Core
{
    public interface IMediaService
    {
        Task<TempUploadDto?> UploadTempAsync(IFormFile file, int uploaderId, MediaType mediaType, string source = "completion");
        Task<int> CommitTempToOrderAsync(int orderId, List<int> tempIds, int uploaderId, MediaType mediaType);
        Task DeleteMediaFilesAsync(int mediaId);
        Task CleanupExpiredTempsAsync();
        Task<OrderMediaDto?> GetMediaDtoAsync(int mediaId);
        string GetTempPreviewUrl(int tempId);
        string GetMediaUrl(int mediaId, bool isThumb = false);
        Task<int> CommitTempToCompletionAsync(int orderId, List<int> tempIds, int uploaderId);
        Task<bool> DeleteCompletionFolderAsync(int orderId);
        Task<string?> SaveVideoFileAsync(IFormFile file, string fileName, string contentType);
        Task<TempUploadDto?> UploadOriginalAsync(IFormFile file, int uploaderId);
        Task<int> CommitOriginalToOrderAsync(int orderId, List<int> tempIds, int uploaderId);
    }
}