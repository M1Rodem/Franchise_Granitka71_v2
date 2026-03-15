import layout from '@/shared/ui/form-layout.module.css'

interface Props {
  field: string
  oldValue: unknown
  newValue: unknown
}

export function NotificationFieldDiff({
  field,
  oldValue,
  newValue
}: Props) {

  return (
    <div className={layout.field}>

      <div className={layout.label}>
        {field}
      </div>

      <div className={layout.value}>
        {String(oldValue ?? '—')} → {String(newValue ?? '—')}
      </div>

    </div>
  )
}