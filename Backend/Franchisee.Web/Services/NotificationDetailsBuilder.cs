using System.Text.Json;
using Franchisee.Web.Models;

namespace Franchisee.Web.Services
{
    public static class NotificationDetailsBuilder
    {
        public static NotificationChangesDto Build(JsonElement changes)
        {
            var dto = new NotificationChangesDto();

            var mainInfo = new List<FieldChangeDto>();

            foreach (var property in changes.EnumerateObject())
            {
                var name = property.Name;

                if (property.Value.ValueKind != JsonValueKind.Object)
                    continue;

                if (!property.Value.TryGetProperty("old", out var oldVal))
                    continue;

                if (!property.Value.TryGetProperty("new", out var newVal))
                    continue;

                if (name == "Phone" ||
                    name == "CustomerFullName" ||
                    name == "CustomerEmail" ||
                    name == "Address" ||
                    name == "MonumentType" ||
                    name == "MonumentSize")
                {
                    mainInfo.Add(new FieldChangeDto
                    {
                        Field = name,
                        Label = GetLabel(name),
                        OldValue = oldVal.ToString(),
                        NewValue = newVal.ToString()
                    });
                }
            }

            if (mainInfo.Any())
                dto.MainInfo = mainInfo;

            return dto;
        }

        private static string GetLabel(string field)
        {
            return field switch
            {
                "Phone" => "Телефон",
                "CustomerFullName" => "ФИО",
                "CustomerEmail" => "Email",
                "Address" => "Адрес",
                "MonumentType" => "Монумент",
                "MonumentSize" => "Размер",
                _ => field
            };
        }
    }
}