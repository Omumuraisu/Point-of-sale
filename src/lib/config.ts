import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const normalizeEndpoint = (value: string): string => {
    const trimmed = value.trim();

    if (!trimmed) {
        return '';
    }

    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

const getDefaultDevBaseUrl = (): string => {
    if (Platform.OS === 'android') {
        // Android emulator reaches host machine localhost via 10.0.2.2.
        return 'http://10.0.2.2:3000';
    }

    return 'http://localhost:3000';
};

const isLoopbackHost = (host: string): boolean => {
    const normalized = host.trim().toLowerCase();
    return normalized === 'localhost' || normalized === '127.0.0.1';
};

const getBundleHostName = (): string | null => {
    const sourceCode = (NativeModules as { SourceCode?: { scriptURL?: string } }).SourceCode;
    const scriptUrl = sourceCode?.scriptURL;

    if (!scriptUrl) {
        return null;
    }

    try {
        const parsed = new URL(scriptUrl);
        return parsed.hostname || null;
    } catch {
        return null;
    }
};

const parseHostFromHostPort = (value: string | undefined): string | null => {
    if (!value) {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        try {
            return new URL(trimmed).hostname || null;
        } catch {
            return null;
        }
    }

    return trimmed.split(':')[0] || null;
};

const getExpoHostName = (): string | null => {
    const constants = Constants as unknown as {
        expoConfig?: { hostUri?: string };
        manifest2?: { extra?: { expoClient?: { hostUri?: string } } };
        manifest?: { debuggerHost?: string };
    };

    const hostCandidates = [
        constants.expoConfig?.hostUri,
        constants.manifest2?.extra?.expoClient?.hostUri,
        constants.manifest?.debuggerHost,
    ];

    for (const candidate of hostCandidates) {
        const host = parseHostFromHostPort(candidate);
        if (host) {
            return host;
        }
    }

    return null;
};

const env = (
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?? {}
);

const rawApiBaseUrl = env.EXPO_PUBLIC_API_BASE_URL?.trim();
const rawAndroidDeviceBaseUrl = env.EXPO_PUBLIC_ANDROID_DEVICE_API_BASE_URL?.trim();
const rawTxSyncDebug = env.EXPO_PUBLIC_TX_SYNC_DEBUG?.trim().toLowerCase();

const resolveApiBaseUrl = (): string => {
    if (Platform.OS === 'android' && rawAndroidDeviceBaseUrl) {
        return trimTrailingSlash(rawAndroidDeviceBaseUrl);
    }

    if (!rawApiBaseUrl) {
        return trimTrailingSlash(getDefaultDevBaseUrl());
    }

    if (Platform.OS !== 'android') {
        return trimTrailingSlash(rawApiBaseUrl);
    }

    try {
        const host = new URL(rawApiBaseUrl).hostname;

        if (!isLoopbackHost(host)) {
            return trimTrailingSlash(rawApiBaseUrl);
        }

        const bundleHost = getBundleHostName();
        if (bundleHost && !isLoopbackHost(bundleHost)) {
            const inferredUrl = `http://${bundleHost}:3000`;

            if (__DEV__) {
                console.warn(
                    `[API_CONFIG] EXPO_PUBLIC_API_BASE_URL (${rawApiBaseUrl}) uses localhost on Android. `
                    + `Auto-using ${inferredUrl} from Metro bundle host.`,
                );
            }

            return trimTrailingSlash(inferredUrl);
        }

        const expoHost = getExpoHostName();
        if (expoHost && !isLoopbackHost(expoHost)) {
            const inferredUrl = `http://${expoHost}:3000`;

            if (__DEV__) {
                console.warn(
                    `[API_CONFIG] EXPO_PUBLIC_API_BASE_URL (${rawApiBaseUrl}) uses localhost on Android. `
                    + `Auto-using ${inferredUrl} from Expo host URI.`,
                );
            }

            return trimTrailingSlash(inferredUrl);
        }

        if (__DEV__) {
            console.warn(
                `[API_CONFIG] EXPO_PUBLIC_API_BASE_URL (${rawApiBaseUrl}) points to localhost on Android. `
                + 'For physical devices set EXPO_PUBLIC_ANDROID_DEVICE_API_BASE_URL to your PC LAN IP.',
            );
        }

        return trimTrailingSlash(getDefaultDevBaseUrl());
    } catch {
        return trimTrailingSlash(rawApiBaseUrl);
    }
};

export const API_BASE_URL = resolveApiBaseUrl();
export const TX_SYNC_DEBUG = rawTxSyncDebug === 'true';

export const BUS_OWNER_ENDPOINT = normalizeEndpoint(
    env.EXPO_PUBLIC_BUS_OWNER_ENDPOINT || '/api/business-owners',
);

export const VENDOR_ENDPOINT = normalizeEndpoint(
    env.EXPO_PUBLIC_VENDOR_ENDPOINT || '/api/vendor',
);

export const TRANSACTIONS_ENDPOINT = normalizeEndpoint(
    env.EXPO_PUBLIC_TRANSACTIONS_ENDPOINT || '/api/transactions',
);

export const PRODUCTS_ENDPOINT = normalizeEndpoint(
    env.EXPO_PUBLIC_PRODUCTS_ENDPOINT || '/api/products',
);

export const CATEGORIES_ENDPOINT = normalizeEndpoint(
    env.EXPO_PUBLIC_CATEGORIES_ENDPOINT || '/api/categories',
);

export const CATALOG_PRODUCTS_ENDPOINT = normalizeEndpoint(
    env.EXPO_PUBLIC_CATALOG_PRODUCTS_ENDPOINT || '/api/catalog/products',
);

export const buildApiUrl = (endpoint: string): string => {
    const normalizedEndpoint = normalizeEndpoint(endpoint);

    return `${API_BASE_URL}${normalizedEndpoint}`;
};
