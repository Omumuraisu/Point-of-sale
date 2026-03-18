import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const RECENT_NOTIFICATIONS = [
    {
        id: 'overdue',
        title: 'Rent Overdue',
        message: 'Your payment for Stall #4 is 2 days late. Kindly visit the office to settle your bill of Php 843.00',
        time: '4 mins ago',
        type: 'warning' as const,
        actionLabel: 'View Bill',
        actionType: 'danger' as const,
    },
    {
        id: 'renewal',
        title: 'Lease Renewal',
        message: 'Your lease for the Stall #4 will end in 30 days. Kindly visit the office to review and renew your lease to keep your spot',
        time: '7 mins ago',
        type: 'alert' as const,
        actionLabel: 'Mark as Read',
        actionType: 'primary' as const,
    },
];

const OLD_NOTIFICATIONS = [
    {
        id: 'payment',
        title: 'Rent Payment',
        message: 'Your rent payment of Php 843.00 has been successfully processed on 02-04-26 10:45AM.',
        time: '1 month ago',
        type: 'success' as const,
    },
];

type NotificationType = 'warning' | 'alert' | 'success';

interface NotificationCardProps {
    title: string;
    message: string;
    time: string;
    type: NotificationType;
    actionLabel?: string;
    actionType?: 'danger' | 'primary';
}

function NotificationCard({ title, message, time, type, actionLabel, actionType }: NotificationCardProps) {
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
                                style={[
                                    styles.actionPill,
                                    actionType === 'danger' ? styles.actionPillDanger : styles.actionPillPrimary,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.actionLabel,
                                        actionType === 'danger' ? styles.actionLabelDanger : styles.actionLabelPrimary,
                                    ]}
                                >
                                    {actionLabel}
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

export default function Notifications() {
    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
                <Text style={styles.pageTitle}>Notifications</Text>

                <Text style={styles.sectionTitle}>Recent</Text>
                {RECENT_NOTIFICATIONS.map((item) => (
                    <NotificationCard
                        key={item.id}
                        title={item.title}
                        message={item.message}
                        time={item.time}
                        type={item.type}
                        actionLabel={item.actionLabel}
                        actionType={item.actionType}
                    />
                ))}

                <Text style={[styles.sectionTitle, styles.oldSectionTitle]}>Old</Text>
                {OLD_NOTIFICATIONS.map((item) => (
                    <NotificationCard
                        key={item.id}
                        title={item.title}
                        message={item.message}
                        time={item.time}
                        type={item.type}
                    />
                ))}
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
