import { useRef } from 'react'
import { mediaApi } from '@/shared/lib/media/api/media.api'
import { showTempMessage } from '@/shared/ui/temp-message.service'
import styles from './completion.module.css'
import type { TempCompletionMedia } from './completion.types'
import { useState } from 'react'
import {
  MediaPreviewModal,
} from '@/shared/lib/media/components/MediaPreviewModal'
import { AppIcon } from '@/shared/ui/AppIcon'
import button from '@/shared/ui/button.module.css'

interface Props {
  items: TempCompletionMedia[]
  onChange: (items: TempCompletionMedia[]) => void
}

export function CompletionMediaUploader({
  items,
  onChange,
}: Props) {
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const videoInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  async function uploadVideo(file: File) {
    if (items.some(x => x.mediaType === 1)) {
      showTempMessage('error', 'Максимум 1 видео')
      return
    }

    const uploaded = await mediaApi.uploadTemp(file, 'video')

    onChange([
      ...items,
      {
        tempId: uploaded.id,
        fileName: uploaded.originalFileName,
        previewUrl: uploaded.previewUrl || uploaded.url || '',
        mediaType: 1,
        size: uploaded.size,
        width: uploaded.width,
        height: uploaded.height,
      },
    ])
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const existingPhotos = items.filter(x => x.mediaType === 0).length
    const availableSlots = 3 - existingPhotos

    if (availableSlots <= 0) {
      showTempMessage('error', 'Максимум 3 фото')
      return
    }

    const filesToUpload = files.slice(0, availableSlots)
    const uploadedItems: TempCompletionMedia[] = []

    for (const file of filesToUpload) {
      try {
        const uploaded = await mediaApi.uploadTemp(file, 'photo')
        uploadedItems.push({
          tempId: uploaded.id,
          fileName: uploaded.originalFileName,
          previewUrl: uploaded.previewUrl || uploaded.url || '',
          mediaType: 0,
          size: uploaded.size,
          width: uploaded.width,
          height: uploaded.height,
        })
      } catch {
        showTempMessage('error', `Ошибка загрузки ${file.name}`)
      }
    }

    onChange([...items, ...uploadedItems])

    if (files.length > availableSlots) {
      showTempMessage('error', 'Максимум 3 фото')
    }

    e.target.value = ''
  }

  async function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadVideo(file)
  }

  async function removeItem(tempId: number) {
    try {
      await mediaApi.deleteTemp(tempId)
      onChange(items.filter(x => x.tempId !== tempId))
      
      // Сбрасываем инпуты
      if (photoInputRef.current) photoInputRef.current.value = ''
      if (videoInputRef.current) videoInputRef.current.value = ''
    } catch (error) {
      console.error('Failed to delete temp file:', error)
      showTempMessage('error', 'Не удалось удалить файл')
    }
  }

  const photosCount = items.filter(x => x.mediaType === 0).length
  const canAddPhotos = photosCount < 3

  return (
    <div className={styles.section}>
      <div className={styles.uploadGrid}>
        {items.map((item, index) => (
          <div
            key={item.tempId}
            className={styles.previewCard}
            onClick={() => setSelectedIndex(index)}
          >
            {item.mediaType === 1 ? (
              <video
                src={item.previewUrl}
                className={styles.previewImage}
              />
            ) : (
              <img
                src={item.previewUrl}
                alt=""
                className={styles.previewImage}
              />
            )}

            <button
              type="button"
              className={styles.removeButton}
              onClick={(e) => {
                e.stopPropagation()
                removeItem(item.tempId)
              }}
            >
              <AppIcon name="close" className={styles.removeIcon} />
            </button>
          </div>
        ))}

        {canAddPhotos && (
          <button
            type="button"
            className={`${button.btn} ${button.btnSecondary} ${styles.uploadButton}`}
            onClick={() => photoInputRef.current?.click()}
          >
            + Фото
          </button>
        )}

        {!items.some(x => x.mediaType === 1) && (
          <button
            type="button"
            className={`${button.btn} ${button.btnSecondary} ${styles.uploadButton}`}
            onClick={() => videoInputRef.current?.click()}
          >
            + Видео
          </button>
        )}
      </div>

      <input
        multiple
        type="file"
        accept="image/*"
        ref={photoInputRef}
        className={styles.hiddenInput}
        onChange={handlePhotoSelect}
      />

      <input
        type="file"
        accept="video/*"
        ref={videoInputRef}
        className={styles.hiddenInput}
        onChange={handleVideoSelect}
      />

      <MediaPreviewModal
        items={items.map(item => ({
          id: item.tempId,
          url: item.previewUrl,
          originalFileName: item.fileName,
          mediaType: item.mediaType,
        }))}
        index={selectedIndex}
        onClose={() => setSelectedIndex(null)}
        onNavigate={(index) => setSelectedIndex(index)}
      />
    </div>
  )
}