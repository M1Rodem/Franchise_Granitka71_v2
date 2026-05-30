namespace Franchisee.Web.Models.DTOs.Print
{
    public class PhotoInfoDto
    {
        public int Id { get; set; }
        public string Url { get; set; } = string.Empty;
        public int Width { get; set; }
        public int Height { get; set; }
    }
}