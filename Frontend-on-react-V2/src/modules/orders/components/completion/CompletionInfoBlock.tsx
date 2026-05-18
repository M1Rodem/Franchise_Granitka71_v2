import surface from '@/shared/ui/surface.module.css'
import layout from '@/shared/ui/form-layout.module.css'

import { StatusBadge } from '@/shared/ui/status'
import { MediaGallery } from '@/shared/lib/media'

import type { OrderCompletionDto } from '@/modules/orders/types/orders.types'

import { getCompletionStatusInfo } from './completion-status'

import styles from './completion.module.css'

interface Props {
  completion: OrderCompletionDto
}

function formatDate(
  date?: string | null
) {
  if (!date) {
    return '—'
  }

  return new Date(date)
    .toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
}

export function CompletionInfoBlock({
  completion,
}: Props) {

  const completionStatus =
    getCompletionStatusInfo(
      completion.status
    )

  return (
    <section className={surface.surface}>

      {/* HEADER */}

      <div className={layout.headerRow}>

        <h2 className={surface.sectionTitle}>
          Проверка выполнения
        </h2>

        <StatusBadge
          style={completionStatus.style}
        >
          {completionStatus.label}
        </StatusBadge>

      </div>

      {/* INFO */}

      <div className={layout.grid2}>

        <div className={layout.field}>
          <span className={layout.label}>
            Отправил
          </span>

          <span className={layout.value}>
            {completion.submittedBy}
          </span>
        </div>

        <div className={layout.field}>
          <span className={layout.label}>
            Дата отправки
          </span>

          <span className={layout.value}>
            {formatDate(
              completion.submittedAt
            )}
          </span>
        </div>

        {completion.reviewedBy && (
          <div className={layout.field}>
            <span className={layout.label}>
              Проверил
            </span>

            <span className={layout.value}>
              {completion.reviewedBy}
            </span>
          </div>
        )}

        {completion.reviewedAt && (
          <div className={layout.field}>
            <span className={layout.label}>
              Дата проверки
            </span>

            <span className={layout.value}>
              {formatDate(
                completion.reviewedAt
              )}
            </span>
          </div>
        )}

      </div>

      {/* EXECUTOR COMMENT */}

      {completion.submittedNote && (
        <div className={styles.commentBlock}>

          <div className={styles.commentLabel}>
            Сообщение исполнителя
          </div>

          <div className={styles.commentText}>
            {completion.submittedNote}
          </div>

        </div>
      )}

      {/* REVIEW COMMENT */}

      {completion.reviewComment && (
        <div className={styles.commentBlock}>

          <div className={styles.commentLabel}>
            Комментарий SuperAdmin
          </div>

          <div className={styles.commentText}>
            {completion.reviewComment}
          </div>

        </div>
      )}

      {/* MEDIA */}

      <div className={styles.mediaSection}>

        <div className={styles.mediaHeader}>
          Медиа выполнения
        </div>

        <MediaGallery
          items={completion.media}
        />

      </div>

    </section>
  )
}