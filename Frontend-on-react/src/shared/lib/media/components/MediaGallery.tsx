import { useState } from 'react';
import type { MediaDto } from '../api/media.types';
import { MediaItem } from './MediaItem';
import { MediaPreviewModal } from './MediaPreviewModal';

interface Props {
  items: MediaDto[];
}

export function MediaGallery({ items }: Props) {
  const [selected, setSelected] = useState<MediaDto | null>(null);

  if (!items || items.length === 0) {
    return <div style={{ opacity: 0.6 }}>Медиа отсутствуют</div>;
  }

  return (
    <>
      <div
        style={{
          display: 'grid',
          gap: '16px',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        }}
      >
        {items.map((item) => (
          <MediaItem
            key={item.id}
            item={item}
            onClick={() => setSelected(item)}
          />
        ))}
      </div>

      <MediaPreviewModal
        item={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}