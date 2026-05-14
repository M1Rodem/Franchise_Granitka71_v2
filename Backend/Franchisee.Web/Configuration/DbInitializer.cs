using Franchisee.Web.Configuration;
using Franchisee.Web.Models.Entities.Users;
using Franchisee.Web.Services.Users.Repositories;
using Microsoft.Extensions.DependencyInjection;

namespace Franchisee.Web.Configuration
{
    public static class DbInitializer
    {
        public static async Task InitializeAsync(IServiceProvider serviceProvider)
        {
            using var scope = serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var managerRepo = scope.ServiceProvider.GetRequiredService<IManagerRepository>();
            
            // Проверяем, есть ли уже пользователи
            if (!context.Managers.Any())
            {
                // Создаем SuperAdmin
                var admin = new Manager
                {
                    Username = "admin",
                    FullName = "Главный администратор",
                    Role = UserRole.SuperAdmin,
                    IsBlocked = false,
                    PasswordHash = managerRepo.HashPassword("Admin123!")
                };
                
                await managerRepo.AddAsync(admin);
            }
        }
    }
}