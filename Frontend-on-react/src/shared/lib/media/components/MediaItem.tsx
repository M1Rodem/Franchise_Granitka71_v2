import type { MediaDto } from '../api/media.types';
import { useVideoThumbnail } from '../hooks/useVideoThumbnail';

interface Props {
  item: MediaDto;
  onClick: () => void;
}

function isVideo(type: number | string) {
  return String(type).toLowerCase().includes('video') || type === 1;
}

export function MediaItem({ item, onClick }: Props) {
  const thumbnail = isVideo(item.mediaType)
    ? useVideoThumbnail(item.url)
    : null;

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '14px',
        border: '1px solid rgba(125,162,219,0.25)',
        background: 'rgba(10,29,57,0.6)',
        aspectRatio: '1 / 1',
        cursor: 'pointer',
      }}
    >
      {isVideo(item.mediaType) ? (
        thumbnail ? (
          <img
            src={thumbnail}
            alt={item.originalFileName}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ opacity: 0.5 }}>Loading...</div>
        )
      ) : (
        <img
          src={item.url}
          alt={item.originalFileName}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
    </div>
  );
}