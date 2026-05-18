export function getNotificationTypeLabel(type: string): string {
  switch (type) {
    case 'OrderUpdateRequest':
      return 'Запрос на изменение заказа'

    case 'System':
      return 'Системное уведомление'

    case 'OrderCompletionConfirmation':
      return 'Подтверждение завершения заказа'

    case 'CompletionRequest':
      return 'Проверка выполнения'

    default:
      return type
  }
}

export function isSystemNotification(type: number | string) {
  return type === 1 || type === 'System'
}
