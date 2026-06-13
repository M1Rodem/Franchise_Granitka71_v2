using System.ComponentModel.DataAnnotations;

namespace Franchisee.Web.Models.DTOs.Users
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
    public class ManagerDetailsDto
    {
        public int Id { get; set; }

        public string Username { get; set; } = string.Empty;

        public string FullName { get; set; } = string.Empty;

        public string Role { get; set; } = string.Empty;

        public bool IsBlocked { get; set; }

        public string? Password { get; set; }
    }
    public class PagedResponse<T>
    {
        public List<T> Items { get; set; } = new();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
    }
    public class OfflineEmployeeDto
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
    }
}