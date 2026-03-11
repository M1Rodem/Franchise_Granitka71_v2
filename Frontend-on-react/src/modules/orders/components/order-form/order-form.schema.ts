import { z } from 'zod'

export const orderFormSchema = z
  .object({
    inspectionPlace: z.string().min(1, 'Укажите место осмотрел'),

    plotId: z.number().nullable(),

    latitude: z.number().nullable(),
    longitude: z.number().nullable(),

    place: z.string().optional(),

    orderDate: z.string(),

    deceasedFullName: z.string().min(1, 'Укажите ФИО усопшего'),

    client: z.object({
      fullName: z.string().min(1, 'Укажите ФИО заказчика'),
      email: z.string().email('Некорректный email').optional().or(z.literal('')),
      phone: z
        .string()
        .min(1, 'Укажите номер телефона')
        .regex(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, 'Некорректный формат телефона'),
      address: z.string().min(1, 'Укажите адрес'),
    }),

    monument: z.object({
      type: z.string().optional(),
      size: z.string().optional(),
    }),

    works: z
      .array(
        z.object({
          workDescription: z.string().min(1, 'Укажите вид работы'),
          quantity: z.number().min(0, 'Количество должно быть > 0'),
          price: z.number().min(0),
          note: z.string().optional(),
        })
      )
      .min(1, 'Минимум 1 работа'),

    payments: z
      .array(
        z.object({
          paymentType: z.string().min(1),
          amount: z.number().min(0),
          paymentDate: z.string(),
          note: z.string().optional(),
        })
      )
      .min(1, 'Минимум 1 платеж'),

    additionalInfo: z.string().optional(),

    discountPercent: z
      .number()
      .min(0, 'Скидка не может быть меньше 0%')
      .max(10, 'Скидка не может быть больше 10%'),

    media: z.object({
      tempPhotoIds: z.array(z.number()),
      tempVideoIds: z.array(z.number()),
    }),
  })
  .refine((data) => data.plotId !== null, {
    message: 'Выберите участок',
    path: ['plotId'],
  })
  .refine((data) => data.latitude !== null && data.longitude !== null, {
    message: 'Укажите местоположение на карте',
    path: ['latitude'],
  })

export type OrderFormModel = z.infer<typeof orderFormSchema>