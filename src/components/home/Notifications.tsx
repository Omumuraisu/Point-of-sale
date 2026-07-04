import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuthSession } from '../../lib/authSession';
import {
    fetchNotifications,
    markNotificationAsRead,
    MobileNotification,
} from '../../lib/mobileNotifications';

type NotificationType = 'warning' | 'alert' | 'success';

interface NotificationCardProps {
    title: string;
    message: string;
    time: string;
    type: NotificationType;
    actionLabel?: string;
    actionType?: 'danger' | 'primary';
    isBusy?: boolean;
    onActionPress?: () => void;
}

function NotificationCard({
    title,
    message,
    time,
    type,
    actionLabel,
    actionType,
    isBusy,
    onActionPress,
}: NotificationCardProps) {
    const palette = NOTIFICATION_THEME[type];

    return (
        <View style={[styles.card, { borderLeftColor: palette.borderLeft }]}>
            <View style={styles.cardRow}>
                <View style={[styles.iconWrap, { backgroundColor: palette.iconBg }]}>
                    {type === 'warning' ? <Ionicons name="warning" size={28} color={palette.iconColor} /> : null}
                    {type === 'alert' ? <MaterialCommunityIcons name="file-document-outline" size={28} color={palette.iconColor} /> : null}
                    {type === 'success' ? <Ionicons name="checkmark" size={30} color={palette.iconColor} /> : null}
                </View>

                <View style={styles.textWrap}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title}>{title}</Text>
                        <Text style={styles.time}>{time}</Text>
                    </View>
                    <Text style={styles.message}>{message}</Text>

                    {actionLabel ? (
                        <View style={styles.actionRow}>
                            <Pressable
                                onPress={onActionPress}
                                disabled={isBusy}
                                style={[
                                    styles.actionPill,
                                    actionType === 'danger' ? styles.actionPillDanger : styles.actionPillPrimary,
                                    isBusy ? styles.actionPillDisabled : null,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.actionLabel,
                                        actionType === 'danger' ? styles.actionLabelDanger : styles.actionLabelPrimary,
                                    ]}
                                >
                                    {isBusy ? 'Saving...' : actionLabel}
                                </Text>
                            </Pressable>
                        </View>
                    ) : null}
                </View>
            </View>
        </View>
    );
}

const NOTIFICATION_THEME = {
    warning: {
        borderLeft: '#d95f57',
        iconBg: '#f1d9d7',
        iconColor: '#d95f57',
    },
    alert: {
        borderLeft: '#e5c13d',
        iconBg: '#f5ebbf',
        iconColor: '#e4c444',
    },
    success: {
        borderLeft: '#4aad5d',
        iconBg: '#bde6c2',
        iconColor: '#4aad5d',
    },
} as const;

const formatNotificationTitle = (notification: MobileNotification) => {
    if (notification.notificationType === 'vendor_compliance_requested') {
        return notification.title || 'Vendor compliance request';
    }

    if (notification.notificationType === 'billing_submitted') {
        return 'Monthly Bill';
    }

    return notification.title;
};

const formatNotificationMessage = (notification: MobileNotification) => {
    if (notification.notificationType !== 'vendor_compliance_requested') {
        return notification.message;
    }

    const match = notification.message.match(/^(.*?:)\s*(.*?)\.\s*Notes:\s*(.*)$/i);

    if (!match) {
        return notification.message;
    }

    const [, intro, requirementsText, note] = match;
    const requirements = requirementsText
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

    if (requirements.length === 0) {
        return notification.message;
    }

    return [
        intro,
        ...requirements.map((requirement) => `- ${requirement}`),
        '',
        'Notes:',
        note.trim(),
    ].join('\n');
};

const getNotificationType = (notification: MobileNotification): NotificationType => {
    if (notification.notificationType === 'vendor_compliance_requested') {
        return 'warning';
    }

    if (notification.notificationType === 'billing_payment_reminder') {
        return 'warning';
    }

    return 'alert';
};

const getReadNotificationAction = (notification: MobileNotification) => {
    if (notification.notificationType === 'vendor_compliance_requested') {
        return undefined;
    }

    if (
        notification.notificationType === 'billing_submitted'
        || notification.notificationType === 'billing_payment_reminder'
    ) {
        return 'View Bill';
    }

    return undefined;
};

const formatNotificationTime = (createdAt: string) => {
    const timestamp = new Date(createdAt).getTime();

    if (!Number.isFinite(timestamp)) {
        return '';
    }

    const diffMs = Date.now() - timestamp;
    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

    if (diffMinutes < 1) {
        return 'Just now';
    }

    if (diffMinutes < 60) {
        return `${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);

    if (diffHours < 24) {
        return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    }

    const diffDays = Math.floor(diffHours / 24);

    if (diffDays < 30) {
        return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    }

    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
};

export default function Notifications() {
    const router = useRouter();
    const { currentUser } = useAuthSession();
    const [recentNotifications, setRecentNotifications] = useState<MobileNotification[]>([]);
    const [oldNotifications, setOldNotifications] = useState<MobileNotification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeNotificationId, setActiveNotificationId] = useState<number | null>(null);

    const loadNotifications = useCallback(async () => {
        setIsLoading(true);

        const [unread, read] = await Promise.all([
            fetchNotifications(currentUser?.accountId, 'unread'),
            fetchNotifications(currentUser?.accountId, 'read'),
        ]);

        setRecentNotifications(unread);
        setOldNotifications(read);
        setIsLoading(false);
    }, [currentUser?.accountId]);

    useFocusEffect(
        useCallback(() => {
            let isMounted = true;

            const hydrate = async () => {
                setIsLoading(true);

                const [unread, read] = await Promise.all([
                    fetchNotifications(currentUser?.accountId, 'unread'),
                    fetchNotifications(currentUser?.accountId, 'read'),
                ]);

                if (isMounted) {
                    setRecentNotifications(unread);
                    setOldNotifications(read);
                    setIsLoading(false);
                }
            };

            void hydrate();

            return () => {
                isMounted = false;
            };
        }, [currentUser?.accountId]),
    );

    const handleMarkAsRead = async (notificationId: number) => {
        setActiveNotificationId(notificationId);
        const didUpdate = await markNotificationAsRead(notificationId, currentUser?.accountId);
        setActiveNotificationId(null);

        if (didUpdate) {
            await loadNotifications();
        }
    };

    const hasNotifications = recentNotifications.length > 0 || oldNotifications.length > 0;

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
                <Text style={styles.pageTitle}>Notifications</Text>

                {isLoading ? (
                    <View style={styles.stateCard}>
                        <ActivityIndicator color="#2f5ada" />
                        <Text style={styles.stateText}>Loading notifications...</Text>
                    </View>
                ) : null}

                {!isLoading && !hasNotifications ? (
                    <View style={styles.stateCard}>
                        <Ionicons name="notifications-outline" size={30} color="#687083" />
                        <Text style={styles.stateTitle}>No notifications yet</Text>
                        <Text style={styles.stateText}>Billing and compliance notices will appear here once available.</Text>
                    </View>
                ) : null}

                {!isLoading && recentNotifications.length > 0 ? (
                    <>
                        <Text style={styles.sectionTitle}>Recent</Text>
                        {recentNotifications.map((item) => (
                            <NotificationCard
                                key={item.notificationId}
                                title={formatNotificationTitle(item)}
                                message={formatNotificationMessage(item)}
                                time={formatNotificationTime(item.createdAt)}
                                type={getNotificationType(item)}
                                actionLabel="Mark as Read"
                                actionType="primary"
                                isBusy={activeNotificationId === item.notificationId}
                                onActionPress={() => void handleMarkAsRead(item.notificationId)}
                            />
                        ))}
                    </>
                ) : null}

                {!isLoading && oldNotifications.length > 0 ? (
                    <>
                        <Text style={[styles.sectionTitle, recentNotifications.length > 0 ? styles.oldSectionTitle : null]}>
                            Old
                        </Text>
                        {oldNotifications.map((item) => {
                            const actionLabel = getReadNotificationAction(item);

                            return (
                                <NotificationCard
                                    key={item.notificationId}
                                    title={formatNotificationTitle(item)}
                                    message={formatNotificationMessage(item)}
                                    time={formatNotificationTime(item.createdAt)}
                                    type="success"
                                    actionLabel={actionLabel}
                                    actionType="primary"
                                    onActionPress={actionLabel ? () => router.push('/rent') : undefined}
                                />
                            );
                        })}
                    </>
                ) : null}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#dfe2ec',
    },
    contentContainer: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 22,
    },
    pageTitle: {
        fontSize: 48 / 2,
        fontWeight: '800',
        color: '#10151c',
        marginBottom: 14,
    },
    sectionTitle: {
        fontSize: 36 / 2,
        fontWeight: '800',
        color: '#151a22',
        marginBottom: 10,
    },
    oldSectionTitle: {
        marginTop: 8,
    },
    stateCard: {
        minHeight: 118,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#d5d9e3',
        backgroundColor: '#f4f4f5',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingVertical: 18,
        marginTop: 8,
    },
    stateTitle: {
        marginTop: 8,
        fontSize: 18,
        fontWeight: '800',
        color: '#171b22',
    },
    stateText: {
        marginTop: 6,
        fontSize: 14,
        fontWeight: '600',
        color: '#687083',
        textAlign: 'center',
    },
    card: {
        borderRadius: 18,
        borderLeftWidth: 4,
        borderWidth: 1,
        borderColor: '#d5d9e3',
        backgroundColor: '#f4f4f5',
        paddingHorizontal: 10,
        paddingVertical: 12,
        marginBottom: 14,
        shadowColor: '#000000',
        shadowOpacity: 0.14,
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 4,
        elevation: 3,
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    iconWrap: {
        width: 62,
        height: 62,
        borderRadius: 31,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    textWrap: {
        flex: 1,
        paddingRight: 2,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    title: {
        fontSize: 37 / 2,
        fontWeight: '800',
        color: '#11151c',
        flexShrink: 1,
        paddingRight: 8,
    },
    time: {
        fontSize: 14,
        fontWeight: '700',
        color: '#7d818b',
        marginTop: 2,
    },
    message: {
        marginTop: 2,
        fontSize: 16,
        lineHeight: 21,
        color: '#252a32',
    },
    actionRow: {
        alignItems: 'flex-end',
        marginTop: 10,
    },
    actionPill: {
        minWidth: 148,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    actionPillDanger: {
        backgroundColor: '#f3dfde',
    },
    actionPillPrimary: {
        backgroundColor: '#cad7f7',
    },
    actionPillDisabled: {
        opacity: 0.65,
    },
    actionLabel: {
        fontSize: 34 / 2,
        fontWeight: '800',
    },
    actionLabelDanger: {
        color: '#d95f57',
    },
    actionLabelPrimary: {
        color: '#315fda',
    },
});
