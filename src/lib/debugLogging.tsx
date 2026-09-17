import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const DEBUG_SETTINGS_KEY = '@pos/debug-logging:v1';

export const DEBUG_CHANNELS = [
    { id: 'product-sync', label: 'Product Sync', description: 'Product loading, changes, RPC calls, and retries.' },
    { id: 'transactions-payments', label: 'Transactions & Payments', description: 'Sales transaction synchronization and payment completion.' },
    { id: 'catalog-categories', label: 'Catalog & Categories', description: 'Catalog and category loading or persistence.' },
    { id: 'personnel-vendors', label: 'Personnel & Vendors', description: 'Vendor applications, documents, and personnel records.' },
    { id: 'notifications', label: 'Notifications', description: 'Notification loading, unread counts, and updates.' },
    { id: 'billing-lease', label: 'Billing & Lease', description: 'Billing records and business lease information.' },
    { id: 'authentication-sms', label: 'Authentication & SMS', description: 'Authentication flow and developer SMS testing.' },
    { id: 'analytics-export', label: 'Analytics & Export', description: 'Sales analysis and report export diagnostics.' },
    { id: 'supabase-sync', label: 'General Supabase Sync', description: 'Full synchronization lifecycle and summaries.' },
] as const;

export type DebugChannel = typeof DEBUG_CHANNELS[number]['id'];
export type DebugChannelSettings = Record<DebugChannel, boolean>;

const disabledSettings = (): DebugChannelSettings => Object.fromEntries(
    DEBUG_CHANNELS.map(({ id }) => [id, false]),
) as DebugChannelSettings;

let runtimeSettings: DebugChannelSettings = disabledSettings();

const redactKey = (key: string) => /password|passcode|otp|token|secret|authorization|session|phone/i.test(key);

const sanitize = (value: unknown, key = '', depth = 0): unknown => {
    if (redactKey(key)) return '[REDACTED]';
    if (value instanceof Error) return { name: value.name, message: value.message };
    if (depth >= 3) return '[TRUNCATED]';
    if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, '', depth + 1));
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value as Record<string, unknown>)
            .map(([childKey, childValue]) => [childKey, sanitize(childValue, childKey, depth + 1)]));
    }
    return value;
};

const write = (
    level: 'log' | 'warn' | 'error',
    channel: DebugChannel,
    event: string,
    details?: Record<string, unknown>,
) => {
    if (!runtimeSettings[channel]) return;
    const prefix = `[${channel.toUpperCase()}] ${event}`;
    if (details) console[level](prefix, sanitize(details));
    else console[level](prefix);
};

export const debugLog = (channel: DebugChannel, event: string, details?: Record<string, unknown>) =>
    write('log', channel, event, details);
export const debugWarn = (channel: DebugChannel, event: string, details?: Record<string, unknown>) =>
    write('warn', channel, event, details);
export const debugError = (channel: DebugChannel, event: string, details?: Record<string, unknown>) =>
    write('error', channel, event, details);

interface DebugLoggingContextValue {
    settings: DebugChannelSettings;
    isHydrating: boolean;
    setChannelEnabled: (channel: DebugChannel, enabled: boolean) => Promise<void>;
    disableAll: () => Promise<void>;
}

const DebugLoggingContext = createContext<DebugLoggingContextValue | null>(null);

const parseSettings = (raw: string | null): DebugChannelSettings => {
    const next = disabledSettings();
    if (!raw) return next;
    try {
        const parsed = JSON.parse(raw) as Partial<Record<DebugChannel, unknown>>;
        DEBUG_CHANNELS.forEach(({ id }) => { next[id] = parsed[id] === true; });
    } catch {
        return next;
    }
    return next;
};

export const DebugLoggingProvider = ({ children }: { children: ReactNode }) => {
    const [settings, setSettings] = useState<DebugChannelSettings>(disabledSettings);
    const [isHydrating, setIsHydrating] = useState(true);

    useEffect(() => {
        let active = true;
        void AsyncStorage.getItem(DEBUG_SETTINGS_KEY).then((raw) => {
            if (!active) return;
            const stored = parseSettings(raw);
            runtimeSettings = stored;
            setSettings(stored);
            setIsHydrating(false);
        }).catch(() => {
            if (active) setIsHydrating(false);
        });
        return () => { active = false; };
    }, []);

    const persist = useCallback(async (next: DebugChannelSettings) => {
        runtimeSettings = next;
        setSettings(next);
        await AsyncStorage.setItem(DEBUG_SETTINGS_KEY, JSON.stringify(next));
    }, []);

    const setChannelEnabled = useCallback(async (channel: DebugChannel, enabled: boolean) => {
        await persist({ ...runtimeSettings, [channel]: enabled });
    }, [persist]);

    const disableAll = useCallback(async () => persist(disabledSettings()), [persist]);

    const value = useMemo(() => ({ settings, isHydrating, setChannelEnabled, disableAll }),
        [disableAll, isHydrating, setChannelEnabled, settings]);

    return <DebugLoggingContext.Provider value={value}>{children}</DebugLoggingContext.Provider>;
};

export const useDebugLogging = () => {
    const context = useContext(DebugLoggingContext);
    if (!context) throw new Error('useDebugLogging must be used inside DebugLoggingProvider.');
    return context;
};
