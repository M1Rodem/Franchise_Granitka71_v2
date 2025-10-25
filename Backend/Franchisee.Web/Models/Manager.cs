using System.ComponentModel.DataAnnotations;

namespace WebApplication1.Models
{
    public enum UserRole { Manager, Admin }  // Вместо string

    public class Manager
    {
        [Key] public int Id { get; set; }
        [Required][StringLength(50)] public string Username { get; set; } = string.Empty;
        [Required] public string PasswordHash { get; set; } = string.Empty;
        [Required][StringLength(100)] public string FullName { get; set; } = string.Empty;
        public UserRole Role { get; set; } = UserRole.Manager;  // Enum!
        public bool IsBlocked { get; set; } = false;
        public virtual List<Order> Orders { get; set; } = new();
    }
}