import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { syncAllSupabaseData } from './supabaseSync';

const SYNC_RETRY_INTERVAL_MS = 30_000;

const isInternetReachable = (isConnected: boolean | null, isReachable: boolean | null) => (
    isConnected === true && isReachable !== false
);

export const useTransactionSyncMonitor = (
    accountId?: number | null,
    businessId?: number | null,
    stallNumber?: string | null,
) => {
    const isSyncingRef = useRef(false);
    const wasReachableRef = useRef<boolean | null>(null);

    const retrySync = useCallback(async () => {
        if (!accountId || !businessId || !stallNumber || isSyncingRef.current) {
            return;
        }

        isSyncingRef.current = true;

        try {
            await syncAllSupabaseData({ accountId, businessId, stallNumber });
        } finally {
            isSyncingRef.current = false;
        }
    }, [accountId, businessId, stallNumber]);

    useEffect(() => {
        if (!accountId || !businessId || !stallNumber) {
            return undefined;
        }

        const unsubscribe = NetInfo.addEventListener((state) => {
            const reachable = isInternetReachable(state.isConnected, state.isInternetReachable);
            const justReconnected = reachable && wasReachableRef.current === false;
            wasReachableRef.current = reachable;

            if (reachable && justReconnected) {
                void retrySync();
            }
        });

        void NetInfo.fetch().then((state) => {
            const reachable = isInternetReachable(state.isConnected, state.isInternetReachable);
            wasReachableRef.current = reachable;

            if (reachable) {
                void retrySync();
            }
        });

        const interval = setInterval(() => {
            void NetInfo.fetch().then((state) => {
                if (isInternetReachable(state.isConnected, state.isInternetReachable)) {
                    void retrySync();
                }
            });
        }, SYNC_RETRY_INTERVAL_MS);

        const appStateSubscription = AppState.addEventListener('change', (state) => {
            if (state !== 'active') return;
            void NetInfo.fetch().then((networkState) => {
                if (isInternetReachable(networkState.isConnected, networkState.isInternetReachable)) {
                    void retrySync();
                }
            });
        });

        return () => {
            unsubscribe();
            clearInterval(interval);
            appStateSubscription.remove();
        };
    }, [accountId, businessId, stallNumber, retrySync]);
};
