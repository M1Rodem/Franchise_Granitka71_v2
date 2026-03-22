namespace Franchisee.Web.Models.DTOs.Media
{
    public class TempUploadDto
    {
        public int Id { get; set; }
        public string OriginalFileName { get; set; } = string.Empty;
        public long Size { get; set; }
        public string PreviewUrl { get; set; } = string.Empty;
        public int Width { get; set; }
        public int Height { get; set; }
    }
}