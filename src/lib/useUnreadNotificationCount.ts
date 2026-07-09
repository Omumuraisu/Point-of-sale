import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fetchUnreadNotificationCount } from './mobileNotifications';

const NOTIFICATION_REFRESH_INTERVAL_MS = 15000;

export const useUnreadNotificationCount = (accountId?: number) => {
    const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

    const refreshUnreadNotificationCount = useCallback(async () => {
        const unreadCount = await fetchUnreadNotificationCount(accountId);
        setUnreadNotificationCount(unreadCount);
    }, [accountId]);

    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            const refreshIfActive = async () => {
                const unreadCount = await fetchUnreadNotificationCount(accountId);

                if (isActive) {
                    setUnreadNotificationCount(unreadCount);
                }
            };

            void refreshIfActive();

            const intervalId = setInterval(() => {
                if (AppState.currentState === 'active') {
                    void refreshIfActive();
                }
            }, NOTIFICATION_REFRESH_INTERVAL_MS);

            return () => {
                isActive = false;
                clearInterval(intervalId);
            };
        }, [accountId]),
    );

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') {
                void refreshUnreadNotificationCount();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [refreshUnreadNotificationCount]);

    return {
        unreadNotificationCount,
        refreshUnreadNotificationCount,
    };
};
