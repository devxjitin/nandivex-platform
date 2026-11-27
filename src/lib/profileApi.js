import { api, apiUpload } from './api.js';

export async function getProfile() {
  const { profile } = await api('/profile');
  return profile;
}

/** Saves the details. `pan` and `bankAccountNumber` are only sent when a new value was typed. */
export async function saveProfile(values) {
  const { profile } = await api('/profile', { method: 'PUT', body: values });
  return profile;
}

/** Uploads the picture. Returns the updated user (its photoVersion changes). */
export async function uploadPhoto(blob) {
  const { user } = await apiUpload('/profile/photo', blob);
  return user;
}

export async function removePhoto() {
  const { user } = await api('/profile/photo', { method: 'DELETE' });
  return user;
}

/** Crops the picked image to a centred square and scales it down, so what is uploaded is small. */
export function resizeImage(file, size = 400) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not prepare that picture.'))), 'image/jpeg', 0.85);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file is not a picture we can open. Try a JPG or PNG.'));
    };
    img.src = url;
  });
}
