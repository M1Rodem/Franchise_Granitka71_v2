'use client'

import { useState, useEffect, useRef } from 'react'
import { useFormContext } from 'react-hook-form'
import type { OrderFormModel } from '../order-form.schema'

import { mediaApi } from '@/shared/lib/media/api/media.api'
import { MediaPreviewModal } from '@/shared/lib/media/components/MediaPreviewModal'
import type { ViewerMediaDto } from '@/shared/lib/media/api/media.types'

import surface from '@/shared/ui/surface.module.css'
import layout from '@/shared/ui/form-layout.module.css'

type TempMedia = {
  id: number
  previewUrl: string
  name: string
  type: 'photo' | 'video'
}

interface Props {
  existing?: ViewerMediaDto[]
}

export function MediaSection({ existing = [] }: Props) {
  const { setValue } = useFormContext<OrderFormModel>()

  const [media, setMedia] = useState<TempMedia[]>(() =>
    existing.map((m) => ({
      id: m.id,
      previewUrl: m.url,
      name: m.originalFileName,
      type: m.mediaType === 1 ? 'video' : 'photo',
    }))
  )
  const [uploading, setUploading] = useState(false)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)

  const mediaRef = useRef<TempMedia[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    mediaRef.current = media
  }, [media])

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
            id: dto.id,
            previewUrl: dto.previewUrl,
            name: dto.originalFileName,
            type,
          } as TempMedia
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

  const removeFile = async (index: number) => {
    const item = media[index]

    try {
      await mediaApi.deleteTemp(item.id)
    } catch {}

    setMedia(prev => prev.filter((_, i) => i !== index))
  }

  useEffect(() => {
    const photoIds = media
      .filter(m => m.type === 'photo')
      .map(m => m.id)

    const videoIds = media
      .filter(m => m.type === 'video')
      .map(m => m.id)

    setValue('media.tempPhotoIds', photoIds, { shouldDirty: false })
    setValue('media.tempVideoIds', videoIds, { shouldDirty: false })

  }, [media])

  useEffect(() => {
    const handleUnload = () => {
      mediaRef.current.forEach(m => {
        fetch(`/api/media/temp/${m.id}`, {
          method: 'DELETE',
          keepalive: true,
        }).catch(() => {})
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
        mediaApi.deleteTemp(m.id).catch(() => {})
      })
    }
  }, [])

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
                  src={item.previewUrl}
                  alt={item.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '10px',
                  }}
                />
              ) : (
                <video
                  src={item.previewUrl}
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
                  removeFile(index)
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
                ✕
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