using Franchisee.Web.Models.Entities.Plots;

namespace Franchisee.Web.Services.Plots.Repositories
{
    public interface IPlotRepository
    {
        Task<Plot?> GetByIdAsync(int id);
        Task<(IEnumerable<Plot> Items, int Total)> GetAllAsync(
            bool includeInactive,
            string? search,
            int page,
            int pageSize
        );
        Task AddAsync(Plot plot);
        Task UpdateAsync(Plot plot);
        Task DeleteAsync(int id);
        Task<bool> ExistsAsync(int id);
    }
}