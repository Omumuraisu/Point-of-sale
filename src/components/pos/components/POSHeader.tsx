import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthSession } from '../../../lib/authSession';
import { fetchUnreadNotificationCount } from '../../../lib/mobileNotifications';

const CURRENT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
});

const POSHeader = () => {
    const router = useRouter();
    const { currentUser } = useAuthSession();
    const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
    const currentDateLabel = CURRENT_DATE_FORMATTER.format(new Date());

    useFocusEffect(
        useCallback(() => {
            let isMounted = true;

            const hydrateUnreadCount = async () => {
                const unreadCount = await fetchUnreadNotificationCount(currentUser?.accountId);

                if (isMounted) {
                    setUnreadNotificationCount(unreadCount);
                }
            };

            void hydrateUnreadCount();

            return () => {
                isMounted = false;
            };
        }, [currentUser?.accountId]),
    );

    return (
        <View style={styles.headerRow}>
            <View style={styles.profileGroup}>
                <View style={styles.avatarCircle}>
                    {currentUser?.profilePictureUrl ? (
                        <Image source={{ uri: currentUser.profilePictureUrl }} style={styles.avatarImage} />
                    ) : (
                        <Ionicons name="person" size={26} color="#40444f" />
                    )}
                </View>
                <View>
                    <Text style={styles.profileName}>{currentUser?.displayName ?? 'Loading...'}</Text>
                    <Text style={styles.profileDate}>{currentDateLabel}</Text>
                </View>
            </View>
            <View style={styles.headerActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/notifications')}>
                    <Ionicons name="notifications" size={20} color="#f0cc42" />
                    {unreadNotificationCount > 0 ? (
                        <View style={styles.badgeDot}>
                            <Text style={styles.badgeText}>
                                {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                            </Text>
                        </View>
                    ) : null}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.primaryActionBtn]}>
                    <MaterialCommunityIcons name="cash-register" size={20} color="#ffffff" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default POSHeader;

const styles = StyleSheet.create({
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    profileGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatarCircle: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#eef0f5',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#c3c8d8',
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    profileName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f1014',
    },
    profileDate: {
        marginTop: 2,
        fontSize: 12,
        color: '#212328',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 10,
    },
    actionBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#f3f3f3',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#d3d7e1',
        position: 'relative',
    },
    primaryActionBtn: {
        backgroundColor: '#305ddf',
        borderColor: '#305ddf',
    },
    badgeDot: {
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#d95b57',
        position: 'absolute',
        top: 2,
        right: 1,
        borderWidth: 1,
        borderColor: '#f3f3f3',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    badgeText: {
        fontSize: 10,
        lineHeight: 12,
        fontWeight: '800',
        color: '#ffffff',
    },
});
