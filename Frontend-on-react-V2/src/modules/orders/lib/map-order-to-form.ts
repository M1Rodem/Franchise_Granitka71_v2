import type { OrderDetailsDto } from '../types/orders.types'
import type { OrderFormModel } from '../components/order-form/order-form.schema'

function formatPhoneForMask(phone?: string) {
  if (!phone) return ''

  const digits = phone.replace(/\D/g, '')

  if (digits.length !== 11) return ''

  return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`
}

export function mapOrderToForm(
  order: OrderDetailsDto,
  plots: { id: number; name: string }[] = []
): OrderFormModel {
  const plot =
    plots.find(p => p.id === order.plotId) ??
    plots.find(p => p.name === order.plotName) ??
    plots.find(p => p.name === order.place)

  const plotId = plot?.id ?? order.plotId ?? null
  const result = {
    managerId: order.managerId,
    inspectionPlace: order.inspectionPlace ?? '',
    plotId,
    latitude: order.latitude ?? null,
    longitude: order.longitude ?? null,
    orderDate: order.orderDate.split('T')[0],

    discountPercent: order.discountPercent ?? 0,

    deceasedFullName: order.deceasedFullName ?? '',

    client: {
      fullName: order.customerFullName ?? '',
      email: order.customerEmail ?? '',
      phone: formatPhoneForMask(order.phone),
      address: order.address ?? '',
    },

    monument: {
      type: String(order.monumentType ?? ''),
      size: String(order.monumentSize ?? ''),
    },

    works: order.workItems.map((w) => {
      if (w.isDistanceWork) {
        return {
          id: w.id,
          workDescription: w.workDescription,
          price: w.price,

          isDistanceWork: true,

          routes: (w as any).routes ?? 1,
          distanceKm: w.distanceKm ?? 0,

          quantity: w.quantity, // только UI

          note: w.note ?? '',
        }
      }

      return {
        id: w.id,
        workDescription: w.workDescription,
        price: w.price,
        quantity: w.quantity,
        isDistanceWork: false,
        note: w.note ?? '',
      }
    }),

    payments: order.payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      paymentDate: p.paymentDate.split('T')[0],
      paymentType: p.paymentType,
      note: p.note ?? '',
    })),

    additionalInfo: String(order.additionalInfo || ''),

    media: {
      tempPhotoIds: [],
      tempVideoIds: [],
      tempOriginalPhotoIds: [],
      removedPhotoIds: [],
      removedVideoIds: [],
    },
  }
  return result
}