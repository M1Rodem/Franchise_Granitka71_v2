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
import { useAuthStore } from '@/shared/store/auth.store'
import { connectivityService } from '@/modules/offline/services/connectivity.service'
import {
  clearOfflineDraftLocalId,
  createOfflineOrderDraft,
  getOrCreateOfflineDraftLocalId,
  mapFormToOfflineCreatePayload,
} from '@/modules/offline/services/offline-order.service'
import { offlineRepository } from '@/modules/offline/repositories/offline.repository'
import { useOfflineSessionStore } from '@/modules/offline/store/offline-session.store'

interface OrderFormProviderProps {
  children: ReactNode
  mode?: 'create' | 'edit'
  initialValues?: OrderFormModel
  orderId?: number
  managerId?: number
}

interface OrderFormContextValue {
  mode: 'create' | 'edit'
  orderId?: number
  draftLocalId?: string
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
  managerId,
}: OrderFormProviderProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [isSaving, setIsSaving] = useState(false)
  const [allowNavigation, setAllowNavigation] = useState(false)
  const defaultValuesRef = useRef<OrderFormModel | null>(null)
  const draftLocalIdRef = useRef<string | undefined>(
    mode === 'create' ? getOrCreateOfflineDraftLocalId() : undefined
  )
  const currentUser = useAuthStore((s) => s.user)
  const [isCommentOpen, setIsCommentOpen] = useState(false)
  const [pendingValues, setPendingValues] = useState<OrderFormModel | null>(null)
  const offlineEmployee = useOfflineSessionStore((s) => s.currentEmployee)

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

  const { dirtyFields, isDirty, isSubmitting } = useFormState({
    control: methods.control
  })

  const currentDiscount = methods.getValues("discountPercent")
  const initialDiscount = defaultValues.discountPercent

  const isDiscountChanged =
    Number(currentDiscount) !== Number(initialDiscount)

  const hasRealChanges =
    Object.keys(dirtyFields).length > 0 || isDiscountChanged

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

    const hasDistanceReady = (works ?? []).some(
      w => w.isDistanceWork && Number(w.distanceKm) > 0
    )

    if (!hasDistanceReady) return

    const subtotal = (works ?? []).reduce((sum, w) => {
      if (w?.isDistanceWork) {
        const routes = Number(w?.routes) || 1
        const km = Number(w?.distanceKm) || 0
        const price = Number(w?.price) || 0
        return sum + price * routes * km
      }
      return sum + (Number(w?.price) || 0) * (Number(w?.quantity) || 0)
    }, 0)

    const discountAmount = subtotal * ((discountPercent ?? 0) / 100)
    const total = Math.max(0, subtotal - discountAmount)
    const advance = Math.round(total * 0.3)

    const advanceIndex = payments.findIndex(p => p?.paymentType === "Аванс")
    if (advanceIndex === -1) return

    const currentAdvance = payments[advanceIndex]?.amount

    if (currentAdvance === advance) return

    const fieldState = methods.getFieldState(`payments.${advanceIndex}.amount`)
    if (fieldState.isDirty) return

    methods.setValue(`payments.${advanceIndex}.amount`, advance, {
      shouldDirty: false
    })
  }, [works, discountPercent, payments, mode, methods])

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
        clearOfflineDraftLocalId()
        navigate(`/orders/${id}`)
      } else {
        clearOfflineDraftLocalId()
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

    const payload = mapFormToUpdateDto(
      pendingValues,
      dirtyFields,
      defaultValuesRef.current ?? undefined
    )

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
          // Проверяем оффлайн режим
          if (connectivityService.isOffline()) {
            const localId = draftLocalIdRef.current ?? crypto.randomUUID()

            if (!offlineEmployee) {
              showTempMessage('error', 'Не выбран сотрудник для оффлайн-создания')
              return
            }

            const offlineOrder = createOfflineOrderDraft({
              localId,
              payload: mapFormToOfflineCreatePayload(values),
              ownerUserId: offlineEmployee.id,
              ownerUsername: offlineEmployee.username,
              ownerFullName: offlineEmployee.fullName,
            })

            await offlineRepository.createOfflineOrder(offlineOrder)
            setAllowNavigation(true)
            showTempMessage('success', 'Заказ сохранен локально')
            clearOfflineDraftLocalId()
            navigate('/offline-orders')
            return
          }

          // Онлайн режим
          const payload = mapFormToCreateDto(values)
          await createMutation.mutateAsync(payload)
          return
        }

        if (mode === 'edit' && orderId) {
          if (!hasRealChanges) {
            showTempMessage('warning', 'Нет изменений для отправки')
            return
          }

          if (!currentUser) return

          const isOwnOrder = currentUser.id === managerId
          const isAdmin = currentUser.role === 'Admin' || currentUser.role === 'SuperAdmin'

          if (isOwnOrder || isAdmin) {
            const payload = mapFormToUpdateDto(
              values,
              dirtyFields,
              defaultValuesRef.current ?? undefined
            )

            await updateMutation.mutateAsync({
              id: orderId,
              payload,
            })
            return
          }

          // Только для чужих заказов
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
        orderId,
        draftLocalId: draftLocalIdRef.current
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

function mapFormToUpdateDto(values: OrderFormModel, _: any, defaultValues?: OrderFormModel) {
  const distanceItems = values.works.filter(w => w.isDistanceWork)

  if (distanceItems.length !== 1) {
    console.error('Distance work broken', distanceItems)
  }
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
  const worksChanged = values.works.some((w, i) => {
    const old = defaultValues?.works?.[i]
    if (!old) return true

    return (
      w.id !== old.id ||
      w.price !== old.price ||
      w.quantity !== old.quantity ||
      w.routes !== old.routes ||
      w.distanceKm !== old.distanceKm ||
      w.note !== old.note ||
      w.workDescription !== old.workDescription
    )
  })

  if (worksChanged) {
    payload.workItems = values.works.map((w) => {

      const isDistance = w.isDistanceWork === true

      if (isDistance) {
        return {
          id: w.id ?? 0,
          workDescription: w.workDescription,
          price: w.price,
          routes: w.routes ?? 1,
          distanceKm: w.distanceKm ?? 0,
          isDistanceWork: true,
          note: w.note,
        }
      }

      return {
        id: w.id ?? 0,
        workDescription: w.workDescription,
        price: w.price,
        quantity: w.quantity ?? 0,
        isDistanceWork: false,
        note: w.note,
      }
    })
  }

  const normalizeDate = (date: string | undefined) => {
    if (!date) return ''

    const d = new Date(date)

    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const normalizePayment = (p: any) => ({
    id: p.id ?? 0,
    amount: Number(p.amount ?? 0),
    paymentDate: normalizeDate(p.paymentDate),
    paymentType: p.paymentType ?? '',
    note: (p.note ?? '').trim(),
  })

  const paymentsChanged = (() => {
    const current = values.payments.map(normalizePayment)
    const initial = (defaultValues?.payments ?? []).map(normalizePayment)

    if (current.length !== initial.length) return true

    return current.some((p, i) => {
      const old = initial[i]

      return (
        p.id !== old.id ||
        p.amount !== old.amount ||
        p.paymentDate !== old.paymentDate ||
        p.paymentType !== old.paymentType ||
        p.note !== old.note
      )
    })
  })()

  if (paymentsChanged) {
    payload.payments = values.payments.map((p) => ({
      id: p.id ?? 0,
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


    workItems: values.works.map((w) => {
      const isDistance = w.isDistanceWork === true

      if (isDistance) {
        return {
          workDescription: w.workDescription,
          price: w.price,
          routes: w.routes ?? 1,
          distanceKm: w.distanceKm ?? 0,
          isDistanceWork: true,
          note: w.note,
        }
      }

      return {
        workDescription: w.workDescription,
        price: w.price,
        quantity: w.quantity ?? 0,
        isDistanceWork: false,
        note: w.note,
      }
    }),

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
