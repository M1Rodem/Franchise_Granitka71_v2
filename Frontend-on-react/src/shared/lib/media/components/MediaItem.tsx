import type { MediaDto } from '../api/media.types';
import { useVideoThumbnail } from '../hooks/useVideoThumbnail';
import styles from './media-item.module.css';

interface Props {
  item: MediaDto;
  onClick: () => void;
}

function isVideo(type: number | string) {
  return String(type).toLowerCase().includes('video') || type === 1;
}

export function MediaItem({ item, onClick }: Props) {
  const video = isVideo(item.mediaType);

  const thumbnail = video
    ? useVideoThumbnail(item.url)
    : null;

  return (
    <div
      className={styles.item}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      {video ? (
        thumbnail ? (
          <img
            src={thumbnail}
            alt={item.originalFileName}
            className={styles.preview}
          />
        ) : (
          <div className={styles.loading}>
            Loading...
          </div>
        )
      ) : (
        <img
          src={item.url}
          alt={item.originalFileName}
          loading="lazy"
          className={styles.preview}
        />
      )}

      {video && (
        <div className={styles.videoBadge}>
          ▶
        </div>
      )}
    </div>
  );
}