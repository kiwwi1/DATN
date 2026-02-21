/**
 * Format image URL from R2
 * If URL is already a full URL (starts with http/https), return as is
 * If URL is a key/path, prepend R2_PUBLIC_BASE_URL from env
 * @param {string} imageUrl - Image URL or key from backend
 * @returns {string} Full image URL
 */
export const formatImageUrl = (imageUrl) => {
  if (!imageUrl) {
    return '';
  }

  // If already a full URL (http/https), return as is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  // If it's a key/path, prepend the public base URL
  const publicBaseUrl = import.meta.env.VITE_R2_PUBLIC_BASE_URL || '';
  const bucketName = import.meta.env.VITE_R2_BUCKET || '';
  
  if (publicBaseUrl) {
    // Remove trailing slash from base URL and leading slash from key
    const base = publicBaseUrl.replace(/\/+$/, '');
    const key = imageUrl.replace(/^\/+/, '');
    
    // If publicBaseUrl is R2 endpoint (contains .r2.cloudflarestorage.com), add bucket name
    if (base.includes('.r2.cloudflarestorage.com') && bucketName) {
      return `${base}/${bucketName}/${key}`;
    }
    
    return `${base}/${key}`;
  }

  // Fallback: return as is if no base URL configured
  return imageUrl;
};
