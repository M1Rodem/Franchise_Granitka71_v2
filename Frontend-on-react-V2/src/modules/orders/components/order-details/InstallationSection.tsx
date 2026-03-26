import surface from '@/shared/ui/surface.module.css'
import layout from '@/shared/ui/form-layout.module.css'
import button from '@/shared/ui/button.module.css'
import { OrderMapPlaceholder } from './OrderMapPlaceholder'

interface Props {
  plotName?: string | null
  place: string
  inspectionPlace: string
  latitude?: number | null
  longitude?: number | null
  distanceKm?: number | null
  plotCoordinates: [number, number] | null
  destinationCoordinates: [number, number] | null
}

export function InstallationSection({
  plotName,
  inspectionPlace,
  distanceKm,
  plotCoordinates,
  destinationCoordinates,
}: Props) {
  const hasNavigatorRoute =
    plotCoordinates &&
    destinationCoordinates

  const navigatorUrl = hasNavigatorRoute
    ? `https://yandex.ru/maps/?rtext=` +
      `${plotCoordinates[0]},${plotCoordinates[1]}` +
      `~${destinationCoordinates[0]},${destinationCoordinates[1]}`
    : null

  return (
    <section className={surface.surface}>
      <h2 className={surface.sectionTitle}>Место установки</h2>

      <div className={layout.grid2}>
        <div className={layout.field}>
          <span className={layout.label}>Участок</span>
          <span className={layout.value}>{plotName ?? '—'}</span>
        </div>

        <div className={layout.field}>
          <span className={layout.label}>Место смотрел</span>
          <span className={layout.value}>{inspectionPlace}</span>
        </div>

        <div className={layout.field}>
          <span className={layout.label}>Расстояние</span>
          <span className={layout.value}>
            {typeof distanceKm === 'number'
              ? `${distanceKm} км`
              : '—'}
          </span>
        </div>
      </div>

      {navigatorUrl && (
        <a
          href={navigatorUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${button.navigatorButton}`}
        >
          Открыть в Яндекс.Навигаторе
        </a>
      )}

      <OrderMapPlaceholder
        plotCoordinates={plotCoordinates}
        destinationCoordinates={destinationCoordinates}
      />
    </section>
  )
}
