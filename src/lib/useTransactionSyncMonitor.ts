import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useRef } from 'react';

import { syncUnsyncedTransactions } from './transactionsSync';

const SYNC_RETRY_INTERVAL_MS = 30_000;

const isInternetReachable = (isConnected: boolean | null, isReachable: boolean | null) => (
    isConnected === true && isReachable !== false
);

export const useTransactionSyncMonitor = (accountId?: number | null) => {
    const isSyncingRef = useRef(false);
    const wasReachableRef = useRef<boolean | null>(null);

    const retrySync = useCallback(async () => {
        if (!accountId || isSyncingRef.current) {
            return;
        }

        isSyncingRef.current = true;

        try {
            await syncUnsyncedTransactions(accountId);
        } finally {
            isSyncingRef.current = false;
        }
    }, [accountId]);

    useEffect(() => {
        if (!accountId) {
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

        return () => {
            unsubscribe();
            clearInterval(interval);
        };
    }, [accountId, retrySync]);
};
