import { PropsWithChildren, useCallback, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { AppState } from 'react-native';

import { useAuthSession } from './authSession';
import { configurePushNotificationHandler, getPushNotificationDestination, registerCurrentDeviceForPush } from './pushNotifications';

configurePushNotificationHandler();

export const PushNotificationsProvider = ({ children }: PropsWithChildren) => {
    const router = useRouter();
    const { currentUser, isAuthenticated } = useAuthSession();
    const handledResponseId = useRef<string | null>(null);

    const handleResponse = useCallback((response: Notifications.NotificationResponse | null | undefined) => {
        if (!response || !isAuthenticated || !currentUser) return;
        const responseId = response.notification.request.identifier;
        if (handledResponseId.current === responseId) return;
        handledResponseId.current = responseId;

        const data = response.notification.request.content.data;
        router.push(getPushNotificationDestination(data));
    }, [currentUser, isAuthenticated, router]);

    useEffect(() => {
        if (!isAuthenticated || !currentUser?.accountId) return;
        void registerCurrentDeviceForPush();

        const tokenSubscription = Notifications.addPushTokenListener(() => {
            void registerCurrentDeviceForPush();
        });
        const appStateSubscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') void registerCurrentDeviceForPush();
        });
        return () => {
            tokenSubscription.remove();
            appStateSubscription.remove();
        };
    }, [currentUser?.accountId, isAuthenticated]);

    useEffect(() => {
        const responseSubscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
        void Notifications.getLastNotificationResponseAsync().then(handleResponse);
        return () => responseSubscription.remove();
    }, [handleResponse]);

    return <>{children}</>;
};
