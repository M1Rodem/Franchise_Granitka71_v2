'use client'

import { useState, useEffect, useRef } from 'react'
import { useFormContext } from 'react-hook-form'
import type { OrderFormModel } from '../order-form.schema'
import { httpClient } from '@/shared/api/http-client'
import { loadMedia } from '@/shared/lib/media/utils/media-loader'
import { AppIcon } from '@/shared/ui/AppIcon'

import { mediaApi } from '@/shared/lib/media/api/media.api'
import { MediaPreviewModal } from '@/shared/lib/media/components/MediaPreviewModal'
import type { ViewerMediaDto } from '@/shared/lib/media/api/media.types'

import surface from '@/shared/ui/surface.module.css'
import layout from '@/shared/ui/form-layout.module.css'

type MediaItem =
  | {
      kind: 'temp'
      id: number
      previewUrl: string
      name: string
      type: 'photo' | 'video'
      markedForDelete?: boolean
      uploading?: boolean
    }
  | {
      kind: 'existing'
      id: number
      previewUrl: string
      name: string
      type: 'photo' | 'video'
      markedForDelete?: boolean
    }

interface Props {
  existing?: ViewerMediaDto[]
}

export function MediaSection({ existing = [] }: Props) {
  const { setValue } = useFormContext<OrderFormModel>()

  const [media, setMedia] = useState<MediaItem[]>(() =>
    existing.map((m) => ({
      kind: 'existing',
      id: m.id,
      previewUrl: m.url,
      name: m.originalFileName,
      type: m.mediaType === 1 ? 'video' : 'photo',
    }))
  )
  const [uploading, setUploading] = useState(false)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)

  const mediaRef = useRef<MediaItem[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  
  const [removedPhotos] = useState<number[]>([])
  const [removedVideos] = useState<number[]>([])

  const [previewUrls, setPreviewUrls] = useState<Record<number, string>>({})

  const isEditMode = existing.length > 0

  useEffect(() => {
    mediaRef.current = media
  }, [media, removedPhotos, removedVideos])

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return

    const files = Array.from(fileList)

    setUploading(true)

    try {
      const uploads = await Promise.all(
        files.map(async (file) => {
          const type = file.type.startsWith('video')
            ? 'video'
            : 'photo'

          const dto = await mediaApi.uploadTemp(file, type)

          return {
            kind: 'temp',
            id: dto.id,
            previewUrl: dto.previewUrl,
            name: dto.originalFileName,
            type,
            uploading: false
          } as MediaItem
        })
      )

      setMedia(prev => [...prev, ...uploads])
    } finally {
      setUploading(false)

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDelete = async (index: number) => {

    const item = media[index]

    // CREATE ORDER — удаляем сразу
    if (!isEditMode) {

      if (item.kind === 'temp') {
        await mediaApi.deleteTemp(item.id).catch(() => {})
      }

      setMedia(prev => prev.filter((_, i) => i !== index))

      return
    }

    // EDIT ORDER — soft delete
    setMedia(prev =>
      prev.map((m, i) =>
        i === index
          ? { ...m, markedForDelete: !m.markedForDelete }
          : m
      )
    )
  }

  useEffect(() => {
    const photoIds = media
      .filter(m => m.kind === 'temp' && m.type === 'photo')
      .map(m => m.id)

    const videoIds = media
      .filter(m => m.kind === 'temp' && m.type === 'video')
      .map(m => m.id)

    const removedPhotos = media
      .filter(m => m.kind === 'existing' && m.type === 'photo' && m.markedForDelete)
      .map(m => m.id)

    const removedVideos = media
      .filter(m => m.kind === 'existing' && m.type === 'video' && m.markedForDelete)
      .map(m => m.id)

    setValue('media.tempPhotoIds', photoIds, { shouldDirty: true })
    setValue('media.tempVideoIds', videoIds, { shouldDirty: true })
    setValue('media.removedPhotoIds', removedPhotos, { shouldDirty: true })
    setValue('media.removedVideoIds', removedVideos, { shouldDirty: true })
  }, [media, removedPhotos, removedVideos])

  useEffect(() => {
    const handleUnload = () => {
      mediaRef.current.forEach(m => {
        if (
          m.kind === 'temp' &&
          !m.uploading &&
          m.markedForDelete
        ) {
          httpClient.delete(`/api/media/temp/${m.id}`)
        }
      })
    }

    window.addEventListener('beforeunload', handleUnload)

    return () => {
      window.removeEventListener('beforeunload', handleUnload)
    }
  }, [])

  useEffect(() => {
    return () => {

      mediaRef.current.forEach(m => {

        if (m.kind !== 'temp') return

        if (m.uploading) return

        if (m.markedForDelete) {
          mediaApi.deleteTemp(m.id).catch(() => {})
        }

      })

    }
  }, [])

  useEffect(() => {

    media.forEach((m) => {

      if (previewUrls[m.id]) return

      loadMedia(m.previewUrl).then((url) => {

        if (!url) return

        setPreviewUrls((prev) => ({
          ...prev,
          [m.id]: url,
        }))

      })

    })

  }, [media])

  const previewItems: ViewerMediaDto[] = media.map((m) => ({
    id: m.id,
    url: m.previewUrl,
    originalFileName: m.name,
    mediaType: m.type === 'video' ? 1 : 0,
  }))

  return (
    <div className={surface.surface}>
      <h2 className={surface.sectionTitle}>
        Медиафайлы
      </h2>

      <div className={layout.field}>
        <label className={layout.label}>
          Загрузить файлы
        </label>

        <label
          style={{
            padding: '24px',
            borderRadius: '14px',
            border: '1px dashed rgba(126,164,220,0.35)',
            textAlign: 'center',
            cursor: 'pointer',
            background: 'rgba(10,29,57,0.4)',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />

          {uploading
            ? 'Загрузка...'
            : 'Перетащите файлы или нажмите для выбора'}
        </label>
      </div>

      {media.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill,120px)',
            gap: '12px',
          }}
        >
          {media.map((item, index) => (
            <div
              key={item.id}
              onClick={() => setPreviewIndex(index)}
              style={{
                position: 'relative',
                width: '120px',
                height: '120px',
                cursor: 'pointer'
              }}
            >
              {item.type === 'photo' ? (
                <img
                  src={previewUrls[item.id]}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '10px',
                    filter:
                      isEditMode && item.markedForDelete
                        ? 'grayscale(1) opacity(0.45)'
                        : 'none'
                  }}
                />
              ) : (
                <video
                  src={previewUrls[item.id]}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '10px',
                  }}
                />
              )}

              <button
                type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(index)
                  }}
                style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  color: '#fff',
                  background: 'rgba(0,0,0,0.55)',
                  backdropFilter: 'blur(6px)',
                  transition: 'all 0.15s ease',
                }}
              >
                <AppIcon
                  name={item.markedForDelete ? 'check' : 'close'}
                  className="media-delete-icon"
                />
              </button>
            </div>
          ))}
        </div>
      )}

      <MediaPreviewModal
        items={previewItems}
        index={previewIndex}
        onClose={() => setPreviewIndex(null)}
        onNavigate={(i) => setPreviewIndex(i)}
      />
    </div>
  )
}