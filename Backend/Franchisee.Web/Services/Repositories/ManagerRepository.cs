using WebApplication1.Configuration;
using WebApplication1.Models;
using BCrypt.Net;
using Microsoft.EntityFrameworkCore;

namespace WebApplication1.Services.Repositories
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

            // Хэшируем пароль перед сохранением
            manager.PasswordHash = HashPassword(manager.PasswordHash);

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
        public void ChangePassword(int managerId, string newPassword)
        {
            var manager = _context.Managers.FirstOrDefault(m => m.Id == managerId);
            if (manager != null)
            {
                manager.PasswordHash = HashPassword(newPassword);
                _context.SaveChanges(); 
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
    }
}