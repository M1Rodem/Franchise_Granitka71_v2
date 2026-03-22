export function getNotificationTypeLabel(type: string): string {
  switch (type) {
    case 'OrderUpdateRequest':
      return 'Запрос на изменение заказа'

    case 'System':
      return 'Системное уведомление'

    case 'OrderCompletionConfirmation':
      return 'Подтверждение завершения заказа'

    default:
      return type
  }
}