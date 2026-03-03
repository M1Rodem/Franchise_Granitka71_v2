import { FormModal } from '@/shared/ui/modal/FormModal';
import stylesBtn from '@/shared/ui/button.module.css';
import type { MediaDto } from '../api/media.types';

interface Props {
  item: MediaDto | null;
  onClose: () => void;
}

function isVideo(type: number | string) {
  return String(type).toLowerCase().includes('video') || type === 1;
}

export function MediaPreviewModal({ item, onClose }: Props) {
  if (!item) return null;

  return (
    <FormModal
      isOpen={!!item}
      title={item.originalFileName}
      onClose={onClose}
      footer={
        <a
          href={item.url}
          download
          className={`${stylesBtn.btn} ${stylesBtn.btnSecondary}`}
        >
          Скачать
        </a>
      }
    >
      {isVideo(item.mediaType) ? (
        <video
          src={item.url}
          controls
          style={{ width: '100%', maxHeight: '70vh' }}
        />
      ) : (
        <img
          src={item.url}
          alt={item.originalFileName}
          style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain' }}
        />
      )}
    </FormModal>
  );
}