using Franchisee.Web.Models.Entities.Users;

namespace Franchisee.Web.Services.Users.Repositories
{
    public interface IManagerRepository
    {
        Task<(List<Manager>, int)> GetPagedAsync(
            int page,
            int pageSize,
            string searchQuery,
            string? role
        );
        Task<Manager?> GetByUsernameAsync(string username);
        Task<Manager?> GetByIdAsync(int id);
        Task<IEnumerable<Manager>> GetAllAsync(bool activeOnly = false);
        Task AddAsync(Manager manager);
        Task UpdateAsync(Manager manager);
        Task DeleteAsync(int id);
        Task BlockAsync(int id);
        Task<Manager?> RotateRefreshTokenAsync(string oldToken, string newToken, DateTime newExpiry);
        Task UnblockAsync(int id);
        Task ChangePasswordAsync(int managerId, string newPassword);
        bool VerifyPassword(string password, string passwordHash);
        string HashPassword(string password);
        void UpdateProfile(int managerId, string fullName);
        Task<Manager?> GetByRefreshTokenAsync(string refreshToken);
    }
}