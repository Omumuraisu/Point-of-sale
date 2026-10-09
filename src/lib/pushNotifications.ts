import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { debugError, debugLog, debugWarn } from './debugLogging';
import { isSupabaseConfigured, supabase } from './supabase';

export const POS_NOTIFICATION_CHANNEL_ID = 'pos-alerts';
const STORED_PUSH_TOKEN_KEY = '@pos/expo-push-token:v1';

export type PushRegistrationStatus =
    | 'registered'
    | 'unsupported_platform'
    | 'not_physical_device'
    | 'permission_denied'
    | 'project_id_missing'
    | 'supabase_unavailable'
    | 'token_failed'
    | 'registration_failed';

const BILLING_NOTIFICATION_TYPES = new Set([
    'billing_submitted',
    'billing_payment_reminder',
    'billing_due_soon',
    'billing_due_today',
    'billing_overdue',
    'billing_paid',
]);

export const getPushNotificationDestination = (data: Record<string, unknown>) => {
    const notificationType = typeof data.notificationType === 'string' ? data.notificationType : '';
    if (!BILLING_NOTIFICATION_TYPES.has(notificationType)) return { pathname: '/notifications' as const };
    return {
        pathname: '/rent' as const,
        params: {
            ...(typeof data.billingCycleId === 'number' || typeof data.billingCycleId === 'string'
                ? { billingCycleId: String(data.billingCycleId) } : {}),
            ...(typeof data.billingMonth === 'string' && data.billingMonth
                ? { billingMonth: data.billingMonth } : {}),
        },
    };
};

let handlerConfigured = false;

export const configurePushNotificationHandler = () => {
    if (handlerConfigured) return;
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
    handlerConfigured = true;
};

const getExpoProjectId = (): string | null => {
    const configuredProjectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (typeof configuredProjectId === 'string' && configuredProjectId.trim()) {
        return configuredProjectId.trim();
    }
    const easProjectId = Constants.easConfig?.projectId;
    return typeof easProjectId === 'string' && easProjectId.trim() ? easProjectId.trim() : null;
};

export const ensureAndroidNotificationChannel = async () => {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync(POS_NOTIFICATION_CHANNEL_ID, {
        name: 'MarketSync alerts',
        description: 'Billing, payment, and account notifications.',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2f5ada',
        showBadge: true,
    });
};

export const registerCurrentDeviceForPush = async (): Promise<PushRegistrationStatus> => {
    if (Platform.OS !== 'android') return 'unsupported_platform';
    if (!Device.isDevice) {
        debugWarn('notifications', 'push registration skipped', { reason: 'physical_device_required' });
        return 'not_physical_device';
    }

    try {
        const projectId = getExpoProjectId();
        if (!projectId) {
            debugError('notifications', 'push registration failed', { reason: 'eas_project_id_missing' });
            return 'project_id_missing';
        }
        await ensureAndroidNotificationChannel();
        const existingPermissions = await Notifications.getPermissionsAsync();
        const permissions = existingPermissions.status === 'granted'
            ? existingPermissions
            : await Notifications.requestPermissionsAsync();
        if (permissions.status !== 'granted') {
            debugWarn('notifications', 'push permission denied');
            return 'permission_denied';
        }

        if (!isSupabaseConfigured || !supabase) return 'supabase_unavailable';

        const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        if (!expoPushToken) return 'token_failed';
        const { error } = await supabase.rpc('register_pos_push_token', {
            p_expo_push_token: expoPushToken,
            p_platform: 'android',
        });
        if (error) {
            debugError('notifications', 'push token registration failed', { message: error.message });
            return 'registration_failed';
        }

        await AsyncStorage.setItem(STORED_PUSH_TOKEN_KEY, expoPushToken);
        debugLog('notifications', 'push token registered', { platform: 'android' });
        return 'registered';
    } catch (error) {
        debugError('notifications', 'push registration failed', { error });
        return 'token_failed';
    }
};

export const unregisterCurrentDevicePushToken = async (): Promise<boolean> => {
    const expoPushToken = await AsyncStorage.getItem(STORED_PUSH_TOKEN_KEY);
    if (!expoPushToken) return true;
    if (!isSupabaseConfigured || !supabase) return false;

    try {
        const { error } = await supabase.rpc('unregister_pos_push_token', {
            p_expo_push_token: expoPushToken,
        });
        if (error) {
            debugError('notifications', 'push token unregister failed', { message: error.message });
            return false;
        }
        await AsyncStorage.removeItem(STORED_PUSH_TOKEN_KEY);
        await Notifications.dismissAllNotificationsAsync();
        return true;
    } catch (error) {
        debugError('notifications', 'push token unregister failed', { error });
        return false;
    }
};
