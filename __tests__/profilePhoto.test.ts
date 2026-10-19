import {
    PROFILE_PHOTO_MAX_BYTES,
    addProfilePhotoCacheBuster,
    getProfilePhotoPath,
    validateProfilePhoto,
} from '../src/lib/profilePhoto';

const asset = (overrides: Record<string, unknown> = {}) => ({
    uri: 'file:///avatar.jpg',
    width: 100,
    height: 100,
    mimeType: 'image/jpeg',
    fileSize: 1024,
    ...overrides,
});

test('uses the shared profile photo object path', () => {
    expect(getProfilePhotoPath('auth-user-id')).toBe('auth-user-id/avatar');
});

test.each(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])(
    'accepts supported profile photo type %s',
    (mimeType) => expect(validateProfilePhoto(asset({ mimeType }))).toBeNull(),
);

test('rejects unsupported and oversized profile photos', () => {
    expect(validateProfilePhoto(asset({ mimeType: 'image/heic' }))).toMatch(/JPG/);
    expect(validateProfilePhoto(asset({ fileSize: PROFILE_PHOTO_MAX_BYTES + 1 }))).toMatch(/3 MB/);
});

test('adds a cache-busting version without damaging existing query parameters', () => {
    expect(addProfilePhotoCacheBuster('https://example.com/avatar', 123)).toBe('https://example.com/avatar?v=123');
    expect(addProfilePhotoCacheBuster('https://example.com/avatar?download=1', 123)).toBe('https://example.com/avatar?download=1&v=123');
});
