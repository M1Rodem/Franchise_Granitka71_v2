'use client'

import { useState } from 'react'
import { useFormContext } from 'react-hook-form'
import type { OrderFormModel } from '../order-form.schema'

import surface from '@/shared/ui/surface.module.css'
import layout from '@/shared/ui/form-layout.module.css'
import button from '@/shared/ui/button.module.css'
import table from '@/shared/ui/table-base.module.css'

export function MediaSection() {
  const { setValue } = useFormContext<OrderFormModel>()

  const [files, setFiles] = useState<File[]>([])

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return

    const fileArray = Array.from(fileList)
    setFiles(prev => [...prev, ...fileArray])

    // Пока temp ids не подключены
    setValue('media.tempPhotoIds', [])
    setValue('media.tempVideoIds', [])
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className={surface.surface}>
      <h2 className={surface.sectionTitle}>
        Медиафайлы
      </h2>

      {/* Upload block */}
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
            type="file"
            multiple
            accept="image/*,video/*"
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />

          Перетащите файлы или нажмите для выбора
        </label>
      </div>

      {/* Список файлов */}
      {files.length > 0 && (
        <div className={table.dataTable}>

          {files.map((file, index) => (
            <div
              key={index}
              className={table.dataRow}
              style={{ gridTemplateColumns: '1fr auto' }}
            >
              <span>{file.name}</span>

              <button
                type="button"
                onClick={() => removeFile(index)}
                className={`${button.btn} ${button.btnDanger}`}
              >
                Удалить
              </button>
            </div>
          ))}

        </div>
      )}
    </div>
  )
}