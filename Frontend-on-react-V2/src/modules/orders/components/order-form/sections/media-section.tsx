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
import { showTempMessage } from '@/shared/ui/temp-message.service'
import { connectivityService } from '@/modules/offline/services/connectivity.service'
import { offlineMediaRepository } from '@/modules/offline/repositories/offline-media.repository'
import { createOfflineMedia } from '@/modules/offline/services/offline-media.service'
import { useOrderForm } from '../order-form.provider'

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
    isOriginal?: boolean
  }
  | {
    kind: 'existing'
    id: number
    previewUrl: string
    name: string
    type: 'photo' | 'video'
    markedForDelete?: boolean
    isOriginal?: boolean
  }
  | {
    kind: 'offline'
    id: string
    previewUrl: string
    name: string
    type: 'photo' | 'video'
    markedForDelete?: boolean
    isOriginal?: boolean
  }

type OriginalItem = {
  id: number
  tempId: number
  name: string
  size: number
  previewUrl: string
  uploadedAt: string
  markedForDelete?: boolean
  isNew?: boolean
}

interface Props {
  existing?: ViewerMediaDto[]
}


export function MediaSection({ existing = [] }: Props) {
  const { setValue,  } = useFormContext<OrderFormModel>()
  const { mode, draftLocalId, orderId } = useOrderForm()

  // Инициализация media (только обычные фото)
  const [media, setMedia] = useState<MediaItem[]>(() =>
    existing
      .filter((m) => !m.isOriginal)
      .map((m) => ({
        kind: 'existing',
        id: m.id,
        previewUrl: m.url,
        name: m.originalFileName,
        type: m.mediaType === 1 ? 'video' : 'photo',
        isOriginal: false,
      }))
  )

  const [originals, setOriginals] = useState<OriginalItem[]>(() =>
    existing
      .filter((m) => m.isOriginal)
      .map((m) => ({
        id: m.id,
        tempId: m.id,
        name: m.originalFileName,
        size: 0,
        previewUrl: m.url,
        uploadedAt: new Date().toISOString(),
        isNew: false,
      }))
  )

  const [uploading, setUploading] = useState(false)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)

  const mediaRef = useRef<MediaItem[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const originalFileInputRef = useRef<HTMLInputElement | null>(null)

  const [removedPhotos] = useState<number[]>([])
  const [removedVideos] = useState<number[]>([])

  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})

  // Состояние для оригинальных фото
  const [uploadingOriginal, setUploadingOriginal] = useState(false)

  const isEditMode = existing.length > 0

  useEffect(() => {
    mediaRef.current = media
  }, [media, removedPhotos, removedVideos])

  useEffect(() => {
    if (mode !== 'create') return
    if (!draftLocalId) return

    let cancelled = false

    void offlineMediaRepository.getOrderMedia(draftLocalId).then((items) => {
      if (cancelled || !items.length) return

      setMedia((prev) => {
        const existingIds = new Set(prev.map((item) => String(item.id)))
        const next = [...prev]

        items.forEach((item) => {
          if (existingIds.has(item.id)) return

          next.push({
            kind: 'offline',
            id: item.id,
            previewUrl: URL.createObjectURL(item.blob),
            name: item.fileName,
            type: item.type,
          })
        })

        return next
      })
    })

    return () => {
      cancelled = true
    }
  }, [mode, draftLocalId])

  // Загрузка оригинальных фото
  const handleOriginalFiles = async (fileList: FileList | null) => {
    if (!fileList) return

    const files = Array.from(fileList)

    // Считаем только НЕ помеченные на удаление оригиналы
    const activeOriginals = originals.filter(o => !o.markedForDelete)

    if (activeOriginals.length + files.length > 2) {
      showTempMessage('warning', 'Можно загрузить не более 2 фотографий в оригинальном качестве')
      return
    }

    setUploadingOriginal(true)

    try {
      const uploads = await Promise.all(
        files.map(async (file) => {
          const dto = await mediaApi.uploadOriginal(file)
          return {
            id: dto.id,
            tempId: dto.id,
            name: dto.originalFileName,
            size: dto.size,
            previewUrl: dto.previewUrl || URL.createObjectURL(file),
            uploadedAt: new Date().toISOString(),
            isNew: true,
          }
        })
      )

      setOriginals(prev => [...prev, ...uploads])

      if (isEditMode && orderId) {
        showTempMessage('success', `${uploads.length} фото загружено в оригинальном качестве (сохранится при отправке)`)
      } else if (mode === 'create' && draftLocalId) {
        showTempMessage('success', `${uploads.length} фото загружено в оригинальном качестве`)
      }

      if (originalFileInputRef.current) {
        originalFileInputRef.current.value = ''
      }
    } catch (error) {
      showTempMessage(
        'error',
        error instanceof Error ? error.message : 'Ошибка при загрузке оригинального фото'
      )
    } finally {
      setUploadingOriginal(false)
    }
  }

  // Удаление оригинального фото
  const handleDeleteOriginal = (index: number) => {
    const item = originals[index]

    // При создании заказа (не редактирование) — удаляем сразу
    if (!isEditMode) {
      if (item.tempId) {
        mediaApi.deleteTemp(item.tempId).catch(() => {})
      }
      setOriginals(prev => prev.filter((_, i) => i !== index))
      showTempMessage('info', 'Фото удалено')
      return
    }

    // При редактировании — переключаем флаг markedForDelete
    setOriginals(prev =>
      prev.map((m, i) =>
        i === index
          ? { ...m, markedForDelete: !m.markedForDelete }
          : m
      )
    )
  }

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return

    const files = Array.from(fileList)

    setUploading(true)

    try {
      if (mode === 'create' && draftLocalId && connectivityService.isOffline()) {
        const offlineUploads = await Promise.all(
          files.map(async (file) => {
            const type = file.type.startsWith('video')
              ? 'video'
              : 'photo'

            const offlineMedia = createOfflineMedia({
              orderLocalId: draftLocalId,
              file,
              type,
            })

            await offlineMediaRepository.saveOrderMedia(offlineMedia)

            return {
              kind: 'offline',
              id: offlineMedia.id,
              previewUrl: URL.createObjectURL(file),
              name: offlineMedia.fileName,
              type,
            } as MediaItem
          })
        )

        setMedia(prev => [...prev, ...offlineUploads])
        return
      }

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
    } catch (error) {
      showTempMessage(
        'error',
        error instanceof Error ? error.message : 'Ошибка при сохранении медиа'
      )
    } finally {
      setUploading(false)

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDelete = async (index: number) => {
    const item = media[index]

    if (!isEditMode) {
      if (item.kind === 'temp') {
        await mediaApi.deleteTemp(item.id).catch(() => { })
      }

      if (item.kind === 'offline') {
        await offlineMediaRepository.deleteOrderMedia(item.id)
      }

      setMedia(prev => prev.filter((_, i) => i !== index))
      return
    }

    setMedia(prev =>
      prev.map((m, i) =>
        i === index
          ? { ...m, markedForDelete: !m.markedForDelete }
          : m
      )
    )
  }

  useEffect(() => {
    // Обычные фото
    const photoIds = media
      .filter(
        (m): m is Extract<MediaItem, { kind: 'temp' }> =>
          m.kind === 'temp' && m.type === 'photo' && !m.isOriginal
      )
      .map((m) => m.id)

    // Оригиналы (новые)
    const originalIds = originals
      .filter((o) => !o.markedForDelete && o.isNew === true)
      .map((o) => o.tempId)

    // Видео
    const videoIds = media
      .filter(
        (m): m is Extract<MediaItem, { kind: 'temp' }> =>
          m.kind === 'temp' && m.type === 'video'
      )
      .map((m) => m.id)

    // Удаленные обычные фото
    const removedPhotos = media
      .filter(
        (m): m is Extract<MediaItem, { kind: 'existing' }> =>
          m.kind === 'existing' &&
          m.type === 'photo' &&
          m.markedForDelete === true
      )
      .map((m) => m.id)

    const removedVideos = media
      .filter(
        (m): m is Extract<MediaItem, { kind: 'existing' }> =>
          m.kind === 'existing' &&
          m.type === 'video' &&
          m.markedForDelete === true
      )
      .map((m) => m.id)

    // Удаленные оригиналы ← НОВОЕ
    const removedOriginalIds = originals
      .filter((o) => o.markedForDelete === true)
      .map((o) => o.id)

    setValue('media.tempPhotoIds', photoIds, { shouldDirty: true })
    setValue('media.tempVideoIds', videoIds, { shouldDirty: true })
    setValue('media.tempOriginalPhotoIds', originalIds, { shouldDirty: true })
    setValue('media.removedPhotoIds', removedPhotos, { shouldDirty: true })
    setValue('media.removedVideoIds', removedVideos, { shouldDirty: true })
    setValue('media.removedOriginalIds', removedOriginalIds, { shouldDirty: true }) 
  }, [media, originals, removedPhotos, removedVideos])

  useEffect(() => {
    const handleUnload = () => {
      mediaRef.current.forEach(m => {
        if (
          m.kind === 'temp' &&
          !m.uploading &&
          m.markedForDelete
        ) {
          httpClient.delete(`/media/temp/${m.id}`)
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
          mediaApi.deleteTemp(m.id).catch(() => { })
        }
      })
    }
  }, [])

  useEffect(() => {
    media.forEach((m) => {
      const mediaId = String(m.id)
      if (previewUrls[mediaId]) return

      if (m.kind === 'offline') {
        setPreviewUrls((prev) => ({
          ...prev,
          [mediaId]: m.previewUrl,
        }))
        return
      }

      loadMedia(m.previewUrl).then((url) => {
        if (!url) return
        setPreviewUrls((prev) => ({
          ...prev,
          [mediaId]: url,
        }))
      })
    })
  }, [media])
  
  // Загрузка preview для оригиналов
  useEffect(() => {
    originals.forEach((item) => {
      const mediaId = String(item.id)
      if (previewUrls[mediaId]) return

      loadMedia(item.previewUrl).then((url) => {
        if (!url) return
        setPreviewUrls((prev) => ({
          ...prev,
          [mediaId]: url,
        }))
      })
    })
  }, [originals])
  
  const previewItems: ViewerMediaDto[] = [
    ...media.map((m) => ({
      id: typeof m.id === 'number' ? m.id : Number.MAX_SAFE_INTEGER,
      url: m.previewUrl,
      originalFileName: m.name,
      mediaType: m.type === 'video' ? 1 : 0,
    })),
    ...originals.map((m) => ({
      id: m.id,
      url: m.previewUrl,
      originalFileName: m.name,
      mediaType: 0, // фото
    })),
  ]

  const regularMedia = media.filter(m => !m.isOriginal)
  const originalMedia = media.filter(m => m.isOriginal === true)

  return (
    <div className={surface.surface}>
      <h2 className={surface.sectionTitle}>
        Медиафайлы
      </h2>

      {/* Оригинальные фото */}
      <div className={layout.field}>
        <label className={layout.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          Оригинальные фото (без сжатия)
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {originals.filter(o => !o.markedForDelete).length}/2
          </span>
        </label>

        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
          Фотографии сохраняются в исходном качестве без изменения размера и сжатия
        </p>

        <label
          style={{
            padding: '16px',
            borderRadius: '14px',
            border: '1px dashed rgba(251,191,36,0.35)',
            textAlign: 'center',
            cursor: originals.length >= 2 ? 'not-allowed' : 'pointer',
            background: originals.length >= 2 ? 'rgba(100,100,100,0.1)' : 'rgba(251,191,36,0.05)',
            opacity: originals.length >= 2 ? 0.5 : 1,
          }}
        >
          <input
            ref={originalFileInputRef}
            type="file"
            multiple
            accept="image/*"
            hidden
            onChange={(e) => handleOriginalFiles(e.target.files)}
            disabled={originals.filter(o => !o.markedForDelete).length >= 2}
          />

          {uploadingOriginal
            ? 'Загрузка...'
            : originals.filter(o => !o.markedForDelete).length >= 2
              ? 'Достигнут лимит (2 фото)'
              : 'Выберите фото для загрузки без сжатия'}
        </label>

        {originals.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill,120px)',
              gap: '12px',
              marginTop: '12px',
            }}
          >
            {originals.map((item, index) => {
              const originalIndex = media.length + index
              return (
                <div
                  key={item.id}
                  onClick={() => setPreviewIndex(originalIndex)}
                  style={{
                    position: 'relative',
                    width: '120px',
                    height: '120px',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: '1px solid rgba(251,191,36,0.3)',
                    cursor: 'pointer',
                    filter: isEditMode && item.markedForDelete
                      ? 'grayscale(1) opacity(0.45)'
                      : 'none',
                  }}
                >
                  <img
                    src={previewUrls[item.id] || item.previewUrl}
                    alt={item.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteOriginal(index)
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
                    <AppIcon name={item.markedForDelete ? 'check' : 'close'} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Обычные медиа */}
      <div className={layout.field}>
        <label className={layout.label}>
          Загрузить файлы
        </label>

        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
          Фотографии и видео сжимаются для экономии места
        </p>

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

      {/* Обычные фото (не оригиналы) */}
      {regularMedia.length > 0 && (
        <>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginTop: '16px', color: 'var(--text-secondary)' }}>
            Фотографии
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill,120px)',
              gap: '12px',
            }}
          >
            {regularMedia.map((item) => {
              const realIndex = media.indexOf(item)
              return (
                <div
                  key={item.id}
                  onClick={() => setPreviewIndex(realIndex)}
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
                      handleDelete(realIndex)
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
              )
            })}
          </div>
        </>
      )}

      {/* Оригинальные фото (уже в заказе) */}
      {originalMedia.length > 0 && (
        <>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginTop: '16px', color: 'var(--text-secondary)' }}>
            Оригинальные фото
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Фотографии в исходном качестве
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill,120px)',
              gap: '12px',
            }}
          >
            {originalMedia.map((item) => {
              const realIndex = media.indexOf(item)
              return (
                <div
                  key={item.id}
                  onClick={() => setPreviewIndex(realIndex)}
                  style={{
                    position: 'relative',
                    width: '120px',
                    height: '120px',
                    cursor: 'pointer'
                  }}
                >
                  <img
                    src={previewUrls[item.id]}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      borderRadius: '10px',
                      border: '2px solid rgba(251,191,36,0.3)',
                      filter:
                        isEditMode && item.markedForDelete
                          ? 'grayscale(1) opacity(0.45)'
                          : 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(realIndex)
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
              )
            })}
          </div>
        </>
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