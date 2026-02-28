'use client'

import { useFormContext, Controller } from 'react-hook-form'
import { usePlots } from '@/modules/plots/hooks/use-plots'
import { AnimatedSelect } from '@/shared/ui/AnimatedSelect'
import type { OrderFormModel } from '../order-form.schema'

import surface from '@/shared/ui/surface.module.css'
import layout from '@/shared/ui/form-layout.module.css'
import input from '@/shared/ui/input.module.css'
import button from '@/shared/ui/button.module.css'
import styles from './location-section.module.css'

export function LocationSection() {
  const {
    register,
    control,
  } = useFormContext<OrderFormModel>()

  const { data: plots } = usePlots()

  const plotOptions =
    plots?.map(p => ({
      value: String(p.id),
      label: p.name,
    })) ?? []

  return (
    <div className={surface.surface}>
      <h2 className={surface.sectionTitle}>
        Местоположение
      </h2>

      <div className={layout.grid2}>

        {/* Место осмотра */}
        <div className={layout.field}>
          <label className={layout.label}>
            Место осмотрел *
          </label>
          <input
            {...register('inspectionPlace')}
            className={input.input}
          />
        </div>

        {/* Участок */}
        <div className={layout.field}>
          <label className={layout.label}>
            Участок *
          </label>

          <Controller
            control={control}
            name="plotId"
            render={({ field }) => (
              <AnimatedSelect
                value={field.value ? String(field.value) : ''}
                options={plotOptions}
                onChange={(val) => field.onChange(Number(val))}
              />
            )}
          />
        </div>

      </div>

      {/* Placeholder карты */}
      <div className={layout.field}>
        <label className={layout.label}>
          Местоположение на карте *
        </label>

      <div className={styles.mapBlock}>
        <div className={surface.surfaceCompact}>
          Карта будет подключена здесь
        </div>
      </div>
      </div>

      <button
        type="button"
        className={`${button.btn} ${button.btnSecondary}`}
        disabled
      >
        Открыть в навигаторе
      </button>
    </div>
  )
}