using System.ComponentModel.DataAnnotations;

namespace WebApplication1.Models
{
    public class ChangePasswordDto
    {
        [Required] public string CurrentPassword { get; set; } = string.Empty;
        [Required][MinLength(6)] public string NewPassword { get; set; } = string.Empty;
    }
    public class UpdateProfileDto
    {
        [Required] public string FullName { get; set; } = string.Empty;
    }
    public class ChangeRoleDto
    {
        [Required] public string Role { get; set; } = "Manager";    // "Admin" или "Manager"
    }
} 
