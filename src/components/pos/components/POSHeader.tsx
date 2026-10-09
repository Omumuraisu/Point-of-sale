import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthSession } from '../../../lib/authSession';
import { useUnreadNotificationCount } from '../../../lib/useUnreadNotificationCount';
import { useTheme, useThemedStyles } from '../../../lib/theme';
import { getUserRoleLabel } from '../../../lib/userRole';

const CURRENT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
});

const POSHeader = () => {
    const styles = useThemedStyles(baseStyles);
    const { colors } = useTheme();
    const router = useRouter();
    const { currentUser } = useAuthSession();
    const { unreadNotificationCount } = useUnreadNotificationCount(currentUser?.accountId);
    const currentDateLabel = CURRENT_DATE_FORMATTER.format(new Date());

    return (
        <View style={styles.headerRow}>
            <View style={styles.profileGroup}>
                <View style={styles.avatarCircle}>
                    {currentUser?.profilePictureUrl ? (
                        <Image source={{ uri: currentUser.profilePictureUrl }} style={styles.avatarImage} />
                    ) : (
                    <Ionicons name="person" size={26} color={colors.icon} />
                    )}
                </View>
                <View style={styles.profileDetails}>
                    <Text style={styles.profileName} numberOfLines={1}>
                        {currentUser?.displayName ?? 'Loading...'}
                    </Text>
                    <View style={styles.profileMetaRow}>
                        {currentUser ? (
                            <View style={styles.roleBadge}>
                                <Text style={styles.roleLabel}>{getUserRoleLabel(currentUser.profileTable)}</Text>
                            </View>
                        ) : null}
                        <Text style={styles.profileDate}>{currentDateLabel}</Text>
                    </View>
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
            </View>
        </View>
    );
};

export default POSHeader;

const baseStyles = StyleSheet.create({
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    profileGroup: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minWidth: 0,
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
    profileDetails: {
        flex: 1,
        minWidth: 0,
    },
    profileName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f1014',
    },
    profileMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 3,
    },
    roleBadge: {
        borderRadius: 8,
        backgroundColor: '#dbe4ff',
        paddingHorizontal: 7,
        paddingVertical: 2,
    },
    roleLabel: {
        fontSize: 9,
        lineHeight: 11,
        fontWeight: '800',
        color: '#2448a4',
        letterSpacing: 0.3,
    },
    profileDate: {
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
