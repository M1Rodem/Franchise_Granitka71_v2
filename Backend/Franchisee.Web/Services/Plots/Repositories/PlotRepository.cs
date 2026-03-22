using Microsoft.EntityFrameworkCore;
using Franchisee.Web.Configuration;
using Franchisee.Web.Models.Entities.Plots;

namespace Franchisee.Web.Services.Plots.Repositories
{
    public class PlotRepository : IPlotRepository
    {
        private readonly ApplicationDbContext _context;

        public PlotRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<Plot?> GetByIdAsync(int id)
        {
            return await _context.Plots.FindAsync(id);
        }

        public async Task<(IEnumerable<Plot> Items, int Total)> GetAllAsync(
            bool includeInactive,
            string? search,
            int page,
            int pageSize)
        {
            var query = _context.Plots.AsQueryable();

            if (!includeInactive)
                query = query.Where(p => p.IsActive);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = $"%{search}%";

                query = query.Where(p =>
                    EF.Functions.Like(p.Name, term) ||
                    (p.Description != null && EF.Functions.Like(p.Description, term))
                );
            }

            var total = await query.CountAsync();

            var items = await query
                .OrderBy(p => p.Name)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, total);
        }

        public async Task AddAsync(Plot plot)
        {
            plot.CreatedAt = DateTime.UtcNow;
            plot.UpdatedAt = DateTime.UtcNow;

            _context.Plots.Add(plot);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateAsync(Plot plot)
        {
            plot.UpdatedAt = DateTime.UtcNow;
            _context.Plots.Update(plot);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var plot = await _context.Plots.FindAsync(id);
            if (plot != null)
            {
                _context.Plots.Remove(plot);
                await _context.SaveChangesAsync();
            }
        }

        public async Task<bool> ExistsAsync(int id)
        {
            return await _context.Plots.AnyAsync(p => p.Id == id);
        }
    }
}