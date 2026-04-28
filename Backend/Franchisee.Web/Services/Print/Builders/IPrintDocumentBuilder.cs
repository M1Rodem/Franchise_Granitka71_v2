using Franchisee.Web.Models.Print;

namespace Franchisee.Web.Services.Print.Builders
{
    public interface IPrintDocumentBuilder
    {
        string GetContentType { get; }
        string GetFileExtension { get; }
        byte[] BuildExcel(PrintDataModel data);
        string BuildHtml(PrintDataModel data);
    }
}