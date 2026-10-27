import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, Pressable, Switch, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { loadSavedTransactions } from '../pos/transactionsStore';
import { TransactionRecord } from '../../lib/types';
import { useAuthSession } from '../../lib/authSession';
import { loadRemoteSalesTransactions, mergeLocalAndRemoteTransactions } from '../../lib/transactionsSync';
import { subscribeToTransactionSyncEvents } from '../../lib/transactionSyncEvents';
import { useUnreadNotificationCount } from '../../lib/useUnreadNotificationCount';
import { getTodaySalesSummary } from '../../lib/salesMetrics';
import { formatCurrency } from '../../lib/utils';
import { useBusinessOperatingStatus } from '../../lib/businessOperatingStatus';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { getUserRoleLabel } from '../../lib/userRole';
import { loadHomeSalesCache, saveHomeSalesCache } from './homeSalesStore';

const CURRENT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
});

export default function Home() {
    const styles = useThemedStyles(baseStyles);
    const { colors } = useTheme();
    const router = useRouter();
    const { currentUser } = useAuthSession();
    const { isOpen, isLoading, isUpdating, error: statusError, canToggle, setIsOpen } = useBusinessOperatingStatus();
    const [recentSales, setRecentSales] = useState<TransactionRecord[]>([]);
    const [isSalesLoading, setIsSalesLoading] = useState(true);
    const activeSalesScope = useRef<string | null>(null);
    const salesRefreshGeneration = useRef(0);
    const { unreadNotificationCount } = useUnreadNotificationCount(currentUser?.accountId);
    const currentDateLabel = CURRENT_DATE_FORMATTER.format(new Date());
    const stallLabel = currentUser?.stallNumber ? `Stall ${currentUser.stallNumber}` : 'No stall assigned';
    const todaySales = useMemo(() => getTodaySalesSummary(recentSales), [recentSales]);

    useFocusEffect(
        useCallback(() => {
            let isMounted = true;
            const scope = currentUser?.accountId && currentUser.businessId && currentUser.stallNumber
                ? { accountId: currentUser.accountId, businessId: currentUser.businessId, stallNumber: currentUser.stallNumber }
                : null;
            const scopeKey = scope ? `${scope.accountId}:${scope.businessId}:${scope.stallNumber}` : null;
            if (activeSalesScope.current !== scopeKey) {
                activeSalesScope.current = scopeKey;
                setRecentSales([]);
                setIsSalesLoading(Boolean(scope));
            }

            const hydrateRecentSales = async () => {
                const generation = ++salesRefreshGeneration.current;
                if (!scope) {
                    if (isMounted && generation === salesRefreshGeneration.current) setIsSalesLoading(false);
                    return;
                }
                const [cachedTransactions, localTransactions] = await Promise.all([
                    loadHomeSalesCache(scope),
                    loadSavedTransactions(scope),
                ]);
                const cachedSnapshot = mergeLocalAndRemoteTransactions(localTransactions, cachedTransactions);
                const localSnapshot = mergeLocalAndRemoteTransactions(
                    cachedSnapshot,
                    localTransactions.filter((transaction) => !transaction.synced),
                );

                if (isMounted && generation === salesRefreshGeneration.current && localSnapshot.length > 0) {
                    setRecentSales(localSnapshot);
                    setIsSalesLoading(false);
                }

                const remoteTransactions = await loadRemoteSalesTransactions({ businessId: scope.businessId });
                const refreshedSnapshot = mergeLocalAndRemoteTransactions(localSnapshot, remoteTransactions);
                if (!isMounted || generation !== salesRefreshGeneration.current) return;
                await saveHomeSalesCache(scope, refreshedSnapshot);

                if (!isMounted || generation !== salesRefreshGeneration.current) return;
                setRecentSales(refreshedSnapshot);
                setIsSalesLoading(false);
            };

            void hydrateRecentSales();
            const unsubscribe = subscribeToTransactionSyncEvents(() => {
                void hydrateRecentSales();
            });

            return () => {
                isMounted = false;
                salesRefreshGeneration.current += 1;
                unsubscribe();
            };
        }, [currentUser?.accountId, currentUser?.businessId, currentUser?.stallNumber]),
    );

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.headerRow}>
                    <Pressable
                        style={({ pressed }) => [styles.profileGroup, pressed && styles.profileGroupPressed]}
                        onPress={() => router.push('/profile')}
                        accessibilityRole="button"
                        accessibilityLabel="Open profile"
                    >
                        <View style={styles.avatar}>
                            {currentUser?.profilePictureUrl ? (
                                <Image source={{ uri: currentUser.profilePictureUrl }} style={styles.avatarImage} />
                            ) : (
                                <Ionicons name="person" size={26} color={colors.icon} />
                            )}
                        </View>
                        <View style={styles.profileDetails}>
                            <Text style={styles.name} numberOfLines={1}>
                                {currentUser?.displayName ?? 'Loading...'}
                            </Text>
                            <View style={styles.profileMetaRow}>
                                {currentUser ? (
                                    <View style={styles.roleBadge}>
                                        <Text style={styles.roleLabel}>{getUserRoleLabel(currentUser.profileTable)}</Text>
                                    </View>
                                ) : null}
                                <Text style={styles.date}>{currentDateLabel}</Text>
                            </View>
                        </View>
                    </Pressable>

                    <View style={styles.headerActions}>
                        <Pressable style={[styles.actionBtn, styles.lightBtn]} onPress={() => router.push('/notifications')}>
                            <Ionicons name="notifications" size={20} color="#f0cc42" />
                            {unreadNotificationCount > 0 ? (
                                <View style={styles.dot}>
                                    <Text style={styles.dotText}>
                                        {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                                    </Text>
                                </View>
                            ) : null}
                        </Pressable>
                    </View>
                </View>

                <View style={styles.stallCard}>
                    <View style={styles.stallLeft}>
                        <View style={styles.stallIconWrap}>
                            <MaterialCommunityIcons name="storefront" size={28} color={colors.primary} />
                        </View>
                        <View>
                            <Text style={styles.stallTitle}>{stallLabel}</Text>
                            <View style={[styles.statusPill, isOpen !== true && styles.statusPillClosed]}>
                                <Text style={[styles.statusText, isOpen !== true && styles.statusTextClosed]}>
                                    {isLoading && isOpen === null ? 'Loading...' : isOpen ? 'Open' : 'Closed'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <Switch
                        value={isOpen === true}
                        onValueChange={(value) => { void setIsOpen(value); }}
                        disabled={isLoading || isUpdating || !canToggle || isOpen === null}
                        trackColor={{ false: colors.borderStrong, true: colors.primarySoft }}
                        thumbColor={isOpen ? colors.primary : '#f4f4f5'}
                    />
                </View>
                {statusError ? <Text style={styles.statusError}>{statusError}</Text> : null}

                <View style={styles.totalCard}>
                    <View>
                        <Text style={styles.totalLabel}>Today's Total</Text>
                        {isSalesLoading ? (
                            <View style={styles.salesLoadingRow}>
                                <ActivityIndicator size="small" color="#ffffff" />
                                <Text style={styles.salesLoadingText}>Loading sales...</Text>
                            </View>
                        ) : (
                            <>
                                <Text style={styles.totalValue}>{formatCurrency(todaySales.total)}</Text>
                                <Text style={styles.growthText}>
                                    Yesterday&apos;s Total: {formatCurrency(todaySales.yesterdayTotal)}
                                </Text>
                            </>
                        )}
                    </View>

                    <View style={styles.chartCircle}>
                        <MaterialCommunityIcons name="trending-up" size={48} color="#56b764" />
                    </View>
                </View>

                <View style={styles.sectionHead}>
                    <Text style={styles.sectionTitle}>Recent Sales</Text>
                    <Pressable onPress={() => router.push({ pathname: '/(tabs)/sales', params: { view: 'transactions' } })}>
                        <Text style={styles.seeAll}>See All</Text>
                    </Pressable>
                </View>

                <View style={styles.salesWrap}>
                    {isSalesLoading ? (
                        <View style={styles.emptyRecentSalesCard}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={styles.emptyRecentSalesText}>Loading recent sales...</Text>
                        </View>
                    ) : recentSales.length === 0 ? (
                        <View style={styles.emptyRecentSalesCard}>
                            <Text style={styles.emptyRecentSalesTitle}>No recent sales yet</Text>
                            <Text style={styles.emptyRecentSalesText}>
                                Complete a payment to see your latest transactions here.
                            </Text>
                        </View>
                    ) : (
                        recentSales.slice(0, 3).map((item) => (
                            <View style={styles.saleCard} key={item.id}>
                                <View style={styles.saleAccent} />
                                <View style={styles.saleInfo}>
                                    <Text style={styles.saleName}>{item.item}</Text>
                                    <Text style={styles.saleTime}>{item.dateLabel}</Text>
                                </View>
                                <Text style={styles.saleAmount}>{item.amount}</Text>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const baseStyles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#dfe2ec',
    },
    scroll: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 18,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    profileGroup: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minWidth: 0,
    },
    profileGroupPressed: {
        opacity: 0.7,
    },
    avatar: {
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
    name: {
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
    date: {
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
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#d3d7e1',
        position: 'relative',
    },
    lightBtn: {
        backgroundColor: '#f3f3f3',
    },
    dot: {
        position: 'absolute',
        top: 2,
        right: 1,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#d95b57',
        borderWidth: 1,
        borderColor: '#f3f3f3',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    dotText: {
        fontSize: 10,
        lineHeight: 12,
        fontWeight: '800',
        color: '#ffffff',
    },
    stallCard: {
        minHeight: 74,
        borderRadius: 12,
        backgroundColor: '#f1f1f2',
        borderWidth: 1,
        borderColor: '#d2d5de',
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
        shadowColor: '#000000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 3,
        elevation: 2,
    },
    statusError: {
        marginTop: -8,
        marginBottom: 12,
        color: '#a33b35',
        fontSize: 12,
        fontWeight: '700',
    },
    stallLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stallIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: '#e4ebff',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    stallTitle: {
        fontSize: 32 / 2,
        fontWeight: '800',
        color: '#171b22',
    },
    statusPill: {
        marginTop: 4,
        alignSelf: 'flex-start',
        backgroundColor: '#8ce09d',
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusPillClosed: {
        backgroundColor: '#ef8f8f',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#203025',
    },
    statusTextClosed: {
        color: '#5b1e1e',
    },
    totalCard: {
        minHeight: 120,
        borderRadius: 10,
        backgroundColor: '#2f5ada',
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    totalLabel: {
        fontSize: 30 / 2,
        fontWeight: '700',
        color: '#dbe5ff',
        marginBottom: 2,
    },
    totalValue: {
        fontSize: 70 / 2,
        fontWeight: '800',
        color: '#ffffff',
    },
    growthText: {
        marginTop: 3,
        fontSize: 14,
        fontWeight: '600',
        color: '#dce5ff',
    },
    salesLoadingRow: {
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
    },
    salesLoadingText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#ffffff',
    },
    chartCircle: {
        width: 86,
        height: 86,
        borderRadius: 43,
        backgroundColor: '#dde5ef',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionHead: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        paddingHorizontal: 4,
    },
    sectionTitle: {
        fontSize: 52 / 2,
        fontWeight: '800',
        color: '#151a22',
    },
    seeAll: {
        fontSize: 16,
        fontWeight: '700',
        color: '#2f5ada',
    },
    salesWrap: {
        backgroundColor: '#e4e4e5',
        borderRadius: 0,
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    saleCard: {
        minHeight: 62,
        borderRadius: 31,
        backgroundColor: '#f2f2f3',
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        overflow: 'hidden',
    },
    saleAccent: {
        width: 6,
        alignSelf: 'stretch',
        backgroundColor: '#44aa58',
    },
    saleInfo: {
        flex: 1,
        paddingLeft: 12,
        paddingRight: 8,
    },
    saleName: {
        fontSize: 22 / 2,
        fontWeight: '800',
        color: '#1d222a',
    },
    saleTime: {
        marginTop: 1,
        fontSize: 18 / 2,
        fontWeight: '600',
        color: '#5f6875',
    },
    saleAmount: {
        paddingRight: 14,
        fontSize: 34 / 2,
        fontWeight: '800',
        color: '#141925',
    },
    emptyRecentSalesCard: {
        minHeight: 84,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#d0d5e0',
        backgroundColor: '#f1f3f8',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    emptyRecentSalesTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1f2530',
    },
    emptyRecentSalesText: {
        marginTop: 4,
        textAlign: 'center',
        fontSize: 13,
        fontWeight: '600',
        color: '#687285',
    },
});
