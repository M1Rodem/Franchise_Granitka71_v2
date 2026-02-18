using Franchisee.Web.Models;

namespace Franchisee.Web.Services.Repositories
{
    public interface IPlotRepository
    {
        Task<Plot?> GetByIdAsync(int id);
        Task<IEnumerable<Plot>> GetAllAsync(bool includeInactive = false);
        Task AddAsync(Plot plot);
        Task UpdateAsync(Plot plot);
        Task DeleteAsync(int id);
        Task<bool> ExistsAsync(int id);
    }
}