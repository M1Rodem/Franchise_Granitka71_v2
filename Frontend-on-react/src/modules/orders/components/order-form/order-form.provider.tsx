'use client'

import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { orderFormSchema } from './order-form.schema'
import type { OrderFormModel } from './order-form.schema'
import { createOrderDefaultValues } from './order-form.types'

import { ordersApi } from '@/modules/orders/api/orders.api'
import { ordersKeys } from '@/modules/orders/lib/orders.keys'

import { showTempMessage } from '@/shared/ui/temp-message.service'
import { isAxiosError } from 'axios'

interface OrderFormProviderProps {
  children: ReactNode
  mode?: 'create' | 'edit'
  initialValues?: OrderFormModel
  orderId?: number
}

export function OrderFormProvider({
  children,
  mode = 'create',
  initialValues,
}: OrderFormProviderProps) {

  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const defaultValues = useMemo(() => {
    if (mode === 'edit' && initialValues) {
      return initialValues
    }
    return createOrderDefaultValues()
  }, [mode, initialValues])

  const methods = useForm<OrderFormModel>({
    resolver: zodResolver(orderFormSchema),
    defaultValues,
    mode: 'onSubmit',
  })

  const createMutation = useMutation({
    mutationFn: ordersApi.createOrder,
    onSuccess: (order: any) => {

      queryClient.invalidateQueries({
        queryKey: ordersKeys.all,
      })

      showTempMessage('success', 'Заказ успешно создан')

      // redirect на страницу просмотра заказа
      if (order?.id) {
        navigate(`/orders/${order.id}`)
      }
    },
  })

  const onSubmit = methods.handleSubmit(
    async (values) => {
      try {

        if (mode === 'create') {

          const payload = mapFormToCreateDto(values)

          await createMutation.mutateAsync(payload)

        }

      } catch (error) {

        if (isAxiosError(error)) {

          const message =
            (error.response?.data as any)?.message ??
            'Ошибка при создании заказа'

          showTempMessage('error', message)
          return

        }

        showTempMessage('error', 'Ошибка при создании заказа')

      }
    },
    (formErrors) => {

      const firstError = getFirstErrorMessage(formErrors)

      if (firstError) {
        showTempMessage('error', firstError)
      } else {
        showTempMessage('error', 'Проверьте корректность заполнения формы')
      }

    }
  )

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit} noValidate>
        {children}
      </form>
    </FormProvider>
  )
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

function mapFormToCreateDto(values: OrderFormModel) {
  return {

    place: values.inspectionPlace,
    inspectionPlace: values.inspectionPlace,
    orderDate: values.orderDate,
    latitude: values.latitude,
    longitude: values.longitude,
    plotId: values.plotId,

    deceasedFullName: values.deceasedFullName,

    customerFullName: values.client.fullName,
    customerEmail: values.client.email || null,
    phone: normalizePhone(values.client.phone),
    address: values.client.address,

    monumentType: values.monument.type,
    monumentSize: values.monument.size,
    additionalInfo: values.additionalInfo,

    totalPrice: values.works.reduce(
      (sum, w) => sum + w.price * w.quantity,
      0
    ),

    workItems: values.works.map((w) => ({
      workDescription: w.workDescription,
      price: w.price,
      quantity: w.quantity,
      note: w.note,
    })),

    payments: values.payments.map((p) => ({
      amount: p.amount,
      paymentDate: p.paymentDate,
      paymentType: p.paymentType,
      note: p.note,
    })),

    tempPhotoIds: values.media.tempPhotoIds,
    tempVideoIds: values.media.tempVideoIds,
  }
}

function getFirstErrorMessage(errors: any): string | null {

  for (const key in errors) {

    const value = errors[key]

    if (!value) continue

    if (typeof value.message === 'string') {
      return value.message
    }

    if (typeof value === 'object') {

      const nested = getFirstErrorMessage(value)

      if (nested) return nested

    }

  }

  return null
}