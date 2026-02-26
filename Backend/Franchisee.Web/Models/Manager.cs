using System.ComponentModel.DataAnnotations;

namespace Franchisee.Web.Models
{
    public enum UserRole { Manager, Admin, SuperAdmin }
    public class Manager
    {
        [Key] public int Id { get; set; }
        [Required][StringLength(50)] public string Username { get; set; } = string.Empty;
        [Required] public string PasswordHash { get; set; } = string.Empty;
        [Required][StringLength(100)] public string FullName { get; set; } = string.Empty;
        public UserRole Role { get; set; } = UserRole.Manager;
        public bool IsBlocked { get; set; } = false;
        public string? RefreshToken { get; set; }
        public DateTime? RefreshTokenExpiryTime { get; set; }
        public virtual List<Order> Orders { get; set; } = new();
    }
}