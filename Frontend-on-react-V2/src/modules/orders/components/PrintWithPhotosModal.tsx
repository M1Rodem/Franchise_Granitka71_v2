import { useState } from 'react';
import { FormModal } from '@/shared/ui/modal/FormModal';
import button from '@/shared/ui/button.module.css';
import surface from '@/shared/ui/surface.module.css';
import formLayout from '@/shared/ui/form-layout.module.css';
import type { MediaDto } from '@/shared/lib/media/api/media.types';
import styles from './PrintWithPhotosModal.module.css';

interface PrintWithPhotosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrint: (photoIds: number[], type: 'default' | 'worker') => void;
  photos: MediaDto[];
  isLoading: boolean;
}

export function PrintWithPhotosModal({
  isOpen,
  onClose,
  onPrint,
  photos,
  isLoading,
}: PrintWithPhotosModalProps) {
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<number>>(new Set());
  const [printType, setPrintType] = useState<'default' | 'worker'>('default');

  const handleTogglePhoto = (photoId: number) => {
    const newSet = new Set(selectedPhotoIds);
    if (newSet.has(photoId)) {
      newSet.delete(photoId);
    } else {
      newSet.add(photoId);
    }
    setSelectedPhotoIds(newSet);
  };

  const handleSelectAll = () => {
    if (selectedPhotoIds.size === photos.length) {
      setSelectedPhotoIds(new Set());
    } else {
      setSelectedPhotoIds(new Set(photos.map(p => p.id)));
    }
  };

  const handlePrint = () => {
    // ✅ Разрешаем печать даже без выбранных фото
    onPrint(Array.from(selectedPhotoIds), printType);
  };

  const footer = (
    <div className={styles.footer}>
      <button
        type="button"
        className={`${button.btn} ${button.btnNeutral}`}
        onClick={onClose}
        disabled={isLoading}
      >
        Отмена
      </button>
      <button
        type="button"
        className={`${button.btn} ${button.btnPrimary}`}
        onClick={handlePrint}
        disabled={isLoading}
      >
        {isLoading 
          ? 'Печать...' 
          : selectedPhotoIds.size > 0 
            ? `Распечатать (${selectedPhotoIds.size})` 
            : 'Распечатать бланк'
        }
      </button>
    </div>
  );

  return (
    <FormModal
      isOpen={isOpen}
      title="Печать заказа"
      onClose={onClose}
      footer={footer}
      size="lg"
    >
      <div className={styles.container}>
        {/* Выбор типа печати */}
        <div className={surface.surface}>
          <h4 className={surface.sectionTitle}>Тип печати</h4>
          <div className={formLayout.grid2}>
            <label className={`${styles.radioLabel} ${printType === 'default' ? styles.radioSelected : ''}`}>
              <input
                type="radio"
                value="default"
                checked={printType === 'default'}
                onChange={(e) => setPrintType(e.target.value as 'default')}
              />
              <div>
                <strong>Обычная печать</strong>
                <span>С ценами и данными заказчика</span>
              </div>
            </label>
            <label className={`${styles.radioLabel} ${printType === 'worker' ? styles.radioSelected : ''}`}>
              <input
                type="radio"
                value="worker"
                checked={printType === 'worker'}
                onChange={(e) => setPrintType(e.target.value as 'worker')}
              />
              <div>
                <strong>Для рабочих</strong>
                <span>Без цен и личных данных</span>
              </div>
            </label>
          </div>
        </div>

        {/* Выбор фото */}
        <div className={surface.surface}>
          <div className={styles.photosHeader}>
            <h4 className={surface.sectionTitle}>Выберите фотографии</h4>
            {photos.length > 0 && (
              <button
                type="button"
                className={`${button.btn} ${button.btnSmall} ${button.btnNeutral}`}
                onClick={handleSelectAll}
              >
                {selectedPhotoIds.size === photos.length ? 'Снять все' : 'Выбрать все'}
              </button>
            )}
          </div>

          {photos.length === 0 ? (
            <div className={styles.emptyPhotos}>
              <p>У заказа нет фотографий</p>
              <span>Будет распечатан только бланк заказа</span>
            </div>
          ) : (
            <>
              <div className={styles.photosGrid}>
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className={`${styles.photoCard} ${selectedPhotoIds.has(photo.id) ? styles.selected : ''}`}
                    onClick={() => handleTogglePhoto(photo.id)}
                  >
                    <div className={styles.checkboxWrapper}>
                      <input
                        type="checkbox"
                        checked={selectedPhotoIds.has(photo.id)}
                        onChange={() => {}}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <img
                      src={photo.url}
                      alt={photo.originalFileName}
                      className={styles.photoPreview}
                      loading="lazy"
                    />
                    <div className={styles.photoInfo}>
                      <span className={styles.photoName}>
                        {photo.originalFileName.length > 35
                          ? photo.originalFileName.slice(0, 32) + '...'
                          : photo.originalFileName}
                      </span>
                      <span className={styles.photoSize}>
                        {Math.round(photo.size / 1024)} KB
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.selectionInfo}>
                {selectedPhotoIds.size > 0 
                  ? `Выбрано фото: ${selectedPhotoIds.size}` 
                  : 'Фото не выбраны. Будет распечатан только бланк заказа.'
                }
              </div>
            </>
          )}
        </div>
      </div>
    </FormModal>
  );
}