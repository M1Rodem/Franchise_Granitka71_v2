import type { OrderFormModel } from './order-form.schema'
export const createOrderDefaultValues = (): OrderFormModel => {
  const today = new Date().toISOString().split('T')[0]
  
  return {
    inspectionPlace: '',
    plotId: null,
    latitude: null,
    longitude: null,
    orderDate: today,

    deceasedFullName: '',

    client: {
      fullName: '',
      email: '',
      phone: '',
      address: '',
    },

    monument: {
      type: '',
      size: '',
    },

    works: [
      {
        workDescription: 'Расстояние',
        quantity: 1,
        price: 0,
        note: 'Расчетное расстояние будет определено после выбора на карте',
      },
    ],

    payments: [
      {
        paymentType: 'Аванс',
        amount: 0,
        paymentDate: today,
        note: '30% предоплата',
      },
    ],

    additionalInfo: '',

    discountPercent: 0,

    media: {
      tempPhotoIds: [],
      tempVideoIds: [],
    },
  }
}