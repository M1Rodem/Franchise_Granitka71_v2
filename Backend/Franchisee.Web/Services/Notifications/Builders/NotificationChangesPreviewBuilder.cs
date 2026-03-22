using System.Text.Json;
using Franchisee.Web.Models.DTOs.Notifications;

namespace Franchisee.Web.Services.Notifications.Builders;

public static class NotificationChangesPreviewBuilder
{
    public static NotificationChangesPreviewDto Build(JsonElement proposedChanges)
    {
        var preview = new NotificationChangesPreviewDto();

        foreach (var prop in proposedChanges.EnumerateObject())
        {
            var name = prop.Name;

            switch (name)
            {
                case "CustomerFullName":
                case "CustomerEmail":
                case "Phone":
                case "Address":
                case "MonumentType":
                case "MonumentSize":
                case "DeceasedFullName":
                case "AdditionalInfo":
                    preview.MainInfo++;
                    break;

                case "Latitude":
                case "Longitude":
                    preview.Map = 1;
                    break;

                case "WorkItems":
                    var oldWorks = prop.Value.GetProperty("old").GetArrayLength();
                    var newWorks = prop.Value.GetProperty("new").GetArrayLength();
                    preview.Works = Math.Abs(newWorks - oldWorks);
                    break;

                case "Payments":
                    var oldPayments = prop.Value.GetProperty("old").GetArrayLength();
                    var newPayments = prop.Value.GetProperty("new").GetArrayLength();
                    preview.Payments = Math.Abs(newPayments - oldPayments);
                    break;

                case "Photos":
                case "Videos":
                    var added = prop.Value.GetProperty("addedTempIds").GetArrayLength();
                    var removed = prop.Value.GetProperty("removedIds").GetArrayLength();
                    preview.Media += added + removed;
                    break;
            }
        }

        return preview;
    }
}