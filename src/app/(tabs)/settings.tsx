import { useState } from 'react';
import { ActivityIndicator, Alert, View, Text, Pressable, ScrollView, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthSession } from '../../lib/authSession';
import { syncAllSupabaseData } from '../../lib/supabaseSync';
import { useTheme, useThemedStyles } from '../../lib/theme';

const SETTINGS_ITEMS = [
    {
        id: 'profile',
        title: 'Profile',
        subtitle: 'Change name and picture',
        iconSet: 'ionicons',
        iconName: 'person',
    },
    {
        id: 'switch-business',
        title: 'Switch Business',
        subtitle: 'Choose another business or stall',
        iconSet: 'material',
        iconName: 'store-switch-outline',
    },
    {
        id: 'security',
        title: 'Security',
        subtitle: 'Change password',
        iconSet: 'material',
        iconName: 'shield-check',
    },
    {
        id: 'app-details',
        title: 'App Details',
        subtitle: 'All about the application',
        iconSet: 'ionicons',
        iconName: 'information-circle',
    },
    {
        id: 'sync-database',
        title: 'Sync Database',
        subtitle: 'Sync pending products, sales, and categories',
        iconSet: 'material',
        iconName: 'cloud-sync-outline',
    },
    {
        id: 'test-sms',
        title: 'Test SMS',
        subtitle: 'Test developer OTP activation',
        iconSet: 'material',
        iconName: 'message-lock-outline',
    },
    {
        id: 'debug-logging',
        title: 'Debug Logging',
        subtitle: 'Choose diagnostic console channels',
        iconSet: 'material',
        iconName: 'bug-outline',
    },
] as const;

type IconSet = 'ionicons' | 'material';
type SettingId = 'profile' | 'switch-business' | 'security' | 'app-details' | 'sync-database' | 'test-sms' | 'debug-logging';

interface SettingItem {
    id: SettingId;
    title: string;
    subtitle: string;
    iconSet: IconSet;
    iconName: string;
}

interface SettingsIconProps {
    iconSet: IconSet;
    iconName: string;
}

const typedSettingsItems: readonly SettingItem[] = SETTINGS_ITEMS;

const SettingsIcon = ({ iconSet, iconName }: SettingsIconProps) => {
    const { colors } = useTheme();
    if (iconSet === 'material') {
        return <MaterialCommunityIcons name={iconName as any} size={28} color={colors.icon} />;
    }

    return <Ionicons name={iconName as any} size={28} color={colors.icon} />;
};

const Settings = () => {
    const router = useRouter();
    const { currentUser, logout } = useAuthSession();
    const { isDark, colors, setMode } = useTheme();
    const styles = useThemedStyles(baseStyles);
    const [isSyncing, setIsSyncing] = useState(false);
    const isDeveloper = currentUser?.profileTable === 'developer';
    const visibleSettingsItems = typedSettingsItems.filter((item) => {
        if (item.id === 'test-sms' || item.id === 'debug-logging') return isDeveloper;
        return isDeveloper ? item.id !== 'profile' : item.id !== 'switch-business';
    });

    const handleManualSync = async () => {
        if (isSyncing) return;

        if (!currentUser?.accountId || !currentUser.stallNumber) {
            Alert.alert(
                'No active stall',
                'Select or configure a business with an active stall before syncing.',
            );
            return;
        }

        setIsSyncing(true);

        try {
            const result = await syncAllSupabaseData({
                accountId: currentUser.accountId,
                stallNumber: currentUser.stallNumber,
            });
            const rows = [
                `Sales: ${result.transactions.synced}/${result.transactions.attempted}`,
                `Products: ${result.products.synced}/${result.products.attempted}`,
                `Categories: ${result.categories.synced}/${result.categories.attempted}`,
            ];
            const hasFailures = result.transactions.synced < result.transactions.attempted
                || result.products.synced < result.products.attempted
                || result.categories.synced < result.categories.attempted
                || Boolean(result.products.error)
                || Boolean(result.categories.error)
                || Boolean(result.personnel.error);

            if (hasFailures) {
                const errors = [result.products.error, result.categories.error, result.personnel.error]
                    .filter((error): error is string => Boolean(error));
                Alert.alert(
                    'Sync partially completed',
                    [...rows, '', 'Some records remain queued for another attempt.', ...errors].join('\n'),
                );
                return;
            }

            const attempted = result.transactions.attempted
                + result.products.attempted
                + result.categories.attempted;
            Alert.alert(
                'Database synced',
                attempted === 0
                    ? 'Everything is already up to date.'
                    : rows.join('\n'),
            );
        } catch (error) {
            Alert.alert(
                'Sync failed',
                error instanceof Error
                    ? `${error.message}\n\nYour pending records are still saved and can be retried.`
                    : 'Unable to sync right now. Your pending records are still saved and can be retried.',
            );
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSettingPress = (id: SettingId) => {
        if (id === 'sync-database') {
            void handleManualSync();
            return;
        }

        if (id === 'profile') {
            router.push('/profile');
            return;
        }

        if (id === 'switch-business') {
            router.push('/select-business');
            return;
        }

        if (id === 'security') {
            router.push('/security');
            return;
        }

        if (id === 'test-sms') {
            router.push('/test-sms');
            return;
        }

        if (id === 'debug-logging') {
            router.push('/debug-logging');
        }
    };

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.container}>
                <Text style={styles.pageTitle}>Settings</Text>

                <ScrollView contentContainerStyle={styles.cardsWrap} showsVerticalScrollIndicator={false}>
                    <View style={styles.itemCard} accessibilityRole="none">
                        <View style={styles.itemRow}>
                            <View style={styles.iconCircle}>
                                <Ionicons name="moon" size={28} color={colors.icon} />
                            </View>
                            <View style={styles.itemTextWrap}>
                                <Text style={styles.itemTitle}>Dark Mode</Text>
                                <Text style={styles.itemSubtitle}>Use a darker app appearance</Text>
                            </View>
                            <Switch
                                value={isDark}
                                onValueChange={(enabled) => { void setMode(enabled ? 'dark' : 'light'); }}
                                trackColor={{ false: colors.borderStrong, true: colors.primarySoft }}
                                thumbColor={isDark ? colors.primary : '#f4f4f5'}
                                ios_backgroundColor={colors.borderStrong}
                                accessibilityLabel="Dark Mode"
                                accessibilityRole="switch"
                                accessibilityState={{ checked: isDark }}
                            />
                        </View>
                    </View>
                    {visibleSettingsItems.map((item) => {
                        const isSyncAction = item.id === 'sync-database';

                        return (
                            <Pressable
                                key={item.id}
                                style={({ pressed }) => [
                                    styles.itemCard,
                                    isSyncAction && isSyncing && styles.itemCardDisabled,
                                    pressed && !(isSyncAction && isSyncing) && styles.itemCardPressed,
                                ]}
                                onPress={() => handleSettingPress(item.id)}
                                disabled={isSyncAction && isSyncing}
                                accessibilityRole="button"
                                accessibilityState={{ disabled: isSyncAction && isSyncing, busy: isSyncAction && isSyncing }}
                            >
                                <View style={styles.itemRow}>
                                    <View style={styles.iconCircle}>
                                        <SettingsIcon iconSet={item.iconSet} iconName={item.iconName} />
                                    </View>

                                    <View style={styles.itemTextWrap}>
                                        <Text style={styles.itemTitle}>{isSyncAction && isSyncing ? 'Syncing\u2026' : item.title}</Text>
                                        <Text style={styles.itemSubtitle}>
                                            {isSyncAction && isSyncing ? 'Please keep the app open' : item.subtitle}
                                        </Text>
                                    </View>

                                    {isSyncAction
                                        ? (isSyncing ? <ActivityIndicator size="small" color={colors.primary} /> : null)
                                        : <Ionicons name="chevron-forward" size={28} color={colors.icon} />}
                                </View>
                            </Pressable>
                        );
                    })}

                    <Pressable
                        style={styles.logoutButton}
                        onPress={async () => {
                            await logout();
                            router.replace('/');
                        }}
                    >
                        <Text style={styles.logoutText}>Logout</Text>
                    </Pressable>
                </ScrollView>
            </View>
        </SafeAreaView>
    );
};

export default Settings;

const baseStyles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#dfe2ec',
    },
    container: {
        flex: 1,
    },
    pageTitle: {
        marginTop: 10,
        marginBottom: 14,
        paddingHorizontal: 16,
        fontSize: 48 / 2,
        fontWeight: '800',
        color: '#20252c',
    },
    cardsWrap: {
        flexGrow: 1,
        backgroundColor: '#d7dbe7',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 28,
    },
    itemCard: {
        minHeight: 110,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#d0d4df',
        backgroundColor: '#f4f4f5',
        paddingHorizontal: 14,
        marginBottom: 14,
        shadowColor: '#000000',
        shadowOpacity: 0.13,
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 4,
        elevation: 3,
        justifyContent: 'center',
    },
    itemCardDisabled: {
        opacity: 0.7,
    },
    itemCardPressed: {
        opacity: 0.82,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconCircle: {
        width: 58,
        height: 58,
        borderRadius: 29,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#a9beef',
        marginRight: 16,
    },
    itemTextWrap: {
        flex: 1,
        paddingRight: 12,
    },
    itemTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#252a32',
    },
    itemSubtitle: {
        marginTop: 2,
        fontSize: 33 / 2,
        fontWeight: '600',
        color: '#7d818b',
    },
    logoutButton: {
        height: 54,
        borderRadius: 12,
        backgroundColor: '#cf5a53',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 18,
        shadowColor: '#000000',
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 2,
    },
    logoutText: {
        fontSize: 22,
        fontWeight: '800',
        color: '#ffffff',
    },
});
