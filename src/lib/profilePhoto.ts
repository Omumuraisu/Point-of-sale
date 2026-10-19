import type { ImagePickerAsset } from 'expo-image-picker';

export const PROFILE_PHOTO_BUCKET = 'profile-photos';
export const PROFILE_PHOTO_MAX_BYTES = 3 * 1024 * 1024;
export const PROFILE_PHOTO_ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
] as const;

const allowedMimeTypes = new Set<string>(PROFILE_PHOTO_ALLOWED_MIME_TYPES);

export const getProfilePhotoPath = (authUserId: string): string => `${authUserId}/avatar`;

export const validateProfilePhoto = (asset: ImagePickerAsset): string | null => {
    const mimeType = asset.mimeType?.toLowerCase();

    if (!mimeType || !allowedMimeTypes.has(mimeType)) {
        return 'Use a JPG, PNG, WEBP, or GIF image.';
    }

    if (typeof asset.fileSize === 'number' && asset.fileSize > PROFILE_PHOTO_MAX_BYTES) {
        return 'Profile picture must be 3 MB or smaller.';
    }

    return null;
};

export const addProfilePhotoCacheBuster = (publicUrl: string, timestamp = Date.now()): string => {
    const separator = publicUrl.includes('?') ? '&' : '?';
    return `${publicUrl}${separator}v=${timestamp}`;
};
