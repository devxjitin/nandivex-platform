import { useEffect, useState } from 'react';
import { apiBlob } from '../lib/api.js';

/* A person's picture (the signed-in user's by default), or their initial when there is none. The picture needs the session
   cookie, so it is fetched and shown from an object URL; one download per version is kept in memory. */
const cache = new Map();

export default function Avatar({ user, className = '', path = '/profile/photo' }) {
  const version = user?.photoVersion || null;
  const key = version ? `${path}:${version}` : null;
  const [src, setSrc] = useState(key ? cache.get(key) || null : null);

  useEffect(() => {
    if (!key) { setSrc(null); return undefined; }
    if (cache.has(key)) { setSrc(cache.get(key)); return undefined; }
    let live = true;
    apiBlob(path)
      .then((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        cache.set(key, url);
        if (live) setSrc(url);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [key]);

  const initial = (user?.name || '?').trim()[0]?.toUpperCase();
  return src ? (
    <img src={src} alt="" className={`${className} object-cover`} />
  ) : (
    <span className={className}>{initial}</span>
  );
}
