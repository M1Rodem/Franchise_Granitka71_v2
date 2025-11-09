using Franchisee.Web.Models;

namespace Franchisee.Web.Services.Repositories
{
    public interface IManagerRepository
    {
        Task<Manager?> GetByUsernameAsync(string username);
        Task<Manager?> GetByIdAsync(int id);
        Task<IEnumerable<Manager>> GetAllAsync(bool activeOnly = false);
        Task AddAsync(Manager manager);
        Task UpdateAsync(Manager manager);
        Task DeleteAsync(int id);
        Task BlockAsync(int id);
        Task UnblockAsync(int id);
        void ChangePassword(int managerId, string newPassword);
        bool VerifyPassword(string password, string passwordHash);
        string HashPassword(string password);
        void UpdateProfile(int managerId, string fullName);
    }
}