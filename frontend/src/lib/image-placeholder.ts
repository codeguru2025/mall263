// 1×1 gray pixel — used as blurDataURL for remote images so Next.js
// shows a solid placeholder while the real image loads.
// Remote images can't have auto-generated blur hashes so we supply one.
export const BLUR_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
