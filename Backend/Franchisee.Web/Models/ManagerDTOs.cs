using System.ComponentModel.DataAnnotations;

namespace WebApplication1.Models
{
    public class CreateManagerDto
    {
        [Required] public string Username { get; set; } = string.Empty;
        [Required][MinLength(6)] public string Password { get; set; } = string.Empty;
        [Required] public string FullName { get; set; } = string.Empty; 
        public string Role { get; set; } = "Manager";
    }

    public class UpdateManagerDto
    {
        [Required] public string Username { get; set; } = string.Empty;
        public string? Password { get; set; }
        [Required] public string FullName { get; set; } = string.Empty;
    }

    public class ManagerResponseDto
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public bool IsBlocked { get; set; }
    }
}