import type { OrderDetailsDto } from '../types/orders.types'
import type { OrderFormModel } from '../components/order-form/order-form.schema'

function formatPhoneForMask(phone?: string) {
  if (!phone) return ''

  const digits = phone.replace(/\D/g, '')

  if (digits.length !== 11) return ''

  return `+7 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7,9)}-${digits.slice(9,11)}`
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
  return {
    inspectionPlace: order.inspectionPlace ?? '',
    plotId,
    latitude: order.latitude ?? null,
    longitude: order.longitude ?? null,
    orderDate: order.orderDate.split('T')[0],

    deceasedFullName: order.deceasedFullName ?? '',

    client: {
      fullName: order.customerFullName ?? '',
      email: order.customerEmail ?? '',
      phone: formatPhoneForMask(order.phone),
      address: order.address ?? '',
    },

    monument: {
      type: order.monumentType ?? '',
      size: order.monumentSize ?? '',
    },

    works: order.workItems.map((w) => ({
      workDescription: w.workDescription,
      price: w.price,
      quantity: w.quantity,
      note: w.note ?? '',
    })),

    payments: order.payments.map((p) => ({
      amount: p.amount,
      paymentDate: p.paymentDate.split('T')[0],
      paymentType: p.paymentType,
      note: p.note ?? '',
    })),

    additionalInfo: order.additionalInfo ?? '',

    media: {
      tempPhotoIds: [],
      tempVideoIds: [],
    },
  }
}