using Franchisee.Web.Models.Print;

namespace Franchisee.Web.Services.Print.Builders
{
    public interface IPrintDocumentBuilder
    {
        byte[] BuildExcel(PrintDataModel data);
        string BuildHtml(PrintDataModel data);
        string GetContentType { get; }
        string GetFileExtension { get; }
    }
}