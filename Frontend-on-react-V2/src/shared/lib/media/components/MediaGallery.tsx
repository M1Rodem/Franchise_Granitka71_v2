import { useState } from 'react';
import type { MediaDto } from '../api/media.types';
import { MediaItem } from './MediaItem';
import { MediaPreviewModal } from './MediaPreviewModal';
import styles from './media-gallery.module.css';

interface Props {
  items: MediaDto[];
}

export function MediaGallery({ items }: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!items || items.length === 0) {
    return <div className={styles.empty}>Медиа отсутствуют</div>;
  }

  return (
    <>
      <div className={styles.grid}>
        {items.map((item, index) => (
          <MediaItem
            key={`${item.id}-${item.url}`}
            item={item}
            onClick={() => setSelectedIndex(index)}
          />
        ))}
      </div>

      <MediaPreviewModal
        items={items.map((m: MediaDto) => ({
          ...m,
          mediaType: Number(m.mediaType),
        }))}
        index={selectedIndex}
        onClose={() => setSelectedIndex(null)}
        onNavigate={(i) => setSelectedIndex(i)}
      />
    </>
  );
}