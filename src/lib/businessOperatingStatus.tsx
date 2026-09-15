import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuthSession } from './authSession';
import { isSupabaseConfigured, supabase } from './supabase';

interface OperatingStatusRow {
    business_id: number;
    stall_number: string | null;
    is_open: boolean;
    updated_at: string;
    updated_by_account_id: number | null;
}

interface OperatingStatusResult {
    success: boolean;
    error?: string;
}

interface BusinessOperatingStatusContextValue {
    isOpen: boolean | null;
    isLoading: boolean;
    isUpdating: boolean;
    error: string | null;
    canToggle: boolean;
    refresh: () => Promise<void>;
    setIsOpen: (nextIsOpen: boolean) => Promise<OperatingStatusResult>;
}

const BusinessOperatingStatusContext = createContext<BusinessOperatingStatusContextValue | null>(null);
const statusCacheKey = (businessId: number) => `@pos/business-operating-status:${businessId}`;

const firstRow = (data: unknown): OperatingStatusRow | null => {
    const value = Array.isArray(data) ? data[0] : data;
    if (!value || typeof value !== 'object') return null;
    const row = value as Partial<OperatingStatusRow>;
    if (typeof row.business_id !== 'number' || typeof row.is_open !== 'boolean') return null;
    return row as OperatingStatusRow;
};

const friendlyError = (message?: string) => {
    const normalized = message ?? '';
    if (normalized.includes('OPERATING_STATUS_FORBIDDEN')) {
        return 'Only the owner or approved personnel can change this status.';
    }
    if (normalized.includes('Failed to fetch') || normalized.includes('Network request failed')) {
        return 'Unable to reach the server. Check your connection and try again.';
    }
    return normalized || 'Unable to load the stall status. Please try again.';
};

export const BusinessOperatingStatusProvider = ({ children }: { children: ReactNode }) => {
    const { currentUser } = useAuthSession();
    const businessId = currentUser?.businessId ?? null;
    const canToggle = currentUser?.profileTable === 'business_owner' || currentUser?.profileTable === 'vendor';
    const [row, setRow] = useState<OperatingStatusRow | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!businessId) {
            setRow(null);
            setError(null);
            setIsLoading(false);
            return;
        }
        if (!isSupabaseConfigured || !supabase) {
            setRow(null);
            setError('Unable to reach the server. Check your connection and try again.');
            return;
        }

        setIsLoading(true);
        const { data, error: requestError } = await supabase.rpc('get_business_operating_status', {
            p_business_id: businessId,
        });
        if (requestError) {
            setError(friendlyError(requestError.message));
        } else {
            const nextRow = firstRow(data);
            setRow(nextRow);
            setError(nextRow ? null : 'No operating status is configured for this business.');
            if (nextRow) void AsyncStorage.setItem(statusCacheKey(businessId), JSON.stringify(nextRow));
        }
        setIsLoading(false);
    }, [businessId]);

    useEffect(() => {
        setRow(null);
        setError(null);
        if (!businessId) {
            void refresh();
            return;
        }
        let active = true;
        const hydrate = async () => {
            try {
                const cached = firstRow(JSON.parse(await AsyncStorage.getItem(statusCacheKey(businessId)) ?? 'null'));
                if (active && cached?.business_id === businessId) setRow(cached);
            } catch {
                // A malformed cache should never prevent a server refresh.
            }
            if (active) await refresh();
        };
        void hydrate();
        return () => { active = false; };
    }, [businessId, refresh]);

    useEffect(() => {
        if (!businessId || !supabase) return undefined;
        const client = supabase;
        const channel = client
            .channel(`business-operating-status:${businessId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'business_operating_status',
                filter: `business_id=eq.${businessId}`,
            }, () => { void refresh(); })
            .subscribe();

        return () => { void client.removeChannel(channel); };
    }, [businessId, refresh]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') void refresh();
        });
        return () => subscription.remove();
    }, [refresh]);

    const updateStatus = useCallback(async (nextIsOpen: boolean): Promise<OperatingStatusResult> => {
        if (!canToggle) {
            const message = 'Only the owner or approved personnel can change this status.';
            setError(message);
            return { success: false, error: message };
        }
        if (!businessId || !supabase || isUpdating) {
            const message = isUpdating
                ? 'The stall status is already being updated.'
                : 'Unable to reach the server. Check your connection and try again.';
            setError(message);
            return { success: false, error: message };
        }

        setIsUpdating(true);
        setError(null);
        const { data, error: requestError } = await supabase.rpc('set_business_operating_status', {
            p_business_id: businessId,
            p_is_open: nextIsOpen,
        });
        setIsUpdating(false);

        if (requestError) {
            const message = friendlyError(requestError.message);
            setError(message);
            return { success: false, error: message };
        }

        const nextRow = firstRow(data);
        if (nextRow) {
            setRow(nextRow);
            void AsyncStorage.setItem(statusCacheKey(businessId), JSON.stringify(nextRow));
        }
        return { success: true };
    }, [businessId, canToggle, isUpdating]);

    const value = useMemo<BusinessOperatingStatusContextValue>(() => ({
        isOpen: row?.is_open ?? null,
        isLoading,
        isUpdating,
        error,
        canToggle,
        refresh,
        setIsOpen: updateStatus,
    }), [row, isLoading, isUpdating, error, canToggle, refresh, updateStatus]);

    return (
        <BusinessOperatingStatusContext.Provider value={value}>
            {children}
        </BusinessOperatingStatusContext.Provider>
    );
};

export const useBusinessOperatingStatus = () => {
    const context = useContext(BusinessOperatingStatusContext);
    if (!context) throw new Error('useBusinessOperatingStatus must be used within BusinessOperatingStatusProvider');
    return context;
};
