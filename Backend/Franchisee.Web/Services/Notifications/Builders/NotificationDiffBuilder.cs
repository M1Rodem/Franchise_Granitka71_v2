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

        var dto = new WorksChangeDto
        {
            AddedWorks = new List<OrderWorkItemDto>(),
            RemovedWorks = new List<OrderWorkItemDto>(),
            ChangedWorks = new List<WorkItemChangedDto>()
        };

        // Добавленные работы
        if (works.TryGetProperty("added", out var added))
        {
            foreach (var item in added.EnumerateArray())
            {
                var work = ParseWork(item);
                if (work.IsDistanceWork && work.DistanceKm.HasValue && work.Routes > 0)
                {
                    work.Quantity = (decimal)(work.DistanceKm.Value * work.Routes);
                }
                dto.AddedWorks.Add(work);
            }
        }

        // Удаленные работы
        if (works.TryGetProperty("removed", out var removed))
        {
            foreach (var item in removed.EnumerateArray())
            {
                var work = ParseWork(item);
                if (work.IsDistanceWork && work.DistanceKm.HasValue && work.Routes > 0)
                {
                    work.Quantity = (decimal)(work.DistanceKm.Value * work.Routes);
                }
                dto.RemovedWorks.Add(work);
            }
        }

        // Измененные работы
        if (works.TryGetProperty("changed", out var changed))
        {
            foreach (var item in changed.EnumerateArray())
            {
                var id = item.GetProperty("id").GetInt32();
                var oldElement = item.GetProperty("old");
                var newElement = item.GetProperty("new");

                var isDistanceWork = item.TryGetProperty("isDistanceWork", out var distWork)
                    ? distWork.GetBoolean()
                    : false;

                var oldItem = ParseWork(oldElement);
                var newItem = ParseWork(newElement);

                if (!oldItem.IsDistanceWork && isDistanceWork)
                    oldItem.IsDistanceWork = true;
                if (!newItem.IsDistanceWork && isDistanceWork)
                    newItem.IsDistanceWork = true;

                var changedItem = new WorkItemChangedDto
                {
                    Id = id,
                    Old = oldItem,
                    New = newItem
                };

                if (string.IsNullOrWhiteSpace(changedItem.New.WorkDescription))
                {
                    changedItem.New.WorkDescription = changedItem.Old.WorkDescription;
                }

                if (changedItem.Old.IsDistanceWork && changedItem.Old.DistanceKm.HasValue && changedItem.Old.Routes > 0)
                {
                    changedItem.Old.Quantity = (decimal)(changedItem.Old.DistanceKm.Value * changedItem.Old.Routes);
                }
                if (changedItem.New.IsDistanceWork && changedItem.New.DistanceKm.HasValue && changedItem.New.Routes > 0)
                {
                    changedItem.New.Quantity = (decimal)(changedItem.New.DistanceKm.Value * changedItem.New.Routes);
                }

                dto.ChangedWorks.Add(changedItem);
            }
        }

        // Расчет сумм
        var allOldWorks = new List<OrderWorkItemDto>();
        allOldWorks.AddRange(dto.RemovedWorks);
        allOldWorks.AddRange(dto.ChangedWorks.Select(x => x.Old));

        var allNewWorks = new List<OrderWorkItemDto>();
        allNewWorks.AddRange(dto.AddedWorks);
        allNewWorks.AddRange(dto.ChangedWorks.Select(x => x.New));

        dto.OldTotal = allOldWorks.Sum(x => x.Price * x.Quantity);
        dto.NewTotal = allNewWorks.Sum(x => x.Price * x.Quantity);
        dto.ChangedWorksCount = dto.ChangedWorks.Count;

        // Дистанционные работы
        var anyDistanceWork = dto.AddedWorks.Any(x => x.IsDistanceWork) ||
                      dto.RemovedWorks.Any(x => x.IsDistanceWork) ||
                      dto.ChangedWorks.Any(x => x.Old.IsDistanceWork || x.New.IsDistanceWork);

        if (anyDistanceWork)
        {
            dto.ShowRoutesInsteadOfQuantity = true;

            var distanceWorkFromAdded = dto.AddedWorks.FirstOrDefault(x => x.IsDistanceWork);
            var distanceWorkFromRemoved = dto.RemovedWorks.FirstOrDefault(x => x.IsDistanceWork);
            var distanceWorkFromChanged = dto.ChangedWorks.FirstOrDefault(x => x.Old.IsDistanceWork || x.New.IsDistanceWork);

            if (distanceWorkFromAdded != null)
            {
                dto.NewQuantity = distanceWorkFromAdded.Routes;
                dto.OldQuantity = distanceWorkFromAdded.Routes;
            }
            else if (distanceWorkFromChanged != null)
            {
                if (distanceWorkFromChanged.Old.IsDistanceWork)
                    dto.OldQuantity = distanceWorkFromChanged.Old.Routes;
                if (distanceWorkFromChanged.New.IsDistanceWork)
                    dto.NewQuantity = distanceWorkFromChanged.New.Routes;
            }
            else if (distanceWorkFromRemoved != null)
            {
                dto.OldQuantity = distanceWorkFromRemoved.Routes;
                dto.NewQuantity = distanceWorkFromRemoved.Routes;
            }
        }

        result.Works = dto;
    }

    private static OrderWorkItemDto ParseWork(JsonElement item)
    {
        var isDistanceWork = item.TryGetProperty("isDistanceWork", out var isDist)
            ? isDist.GetBoolean()
            : false;

        var id = item.TryGetProperty("id", out var idProp) ? idProp.GetInt32() : 0;
        var workDescription = item.GetProperty("workDescription").GetString() ?? "";
        var price = item.GetProperty("price").GetDecimal();
        var note = item.TryGetProperty("note", out var noteProp) ? noteProp.GetString() : null;

        if (isDistanceWork)
        {
            // Distance работа
            var routes = item.TryGetProperty("routes", out var r) ? r.GetInt32() : 1;
            var distanceKm = item.TryGetProperty("distanceKm", out var d) ? d.GetDouble() : (double?)null;
            var calculatedQuantity = (decimal)(routes * (distanceKm ?? 0));

            return new OrderWorkItemDto
            {
                Id = id,
                WorkDescription = workDescription,
                Price = price,
                Routes = routes,
                Quantity = calculatedQuantity,
                Note = note,
                DistanceKm = distanceKm,
                IsDistanceWork = true
            };
        }

        var quantityValue = item.TryGetProperty("quantity", out var q) ? q.GetDecimal() : 0;

        return new OrderWorkItemDto
        {
            Id = id,
            WorkDescription = workDescription,
            Price = price,
            Quantity = quantityValue,
            Note = note,
            Routes = 1,
            DistanceKm = null,
            IsDistanceWork = false
        };
    }

    private static void BuildPayments(JsonElement changes, NotificationChangesDto result)
    {
        if (!changes.TryGetProperty("Payments", out var payments))
            return;

        var dto = new PaymentsChangeDto
        {
            AddedPayments = new List<OrderPaymentDto>(),
            RemovedPayments = new List<OrderPaymentDto>(),
            ChangedPayments = new List<PaymentChangedDto>()
        };

        // Добавленные платежи
        if (payments.TryGetProperty("added", out var added))
        {
            foreach (var item in added.EnumerateArray())
            {
                dto.AddedPayments.Add(ParsePayment(item));
            }
        }

        // Удаленные платежи
        if (payments.TryGetProperty("removed", out var removed))
        {
            foreach (var item in removed.EnumerateArray())
            {
                dto.RemovedPayments.Add(ParsePayment(item));
            }
        }

        // Измененные платежи
        if (payments.TryGetProperty("changed", out var changed))
        {
            foreach (var item in changed.EnumerateArray())
            {
                var changedItem = new PaymentChangedDto
                {
                    Id = item.GetProperty("id").GetInt32(),
                    Old = ParsePayment(item.GetProperty("old")),
                    New = ParsePayment(item.GetProperty("new"))
                };
                dto.ChangedPayments.Add(changedItem);
            }
        }

        dto.ChangedPaymentsCount = dto.ChangedPayments.Count;
        result.Payments = dto;
    }

    private static OrderPaymentDto ParsePayment(JsonElement item)
    {
        return new OrderPaymentDto
        {
            Id = item.TryGetProperty("id", out var idProp) ? idProp.GetInt32() : 0,  // ← ДОБАВИТЬ!
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