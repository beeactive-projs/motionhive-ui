/**
 * Getting a picked photo ready to send, in every app: the workout photo, an
 * exercise's picture.
 */

/** The longest edge kept; the API caps at the same, so nothing is sent to be thrown away. */
const MAX_EDGE = 2048;
const JPEG_QUALITY = 0.85;

/**
 * A picked photo as it is sent: decoded, turned upright, scaled down and
 * written out again as a fresh JPEG. A canvas writes no metadata at all,
 * so the location a phone camera embeds never leaves the device. (The API
 * strips it again anyway.) HEIC from an iPhone arrives already converted
 * by the file picker.
 */
export async function preparePhoto(file: Blob): Promise<Blob> {
  // `from-image` applies the EXIF rotation before the EXIF is dropped.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the photo'))),
      'image/jpeg',
      JPEG_QUALITY,
    ),
  );
}
