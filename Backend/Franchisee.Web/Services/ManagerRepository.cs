using Franchisee.Web.Configuration;
using Franchisee.Web.Models;
using BCrypt.Net;
using Microsoft.EntityFrameworkCore;
using Franchisee.Web.Services.Repositories;

namespace Franchisee.Web.Services
{
    public class ManagerRepository : IManagerRepository
    {
        private readonly ApplicationDbContext _context;

        public ManagerRepository(ApplicationDbContext context)
        {
            _context = context;
        }
        private IQueryable<Manager> BaseQuery()
        {
            return _context.Managers.AsNoTracking();
        }
        public async Task<Manager?> GetByRefreshTokenAsync(string refreshToken)
        {
            return await _context.Managers
                .FirstOrDefaultAsync(m =>
                    m.RefreshToken == refreshToken &&
                    m.RefreshTokenExpiryTime > DateTime.UtcNow);
        }
        public async Task<Manager?> GetByUsernameAsync(string username)
        {
            return await _context.Managers.FirstOrDefaultAsync(m => m.Username == username);
        }
        public async Task<Manager?> GetByIdAsync(int id)
        {
            return await _context.Managers.FirstOrDefaultAsync(m => m.Id == id);
        }
        public async Task<IEnumerable<Manager>> GetAllAsync(bool activeOnly = false)
        {
            var query = BaseQuery();
            if (activeOnly) query = query.Where(m => !m.IsBlocked);
            return await query.ToListAsync();
        }
        public async Task AddAsync(Manager manager)
        {
            // Проверяем уникальность username
            if (await _context.Managers.AnyAsync(m => m.Username == manager.Username))
                throw new InvalidOperationException("Пользователь с таким логином уже существует");

            _context.Managers.Add(manager);
            await _context.SaveChangesAsync();
        }
        public async Task UpdateAsync(Manager manager)
        {
            // Проверяем уникальность username (исключая текущего)
            if (await _context.Managers.AnyAsync(m => m.Username == manager.Username && m.Id != manager.Id))
                throw new InvalidOperationException("Пользователь с таким логином уже существует");
            _context.Managers.Update(manager);
            await _context.SaveChangesAsync();
        }
        public async Task DeleteAsync(int id)
        {
            var manager = await _context.Managers.FindAsync(id);
            if (manager != null)
            {
                _context.Managers.Remove(manager);
                await _context.SaveChangesAsync();
            }
        }
        public async Task BlockAsync(int id)
        {
            var manager = await _context.Managers.FindAsync(id);
            if (manager != null)
            {
                manager.IsBlocked = true;
                await _context.SaveChangesAsync();
            }
        }
        public async Task UnblockAsync(int id)
        {
            var manager = await _context.Managers.FindAsync(id);
            if (manager != null)
            {
                manager.IsBlocked = false;
                await _context.SaveChangesAsync();
            }
        }
        public async Task ChangePasswordAsync(int managerId, string newPassword)
        {
            var manager = await _context.Managers.FirstOrDefaultAsync(m => m.Id == managerId);
            if (manager != null)
            {
                manager.PasswordHash = HashPassword(newPassword);
                await _context.SaveChangesAsync();
            }
        }
        public string HashPassword(string password)
        {
            return BCrypt.Net.BCrypt.HashPassword(password);
        }
        public bool VerifyPassword(string password, string passwordHash)
        {
            return BCrypt.Net.BCrypt.Verify(password, passwordHash);
        }
        public void UpdateProfile(int managerId, string fullName)
        {
            var manager = _context.Managers.FirstOrDefault(m => m.Id == managerId);
            if (manager != null)
            {
                manager.FullName = fullName;
                _context.SaveChanges();
            }
        }
        public async Task<(List<Manager>, int)> GetPagedAsync(
            int page,
            int pageSize,
            string searchQuery,
            string? role)
        {
            var query = _context.Managers.AsQueryable();

            if (!string.IsNullOrWhiteSpace(searchQuery))
            {
                query = query.Where(x =>
                    x.Username.ToLower().Contains(searchQuery.ToLower()) ||
                    x.FullName.ToLower().Contains(searchQuery.ToLower()));
            }

            if (!string.IsNullOrWhiteSpace(role))
            {
                if (Enum.TryParse<UserRole>(role, true, out var roleEnum))
                {
                    query = query.Where(x => x.Role == roleEnum);
                }
            }

            var totalCount = await query.CountAsync();

            var items = await query
                .OrderBy(x => x.Id)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, totalCount);
        }
    }
}