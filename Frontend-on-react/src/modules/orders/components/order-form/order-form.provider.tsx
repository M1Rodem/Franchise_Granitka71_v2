'use client'

import type { ReactNode } from 'react'
import { useContext, createContext, useEffect, useState, useRef } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useWatch } from "react-hook-form"
import { OrderCommentModal } from '@/modules/orders/components/OrderCommentModal'
import { orderFormSchema } from './order-form.schema'
import type { OrderFormModel } from './order-form.schema'
import { createOrderDefaultValues } from './order-form.types'

import { ordersApi } from '@/modules/orders/api/orders.api'
import { ordersKeys } from '@/modules/orders/lib/orders.keys'

import { showTempMessage } from '@/shared/ui/temp-message.service'
import { isAxiosError } from 'axios'
import { useUiStore } from '@/shared/store/ui.store'
import { useUnsavedChangesGuard } from '@/shared/hooks/useUnsavedChangesGuard'
import { useFormState } from "react-hook-form"
import type { OrderDetailsDto } from '@/modules/orders/types/orders.types'

interface OrderFormProviderProps {
  children: ReactNode
  mode?: 'create' | 'edit'
  initialValues?: OrderFormModel
  orderId?: number
}

interface OrderFormContextValue {
  mode: 'create' | 'edit'
  orderId?: number
}



const OrderFormContext = createContext<OrderFormContextValue | null>(null)

export function useOrderForm() {
  const ctx = useContext(OrderFormContext)

  if (!ctx) {
    throw new Error('useOrderForm must be used inside OrderFormProvider')
  }

  return ctx
}

export function OrderFormProvider({
  children,
  mode = 'create',
  initialValues,
  orderId,
}: OrderFormProviderProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [isSaving, setIsSaving] = useState(false)
  const [allowNavigation, setAllowNavigation] = useState(false)
  const defaultValuesRef = useRef<OrderFormModel | null>(null)

  const [isCommentOpen, setIsCommentOpen] = useState(false)
  const [pendingValues, setPendingValues] = useState<OrderFormModel | null>(null)

  if (!defaultValuesRef.current) {
    defaultValuesRef.current =
      mode === 'edit' && initialValues
        ? initialValues
        : createOrderDefaultValues()
  }

  const defaultValues = defaultValuesRef.current

  const methods = useForm<OrderFormModel>({
    resolver: zodResolver(orderFormSchema),
    defaultValues,
    mode: "onChange",
    shouldUnregister: false
  })

  const works = useWatch({
    control: methods.control,
    name: "works"
  })

  const discountPercent = useWatch({
    control: methods.control,
    name: "discountPercent"
  })

  const payments = useWatch({
    control: methods.control,
    name: "payments"
  })

  const advanceManuallyEditedRef = useRef(false)

  const { dirtyFields, isDirty, isSubmitting } = useFormState({
    control: methods.control
  })

  const hasRealChanges =
    Object.keys(dirtyFields).length > 0
  
  const shouldBlock = hasRealChanges && !isSaving

  useUnsavedChangesGuard(shouldBlock && !allowNavigation)

  const setHeaderSubmitDisabled = useUiStore((s) => s.setHeaderSubmitDisabled)

  useEffect(() => {
    const disabled =
      mode === "create"
        ? !isDirty || isSubmitting
        : !hasRealChanges || isSubmitting

    setHeaderSubmitDisabled(disabled)

  }, [mode, isDirty, hasRealChanges, isSubmitting, dirtyFields])

  useEffect(() => {

    if (mode !== "create") return
    if (!payments?.length) return

    const subtotal = (works ?? []).reduce(
      (sum, w) =>
        sum +
        (Number(w?.price) || 0) *
        (Number(w?.quantity) || 0),
      0
    )

    const discountAmount =
      subtotal * ((discountPercent ?? 0) / 100)

    const total = subtotal - discountAmount

    const advance = Math.round(total * 0.3)

    const advanceIndex = payments.findIndex(
      (p) => p?.paymentType === "Аванс"
    )

    if (advanceIndex === -1) return

    const isDirty =
      dirtyFields?.payments?.[advanceIndex]?.amount

    if (isDirty) return

    methods.setValue(
      `payments.${advanceIndex}.amount`,
      advance,
      { shouldDirty: false }
    )

  }, [works, discountPercent])

  useEffect(() => {

    if (mode !== "create") return

    const advanceIndex = payments?.findIndex(
      (p) => p?.paymentType === "Аванс"
    )

    if (advanceIndex === -1) return

    const subtotal = (works ?? []).reduce(
      (sum, w) =>
        sum +
        (Number(w?.price) || 0) *
        (Number(w?.quantity) || 0),
      0
    )

    const discountAmount =
      subtotal * ((discountPercent ?? 0) / 100)

    const total = subtotal - discountAmount

    const autoAdvance =
      Math.round(total * 0.3)

    const current =
      payments?.[advanceIndex]?.amount

    if (current !== autoAdvance) {
      advanceManuallyEditedRef.current = true
    }

  }, [payments])
  
  const createMutation = useMutation({
    mutationFn: ordersApi.createOrder,
    onSuccess: (order: any) => {

      queryClient.invalidateQueries({
        queryKey: ordersKeys.all,
      })

      showTempMessage('success', 'Заказ успешно создан')

      const id =
        order?.id ??
        order?.Id ??
        order?.orderId ??
        order?.OrderId

      if (id) {
        navigate(`/orders/${id}`)
      } else {
        navigate('/orders')
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      ordersApi.updateOrder(id, payload),

    onSuccess: (response) => {
      setAllowNavigation(true)

      const isRequestResponse = (response as any)?.success === true && 
                                (response as any)?.message === "Запрос на изменение отправлен"

      if (isRequestResponse) {
        showTempMessage('info', 'Запрос на изменение отправлен. Ожидайте подтверждения.')
        navigate(`/orders/${orderId}`)
        return
      }

      const order = response as OrderDetailsDto

      queryClient.setQueryData(
        ordersKeys.byId(order.id),
        order
      )

      queryClient.invalidateQueries({
        queryKey: ordersKeys.all,
      })

      showTempMessage('success', 'Заказ обновлен')

      navigate(`/orders/${order.id}`)
    },
    
    onError: (error: any) => {
      if (isAxiosError(error)) {
        const message = (error.response?.data as any)?.message ?? 'Ошибка при обновлении заказа'
        showTempMessage('error', message)
      } else {
        showTempMessage('error', 'Ошибка при обновлении заказа')
      }
    }
  })

  const handleConfirmComment = async (comment?: string) => {
    if (!pendingValues || !orderId) return

    setIsSaving(true)

    const payload = mapFormToUpdateDto(pendingValues, dirtyFields)

    try {
      await updateMutation.mutateAsync({
        id: orderId,
        payload: {
          ...payload,
          ChangeComment: comment?.trim() ? comment : undefined,
        },
      })

      setAllowNavigation(true)

      setIsCommentOpen(false)
      setPendingValues(null)

    } finally {
      setIsSaving(false)
    }
  }

  const onSubmit = methods.handleSubmit(
    async (values: OrderFormModel) => {
      setIsSaving(true)

      try {
        if (mode === 'create') {
          const payload = mapFormToCreateDto(values)
          await createMutation.mutateAsync(payload)
        }

        if (mode === 'edit' && orderId) {
          if (!hasRealChanges) {
            showTempMessage('warning', 'Нет изменений для отправки')
            return
          }

          setPendingValues(values)
          setIsCommentOpen(true)
          return
        }
      } catch (error) {
        console.error('Submit error:', error)
      } finally {
        setIsSaving(false)
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
    <OrderFormContext.Provider
      value={{
        mode,
        orderId
      }}
    >
      <FormProvider {...methods}>
        <form id="order-form" onSubmit={onSubmit} noValidate>
          <OrderCommentModal
            isOpen={isCommentOpen}
            onClose={() => setIsCommentOpen(false)}
            onConfirm={handleConfirmComment}
            isLoading={updateMutation.isPending}
          />
          {children}
        </form>
      </FormProvider>
    </OrderFormContext.Provider>
  )
}

function mapFormToUpdateDto(values: OrderFormModel, dirtyFields: any) {
  const payload: any = {
    // Основные поля всегда отправляем
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

    discountPercent: values.discountPercent,

    tempPhotoIds: values.media.tempPhotoIds,
    tempVideoIds: values.media.tempVideoIds,
    removedPhotoIds: values.media.removedPhotoIds,
    removedVideoIds: values.media.removedVideoIds,
  }

  if (dirtyFields?.works) {
    payload.workItems = values.works.map((w) => ({
      workDescription: w.workDescription,
      price: w.price,
      quantity: w.quantity,
      note: w.note,
    }))
  }

  if (dirtyFields?.payments) {
    payload.payments = values.payments.map((p) => ({
      amount: p.amount,
      paymentDate: p.paymentDate,
      paymentType: p.paymentType,
      note: p.note,
    }))
  }

  return payload
}

function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '')

  if (digits.startsWith('8') && digits.length === 11) {
    digits = '7' + digits.slice(1)
  }

  return digits
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

    discountPercent: values.discountPercent,

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