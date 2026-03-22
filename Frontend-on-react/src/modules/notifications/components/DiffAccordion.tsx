import { useState } from 'react'
import type { NotificationChangesDto } from '../types/notifications.types'
import surfaceStyles from '@/shared/ui/surface.module.css'

import { TextFieldDiff } from './fields/TextFieldDiff'
import { MapDiff } from './fields/MapDiff'
import { WorksDiff } from './fields/WorksDiff'
import { PaymentsDiff } from './fields/PaymentsDiff'
import { MediaDiff } from './fields/MediaDiff'

interface Props {
  changes: NotificationChangesDto
}

export function DiffAccordion({ changes }: Props) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())

  console.log('[Notifications DEBUG] diff render', changes)

  const toggle = (key: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev)

      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* MAIN INFO */}
      {changes.mainInfo?.length ? (
        <AccordionItem
          title="Основная информация"
          count={changes.mainInfo.length}
          isOpen={openSections.has('main')}
          onClick={() => toggle('main')}
        >
          <TextFieldDiff title="" items={changes.mainInfo} />
        </AccordionItem>
      ) : null}

      {/* CLIENT */}
      {changes.client?.length ? (
        <AccordionItem
          title="Клиент"
          count={changes.client.length}
          isOpen={openSections.has('client')}
          onClick={() => toggle('client')}
        >
          <TextFieldDiff title="" items={changes.client} />
        </AccordionItem>
      ) : null}

      {/* MAP */}
      {changes.map ? (
        <AccordionItem
          title="Карта"
          count={1}
          isOpen={openSections.has('map')}
          onClick={() => toggle('map')}
        >
          <MapDiff data={changes.map} />
        </AccordionItem>
      ) : null}

      {/* WORKS */}
      {changes.works ? (
        <AccordionItem
          title="Работы"
          count={changes.works.newWorks.length}
          isOpen={openSections.has('works')}
          onClick={() => toggle('works')}
        >
          <WorksDiff data={changes.works} />
        </AccordionItem>
      ) : null}

      {/* PAYMENTS */}
      {changes.payments ? (
        <AccordionItem
          title="Платежи"
          count={changes.payments.newPayments.length}
          isOpen={openSections.has('payments')}
          onClick={() => toggle('payments')}
        >
          <PaymentsDiff data={changes.payments} />
        </AccordionItem>
      ) : null}

      {/* MEDIA */}
      {changes.media ? (
        <AccordionItem
          title="Медиа"
          count={
            changes.media.addedMedia.length +
            changes.media.deletedMedia.length
          }
          isOpen={openSections.has('media')}
          onClick={() => toggle('media')}
        >
          <MediaDiff data={changes.media} />
        </AccordionItem>
      ) : null}
    </div>
  )
}

interface ItemProps {
  title: string
  count: number
  isOpen: boolean
  onClick: () => void
  children: React.ReactNode
}

function AccordionItem({
  title,
  count,
  isOpen,
  onClick,
  children,
}: ItemProps) {
  return (
    <div>
      <div
        className={surfaceStyles.surface}
        style={{
          cursor: 'pointer',
          padding: '16px 20px',
        }}
        onClick={onClick}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>
            {title} ({count})
          </span>

          <span>{isOpen ? '▲' : '▼'}</span>
        </div>
      </div>

      {isOpen && (
        <div style={{ marginTop: 8 }}>
          {children}
        </div>
      )}
    </div>
  )
}