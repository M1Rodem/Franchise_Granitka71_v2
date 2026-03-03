import { useEffect, useState } from 'react';

const cache = new Map<string, string>();

export function useVideoThumbnail(url: string) {
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;

    if (cache.has(url)) {
      setThumb(cache.get(url)!);
      return;
    }

    let cancelled = false;
    const video = document.createElement('video');
    video.src = url;
    video.preload = 'metadata';
    video.muted = true;

    const handleLoaded = () => {
      video.currentTime = 0.1;
    };

    const handleSeeked = () => {
      if (cancelled) return;

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

      cache.set(url, dataUrl);
      setThumb(dataUrl);
    };

    video.addEventListener('loadeddata', handleLoaded);
    video.addEventListener('seeked', handleSeeked);

    return () => {
      cancelled = true;
      video.removeEventListener('loadeddata', handleLoaded);
      video.removeEventListener('seeked', handleSeeked);
      video.src = '';
    };
  }, [url]);

  return thumb;
}