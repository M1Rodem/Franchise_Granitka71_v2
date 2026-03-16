using System.Text.Json;
using Franchisee.Web.Models;

namespace Franchisee.Web.Services;

public static class NotificationDiffBuilder
{
    public static NotificationChangesDto Build(JsonElement changes)
    {
        var result = new NotificationChangesDto();

        BuildMainInfo(changes, result);
        BuildMap(changes, result);
        BuildWorks(changes, result);
        BuildPayments(changes, result);
        BuildMedia(changes, result);
        BuildFinance(changes, result);

        return result;
    }

    private static void BuildMainInfo(JsonElement changes, NotificationChangesDto result)
    {
        var list = new List<FieldChangeDto>();

        foreach (var prop in changes.EnumerateObject())
        {
            if (prop.Value.ValueKind != JsonValueKind.Object)
                continue;

            if (!prop.Value.TryGetProperty("old", out var oldVal))
                continue;

            if (!prop.Value.TryGetProperty("new", out var newVal))
                continue;

            var field = prop.Name;

            if (field is
                "CustomerFullName"
                or "CustomerEmail"
                or "Phone"
                or "Address"
                or "MonumentType"
                or "MonumentSize"
                or "DeceasedFullName"
                or "AdditionalInfo")
            {
                list.Add(new FieldChangeDto
                {
                    Field = field,
                    Label = GetLabel(field),
                    OldValue = oldVal.ToString(),
                    NewValue = newVal.ToString()
                });
            }
        }

        if (list.Any())
            result.MainInfo = list;
    }

    private static void BuildMap(JsonElement changes, NotificationChangesDto result)
    {
        if (!changes.TryGetProperty("Latitude", out var lat))
            return;

        if (!changes.TryGetProperty("Longitude", out var lon))
            return;

        var map = new MapChangeDto();

        map.Old.Latitude = lat.GetProperty("old").GetDouble();
        map.New.Latitude = lat.GetProperty("new").GetDouble();

        map.Old.Longitude = lon.GetProperty("old").GetDouble();
        map.New.Longitude = lon.GetProperty("new").GetDouble();

        result.Map = map;
    }

    private static void BuildWorks(JsonElement changes, NotificationChangesDto result)
    {
        if (!changes.TryGetProperty("WorkItems", out var works))
            return;

        var dto = new WorksChangeDto();

        var oldWorks = works.GetProperty("old");
        var newWorks = works.GetProperty("new");

        foreach (var item in oldWorks.EnumerateArray())
        {
            dto.OldWorks.Add(ParseWork(item));
        }

        foreach (var item in newWorks.EnumerateArray())
        {
            dto.NewWorks.Add(ParseWork(item));
        }

        dto.OldTotal = dto.OldWorks.Sum(x => x.Price * x.Quantity);
        dto.NewTotal = dto.NewWorks.Sum(x => x.Price * x.Quantity);

        result.Works = dto;
    }

    private static OrderWorkItemDto ParseWork(JsonElement item)
    {
        return new OrderWorkItemDto
        {
            WorkDescription = item.GetProperty("workDescription").GetString() ?? "",
            Quantity = item.GetProperty("quantity").GetDecimal(),
            Price = item.GetProperty("price").GetDecimal(),
            Note = item.TryGetProperty("note", out var note)
                ? note.GetString()
                : null
        };
    }

    private static void BuildPayments(JsonElement changes, NotificationChangesDto result)
    {
        if (!changes.TryGetProperty("Payments", out var payments))
            return;

        var dto = new PaymentsChangeDto();

        foreach (var item in payments.GetProperty("old").EnumerateArray())
        {
            dto.OldPayments.Add(ParsePayment(item));
        }

        foreach (var item in payments.GetProperty("new").EnumerateArray())
        {
            dto.NewPayments.Add(ParsePayment(item));
        }

        result.Payments = dto;
    }

    private static OrderPaymentDto ParsePayment(JsonElement item)
    {
        return new OrderPaymentDto
        {
            PaymentType = item.GetProperty("paymentType").GetString() ?? "",
            Amount = item.GetProperty("amount").GetDecimal(),
            PaymentDate = item.GetProperty("paymentDate").GetDateTime(),
            Note = item.TryGetProperty("note", out var note)
                ? note.GetString()
                : null
        };
    }

    private static void BuildMedia(JsonElement changes, NotificationChangesDto result)
    {
        var dto = new MediaChangeDto();

        if (changes.TryGetProperty("Photos", out var photos))
        {
            foreach (var id in photos.GetProperty("removedIds").EnumerateArray())
            {
                dto.DeletedMedia.Add(new MediaItemDto
                {
                    Id = id.GetInt32(),
                    Type = "photo",
                    PreviewUrl = $"/media/{id}.jpg"
                });
            }

            foreach (var id in photos.GetProperty("addedTempIds").EnumerateArray())
            {
                dto.AddedMedia.Add(new MediaItemDto
                {
                    Id = id.GetInt32(),
                    Type = "photo",
                    PreviewUrl = $"/media/temp/{id}.jpg"
                });
            }
        }

        if (changes.TryGetProperty("Videos", out var videos))
        {
            foreach (var id in videos.GetProperty("addedTempIds").EnumerateArray())
            {
                dto.AddedMedia.Add(new MediaItemDto
                {
                    Id = id.GetInt32(),
                    Type = "video",
                    PreviewUrl = $"/media/temp/{id}.mp4"
                });
            }
        }

        if (dto.AddedMedia.Any() || dto.DeletedMedia.Any())
            result.Media = dto;
    }

    private static void BuildFinance(JsonElement changes, NotificationChangesDto result)
    {
        if (result.Works == null)
            return;

        var finance = new FinanceChangeDto();

        finance.Old.WorksTotal = result.Works.OldTotal;
        finance.New.WorksTotal = result.Works.NewTotal;

        finance.Old.Total = result.Works.OldTotal;
        finance.New.Total = result.Works.NewTotal;

        result.Finance = finance;
    }

    private static string GetLabel(string field)
    {
        return field switch
        {
            "CustomerFullName" => "ФИО",
            "CustomerEmail" => "Email",
            "Phone" => "Телефон",
            "Address" => "Адрес",
            "MonumentType" => "Монумент",
            "MonumentSize" => "Размер",
            "DeceasedFullName" => "Покойный",
            "AdditionalInfo" => "Примечание",
            _ => field
        };
    }
}