using System.Text.Json;
using Franchisee.Web.Models.DTOs.Notifications;
using Franchisee.Web.Models.DTOs.Orders;

namespace Franchisee.Web.Services.Notifications.Builders;

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
                or "AdditionalInfo"
                or "OrderDate")
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
        if (!changes.TryGetProperty("map", out var mapElement))
            return;

        var map = new MapChangeDto();

        // Старые данные
        if (mapElement.TryGetProperty("old", out var oldMap))
        {
            if (oldMap.TryGetProperty("latitude", out var lat))
                map.Old.Latitude = lat.GetDouble();

            if (oldMap.TryGetProperty("longitude", out var lon))
                map.Old.Longitude = lon.GetDouble();

            if (oldMap.TryGetProperty("plot", out var plot))
                map.Old.Plot = plot.GetString();

            if (oldMap.TryGetProperty("inspectionPlace", out var inspectionPlace))
                map.Old.InspectionPlace = inspectionPlace.GetString();
        }

        // Новые данные
        if (mapElement.TryGetProperty("new", out var newMap))
        {
            if (newMap.TryGetProperty("latitude", out var lat))
                map.New.Latitude = lat.GetDouble();

            if (newMap.TryGetProperty("longitude", out var lon))
                map.New.Longitude = lon.GetDouble();

            if (newMap.TryGetProperty("plot", out var plot))
                map.New.Plot = plot.GetString();

            if (newMap.TryGetProperty("inspectionPlace", out var inspectionPlace))
                map.New.InspectionPlace = inspectionPlace.GetString();
        }

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
            var work = ParseWork(item);

            if (work.IsDistanceWork && work.DistanceKm.HasValue && work.Routes > 0)
            {
                work.Quantity = (decimal)(work.DistanceKm.Value * work.Routes);
            }

            dto.OldWorks.Add(work);
        }

        foreach (var item in newWorks.EnumerateArray())
        {
            var work = ParseWork(item);

            if (work.IsDistanceWork && work.DistanceKm.HasValue && work.Routes > 0)
            {
                work.Quantity = (decimal)(work.DistanceKm.Value * work.Routes);
            }

            dto.NewWorks.Add(work);
        }

        dto.OldTotal = dto.OldWorks.Sum(x => x.Price * x.Quantity);
        dto.NewTotal = dto.NewWorks.Sum(x => x.Price * x.Quantity);

        var distanceWorkOld = dto.OldWorks.FirstOrDefault(x => x.IsDistanceWork);
        var distanceWorkNew = dto.NewWorks.FirstOrDefault(x => x.IsDistanceWork);

        if (distanceWorkOld != null && distanceWorkNew != null)
        {
            dto.ShowRoutesInsteadOfQuantity = true;
            dto.OldQuantity = distanceWorkOld.Routes;
            dto.NewQuantity = distanceWorkNew.Routes;
        }

        result.Works = dto;
    }
    private static OrderWorkItemDto ParseWork(JsonElement item)
    {
        var isDistanceWork = item.TryGetProperty("isDistanceWork", out var isDist)
            ? isDist.GetBoolean()
            : false;

        var routes = item.TryGetProperty("routes", out var r) ? r.GetInt32() : 1;
        var distanceKm = item.TryGetProperty("distanceKm", out var d) ? d.GetDouble() : (double?)null;
        var quantity = item.GetProperty("quantity").GetDecimal();

        if (!isDistanceWork && quantity > 0)
        {
            var workDesc = item.GetProperty("workDescription").GetString() ?? "";
            if (workDesc == "Расстояние")
            {
                isDistanceWork = true;
                distanceKm = (double)quantity;
                routes = 1;
            }
        }

        if (isDistanceWork && distanceKm.HasValue && distanceKm > 0 && routes > 0)
        {
            quantity = (decimal)(distanceKm.Value * routes);
        }

        return new OrderWorkItemDto
        {
            Id = item.TryGetProperty("id", out var idProp) ? idProp.GetInt32() : 0,
            WorkDescription = item.GetProperty("workDescription").GetString() ?? "",
            Price = item.GetProperty("price").GetDecimal(),
            Routes = routes,
            Quantity = quantity,
            Note = item.TryGetProperty("note", out var note) ? note.GetString() : null,
            DistanceKm = distanceKm,
            IsDistanceWork = isDistanceWork
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
            // Удаленные фото
            if (photos.TryGetProperty("removedIds", out var removedIds))
            {
                foreach (var id in removedIds.EnumerateArray())
                {
                    dto.DeletedMedia.Add(new MediaItemDto
                    {
                        Id = id.GetInt32(),
                        Type = "photo",
                        PreviewUrl = $"/api/media/{id}/file"
                    });
                }
            }

            // Добавленные фото (временные)
            if (photos.TryGetProperty("addedTempIds", out var addedTempIds))
            {
                foreach (var id in addedTempIds.EnumerateArray())
                {
                    dto.AddedMedia.Add(new MediaItemDto
                    {
                        Id = id.GetInt32(),
                        Type = "photo",
                        PreviewUrl = $"/api/media/temp-preview/{id}"
                    });
                }
            }
        }

        if (changes.TryGetProperty("Videos", out var videos))
        {
            // Удаленные видео (если есть)
            if (videos.TryGetProperty("removedIds", out var removedVideoIds))
            {
                foreach (var id in removedVideoIds.EnumerateArray())
                {
                    dto.DeletedMedia.Add(new MediaItemDto
                    {
                        Id = id.GetInt32(),
                        Type = "video",
                        PreviewUrl = $"/api/media/{id}/file"
                    });
                }
            }

            // Добавленные видео (временные)
            if (videos.TryGetProperty("addedTempIds", out var addedVideoTempIds))
            {
                foreach (var id in addedVideoTempIds.EnumerateArray())
                {
                    dto.AddedMedia.Add(new MediaItemDto
                    {
                        Id = id.GetInt32(),
                        Type = "video",
                        PreviewUrl = $"/api/media/temp-preview/{id}"  // ← Убрал /videos/
                    });
                }
            }
        }

        if (dto.AddedMedia.Any() || dto.DeletedMedia.Any())
            result.Media = dto;
    }

    private static void BuildFinance(JsonElement changes, NotificationChangesDto result)
    {
        if (result.Works == null) return;

        var finance = new FinanceChangeDto();

        // worksTotal
        finance.Old.WorksTotal = result.Works.OldTotal;
        finance.New.WorksTotal = result.Works.NewTotal;

        // Discount
        if (changes.TryGetProperty("DiscountPercent", out var discountElement))
        {
            if (discountElement.TryGetProperty("old", out var oldDiscount))
                finance.Old.Discount = oldDiscount.GetDecimal();
            if (discountElement.TryGetProperty("new", out var newDiscount))
                finance.New.Discount = newDiscount.GetDecimal();
        }

        // Расчет discountAmount и total
        finance.Old.DiscountAmount = Math.Round(finance.Old.WorksTotal * (finance.Old.Discount / 100m), 2);
        finance.New.DiscountAmount = Math.Round(finance.New.WorksTotal * (finance.New.Discount / 100m), 2);

        finance.Old.Total = finance.Old.WorksTotal - finance.Old.DiscountAmount;
        finance.New.Total = finance.New.WorksTotal - finance.New.DiscountAmount;
        if (finance.Old.Total < 0) finance.Old.Total = 0;
        if (finance.New.Total < 0) finance.New.Total = 0;

        // пытаемся получить платежи из разных мест
        decimal oldPaid = 0;
        decimal newPaid = 0;

        // 1. Из изменений (если платежи менялись)
        if (changes.TryGetProperty("Payments", out var paymentsProp))
        {
            if (paymentsProp.TryGetProperty("old", out var oldPayments))
                oldPaid = oldPayments.EnumerateArray().Sum(p => p.GetProperty("amount").GetDecimal());
            if (paymentsProp.TryGetProperty("new", out var newPayments))
                newPaid = newPayments.EnumerateArray().Sum(p => p.GetProperty("amount").GetDecimal());
        }

        // 2. Если нет в changes, но есть в originalData (нужно передавать из NotificationService)
        // Для этого нужно в NotificationService при создании уведомления добавлять текущие платежи

        finance.Old.Paid = oldPaid;
        finance.New.Paid = newPaid;

        finance.Old.Remaining = finance.Old.Total - finance.Old.Paid;
        finance.New.Remaining = finance.New.Total - finance.New.Paid;
        if (finance.Old.Remaining < 0) finance.Old.Remaining = 0;
        if (finance.New.Remaining < 0) finance.New.Remaining = 0;

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
            "OrderDate" => "Дата заказа",
            _ => field
        };
    }
}