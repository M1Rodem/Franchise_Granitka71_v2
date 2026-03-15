import { useState } from 'react'
import { NotificationFieldDiff } from './NotificationFieldDiff'
import type { NotificationProposedChanges } from '../types/notification.types'

interface Props {
  changes: NotificationProposedChanges
}

export function NotificationDiffBlock({ changes }: Props) {

  const [open, setOpen] = useState(false)

  const entries = Object.entries(changes)

  if (entries.length === 0) return null

  return (
    <div>

      <button
        onClick={() => setOpen(v => !v)}
      >
        {open ? '▼' : '▶'} Изменения
      </button>

      {open && (

        <div style={{ marginTop: 10 }}>

          {entries.map(([field, value]) => (

            <NotificationFieldDiff
              key={field}
              field={field}
              oldValue={value.old}
              newValue={value.new}
            />

          ))}

        </div>

      )}

    </div>
  )
}