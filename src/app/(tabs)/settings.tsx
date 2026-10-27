import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View, Text, Pressable, ScrollView, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthSession } from '../../lib/authSession';
import { DatabaseSyncStatus, getDatabaseSyncStatus, subscribeToDatabaseSyncStatus, syncAllSupabaseData } from '../../lib/supabaseSync';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { subscribeToProductSyncChanges } from '../../components/pos/productsStore';
import { subscribeToTransactionSyncEvents } from '../../lib/transactionSyncEvents';

const SETTINGS_ITEMS = [
    {
        id: 'profile',
        title: 'Profile',
        subtitle: 'View account details and picture',
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
        subtitle: 'Change password with email or SMS OTP',
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
        title: 'Sync to Database',
        subtitle: 'Check pending records and sync activity',
        iconSet: 'material',
        iconName: 'sync',
    },
    {
        id: 'test-sms',
        title: 'Test Activation',
        subtitle: 'Test developer email or SMS activation',
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

const formatLastSynced = (timestamp: number | null) => {
    if (!timestamp) return 'Never synced';

    return `Last synced ${new Date(timestamp).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    })}`;
};

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
    const [syncStatus, setSyncStatus] = useState<DatabaseSyncStatus>({
        pending: 0, queued: 0, failed: 0, syncing: false, lastSyncedAt: null,
        sales: { queued: 0, failed: 0 }, products: { queued: 0, failed: 0 },
    });
    const isDeveloper = currentUser?.profileTable === 'developer';
    const visibleSettingsItems = typedSettingsItems.filter((item) => {
        if (item.id === 'test-sms' || item.id === 'debug-logging') return isDeveloper;
        return isDeveloper || item.id !== 'switch-business';
    });

    const refreshSyncStatus = useCallback(async () => {
        if (!currentUser?.accountId || !currentUser.businessId || !currentUser.stallNumber) {
            setSyncStatus({
                pending: 0, queued: 0, failed: 0, syncing: false, lastSyncedAt: null,
                sales: { queued: 0, failed: 0 }, products: { queued: 0, failed: 0 },
            });
            return;
        }

        try {
            const status = await getDatabaseSyncStatus({
                accountId: currentUser.accountId,
                businessId: currentUser.businessId,
                stallNumber: currentUser.stallNumber,
            });
            setSyncStatus(status);
        } catch {
            // Keep the last known status if local storage is temporarily unavailable.
        }
    }, [currentUser?.accountId, currentUser?.businessId, currentUser?.stallNumber]);

    useEffect(() => {
        void refreshSyncStatus();
        const unsubscribeProducts = subscribeToProductSyncChanges(() => { void refreshSyncStatus(); });
        const unsubscribeTransactions = subscribeToTransactionSyncEvents(() => { void refreshSyncStatus(); });
        const unsubscribeDatabaseSync = subscribeToDatabaseSyncStatus(() => { void refreshSyncStatus(); });
        return () => {
            unsubscribeProducts();
            unsubscribeTransactions();
            unsubscribeDatabaseSync();
        };
    }, [refreshSyncStatus]);

    const handleManualSync = async () => {
        if (isSyncing) return;

        if (!currentUser?.accountId || !currentUser.businessId || !currentUser.stallNumber) {
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
                businessId: currentUser.businessId,
                stallNumber: currentUser.stallNumber,
            });
            const rows = [
                `Sales: ${result.sales.synced}/${result.sales.attempted}`,
                `Products: ${result.products.synced}/${result.products.attempted}`,
            ];
            const hasFailures = result.sales.remaining > 0
                || result.products.remaining > 0
                || Boolean(result.lastError);

            if (hasFailures) {
                const errors = [result.sales.error, result.products.error]
                    .filter((error): error is string => Boolean(error));
                Alert.alert(
                    'Sync partially completed',
                    [...rows, '', 'Some records remain queued for another attempt.', ...errors].join('\n'),
                );
                return;
            }

            const attempted = result.sales.attempted + result.products.attempted;
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
            await refreshSyncStatus();
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

        if (id === 'app-details') {
            router.push('/app-details');
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
                                    <View style={[styles.iconCircle, isSyncAction && styles.syncIconCircle]}>
                                        {isSyncAction ? (
                                            <MaterialCommunityIcons name="sync" size={32} color={colors.success} />
                                        ) : (
                                            <SettingsIcon iconSet={item.iconSet} iconName={item.iconName} />
                                        )}
                                    </View>

                                    <View style={styles.itemTextWrap}>
                                        <Text style={styles.itemTitle}>{isSyncAction && isSyncing ? 'Syncing\u2026' : item.title}</Text>
                                        <Text style={styles.itemSubtitle}>
                                            {isSyncAction
                                                ? (isSyncing
                                                    ? `${syncStatus.queued} queued | Please keep the app open`
                                                    : `${syncStatus.queued} queued (${syncStatus.failed} failed) | ${formatLastSynced(syncStatus.lastSyncedAt)}`)
                                                : item.subtitle}
                                        </Text>
                                    </View>

                                    {isSyncAction
                                        ? (isSyncing
                                            ? <ActivityIndicator size="small" color={colors.success} />
                                            : <Ionicons name="chevron-forward" size={28} color={colors.icon} />)
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
    syncIconCircle: {
        backgroundColor: '#d9f1dc',
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
