import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => (
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
));

const mockRpc = jest.fn();
jest.mock('../src/lib/supabase', () => ({
    isSupabaseConfigured: true,
    supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
jest.mock('../src/lib/pushNotifications', () => ({ unregisterCurrentDevicePushToken: jest.fn() }));

import { loadAuthenticatedUser, type CurrentUser } from '../src/lib/authSession';

const cachedUser: CurrentUser = {
    accountId: 7, phoneNumber: '+639171234567', email: null, userType: 'owner', displayName: 'Offline Owner',
    profileTable: 'business_owner', profileId: 3, businessOwnerId: 3, businessId: 10,
    businessName: 'Offline Store', stallId: 'STALL-1', stallNumber: '1', profilePictureUrl: null,
};

beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@auth/current-user', JSON.stringify(cachedUser));
});

test('uses the cached authorized user when profile refresh fails offline', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Network request failed' } });
    await expect(loadAuthenticatedUser()).resolves.toEqual(cachedUser);
});

test('does not reuse the cached user for a non-network authorization failure', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'JWT expired', code: 'PGRST301' } });
    await expect(loadAuthenticatedUser()).resolves.toBeNull();
});

test('upgrades an older cached user that has no email field', async () => {
    const { email: _email, ...olderCachedUser } = cachedUser;
    await AsyncStorage.setItem('@auth/current-user', JSON.stringify(olderCachedUser));
    mockRpc.mockRejectedValue(new Error('offline'));
    await expect(loadAuthenticatedUser()).resolves.toEqual({ ...olderCachedUser, email: null });
});

test('malformed cached authentication data is ignored offline', async () => {
    await AsyncStorage.setItem('@auth/current-user', '{not-json');
    mockRpc.mockRejectedValue(new Error('offline'));
    await expect(loadAuthenticatedUser()).resolves.toBeNull();
});
