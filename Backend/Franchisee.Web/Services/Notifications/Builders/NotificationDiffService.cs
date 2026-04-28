using Franchisee.Web.Models.DTOs.Orders;
using Franchisee.Web.Models.DTOs.Notifications;

namespace Franchisee.Web.Services.Notifications.Builders;

public class NotificationDiffService
{
    public WorkItemsDiffResult CompareWorkItems(
    List<OrderWorkItemDto> oldItems,
    List<OrderWorkItemDto> newItems)
    {
        var result = new WorkItemsDiffResult
        {
            Added = new List<OrderWorkItemDto>(),
            Removed = new List<OrderWorkItemDto>(),
            Changed = new List<WorkItemChangedDto>()
        };

        // Словарь для старых работ (только с Id > 0)
        var oldDict = oldItems.Where(x => x.Id > 0).ToDictionary(x => x.Id);

        // Разделяем новые работы на имеющие Id и без Id
        var newWithId = newItems.Where(x => x.Id > 0).ToList();
        var newWithoutId = newItems.Where(x => x.Id == 0).ToList();

        var newDict = newWithId.ToDictionary(x => x.Id);

        // Находим удаленные (есть в old, нет в new)
        foreach (var old in oldItems)
        {
            if (old.Id > 0 && !newDict.ContainsKey(old.Id))
            {
                result.Removed.Add(old);
            }
        }

        // Находим добавленные (все с Id == 0)
        foreach (var newItem in newWithoutId)
        {
            result.Added.Add(newItem);
        }

        // Находим измененные (есть в обоих словарях)
        foreach (var newItem in newWithId)
        {
            if (oldDict.TryGetValue(newItem.Id, out var oldItem))
            {
                if (HasWorkItemChanges(oldItem, newItem))
                {
                    result.Changed.Add(new WorkItemChangedDto
                    {
                        Id = newItem.Id,
                        Old = oldItem,
                        New = newItem
                    });
                }
            }
        }

        return result;
    }

    private bool HasWorkItemChanges(OrderWorkItemDto old, OrderWorkItemDto newItem)
    {
        var oldNote = old.Note ?? string.Empty;
        var newNote = newItem.Note ?? string.Empty;

        bool workDescEqual = string.Equals(old.WorkDescription ?? "", newItem.WorkDescription ?? "");
        bool noteEqual = string.Equals(oldNote, newNote);

        bool priceEqual = Math.Abs(old.Price - newItem.Price) < 0.001m;
        bool quantityEqual = Math.Abs(old.Quantity - newItem.Quantity) < 0.001m;
        bool routesEqual = old.Routes == newItem.Routes;
        bool distanceEqual = Math.Abs((old.DistanceKm ?? 0) - (newItem.DistanceKm ?? 0)) < 0.001;
        bool isDistanceEqual = old.IsDistanceWork == newItem.IsDistanceWork;

        if (workDescEqual && noteEqual && priceEqual && quantityEqual &&
            routesEqual && distanceEqual && isDistanceEqual)
        {
            return false;
        }

        return true;
    }

    public PaymentsDiffResult ComparePayments(
    List<OrderPaymentDto> oldPayments,
    List<OrderPaymentDto> newPayments)
    {
        var result = new PaymentsDiffResult
        {
            Added = new List<OrderPaymentDto>(),
            Removed = new List<OrderPaymentDto>(),
            Changed = new List<PaymentChangedDto>()
        };

        // Словарь для старых платежей (только с Id > 0)
        var oldDict = oldPayments.Where(x => x.Id > 0).ToDictionary(x => x.Id);

        // Разделяем новые платежи
        var newWithId = newPayments.Where(x => x.Id > 0).ToList();
        var newWithoutId = newPayments.Where(x => x.Id == 0).ToList();

        var newDict = newWithId.ToDictionary(x => x.Id);

        // Находим удаленные
        foreach (var old in oldPayments)
        {
            if (old.Id > 0 && !newDict.ContainsKey(old.Id))
            {
                result.Removed.Add(old);
            }
        }

        // Находим добавленные
        foreach (var newPayment in newWithoutId)
        {
            result.Added.Add(newPayment);
        }

        // Находим измененные
        foreach (var newPayment in newWithId)
        {
            if (oldDict.TryGetValue(newPayment.Id, out var oldPayment))
            {
                if (HasPaymentChanges(oldPayment, newPayment))
                {
                    result.Changed.Add(new PaymentChangedDto
                    {
                        Id = newPayment.Id,
                        Old = oldPayment,
                        New = newPayment
                    });
                }
            }
        }

        return result;
    }

    private bool HasPaymentChanges(OrderPaymentDto old, OrderPaymentDto newPayment)
    {
        var oldNote = old.Note ?? string.Empty;
        var newNote = newPayment.Note ?? string.Empty;

        return old.Amount != newPayment.Amount ||
               old.PaymentType != newPayment.PaymentType ||
               old.PaymentDate != newPayment.PaymentDate ||
               oldNote != newNote;
    }
}