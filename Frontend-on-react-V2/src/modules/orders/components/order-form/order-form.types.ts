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
      phone: '+7 (___) ___-__-__',
      address: '',
    },

    monument: {
      type: '',
      size: '',
    },

    works: [
      {
        workDescription: 'Расстояние',
        price: 0,

        isDistanceWork: true,

        routes: 1,
        distanceKm: 0,

        quantity: 0,

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
      tempOriginalPhotoIds: [],
      removedPhotoIds: [],
      removedVideoIds: [],
    },
  }
}