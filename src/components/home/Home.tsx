import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Switch, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { loadSavedTransactions } from '../pos/transactionsStore';
import { syncUnsyncedTransactions } from '../../lib/transactionsSync';
import { TransactionRecord } from '../../lib/types';

const CURRENT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
});

export default function Home() {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(true);
    const [recentSales, setRecentSales] = useState<TransactionRecord[]>([]);
    const currentDateLabel = CURRENT_DATE_FORMATTER.format(new Date());

    useFocusEffect(
        useCallback(() => {
            let isMounted = true;

            const hydrateRecentSales = async () => {
                await syncUnsyncedTransactions(1, 5);
                const savedTransactions = await loadSavedTransactions();

                if (isMounted) {
                    setRecentSales(savedTransactions.slice(0, 3));
                }
            };

            hydrateRecentSales();

            return () => {
                isMounted = false;
            };
        }, []),
    );

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.headerRow}>
                    <View style={styles.profileGroup}>
                        <View style={styles.avatar}>
                            <Ionicons name="person" size={26} color="#40444f" />
                        </View>
                        <View>
                            <Text style={styles.name}>Mika Bini</Text>
                            <Text style={styles.date}>{currentDateLabel}</Text>
                        </View>
                    </View>

                    <View style={styles.headerActions}>
                        <Pressable style={[styles.actionBtn, styles.lightBtn]} onPress={() => router.push('/notifications')}>
                            <Ionicons name="notifications" size={20} color="#f0cc42" />
                            <View style={styles.dot} />
                        </Pressable>
                        <Pressable style={[styles.actionBtn, styles.primaryBtn]}>
                            <Ionicons name="print-outline" size={18} color="#ffffff" />
                        </Pressable>
                    </View>
                </View>

                <View style={styles.stallCard}>
                    <View style={styles.stallLeft}>
                        <View style={styles.stallIconWrap}>
                            <MaterialCommunityIcons name="storefront" size={28} color="#2f5ada" />
                        </View>
                        <View>
                            <Text style={styles.stallTitle}>Stall #4</Text>
                            <View style={[styles.statusPill, !isOpen && styles.statusPillClosed]}>
                                <Text style={[styles.statusText, !isOpen && styles.statusTextClosed]}>{isOpen ? 'Open' : 'Closed'}</Text>
                            </View>
                        </View>
                    </View>

                    <Switch
                        value={isOpen}
                        onValueChange={setIsOpen}
                        trackColor={{ false: '#c5cada', true: '#b8c8fa' }}
                        thumbColor={isOpen ? '#2f5ada' : '#f4f4f5'}
                    />
                </View>

                <View style={styles.totalCard}>
                    <View>
                        <Text style={styles.totalLabel}>Today's Total</Text>
                        <Text style={styles.totalValue}>P 14,247.00</Text>
                        <Text style={styles.growthText}>+12% from yesterday</Text>
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
                    {recentSales.length === 0 ? (
                        <View style={styles.emptyRecentSalesCard}>
                            <Text style={styles.emptyRecentSalesTitle}>No recent sales yet</Text>
                            <Text style={styles.emptyRecentSalesText}>
                                Complete a payment to see your latest transactions here.
                            </Text>
                        </View>
                    ) : (
                        recentSales.map((item) => (
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

const styles = StyleSheet.create({
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
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
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
    },
    name: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f1014',
    },
    date: {
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
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#d3d7e1',
        position: 'relative',
    },
    lightBtn: {
        backgroundColor: '#f3f3f3',
    },
    primaryBtn: {
        backgroundColor: '#305ddf',
        borderColor: '#305ddf',
    },
    dot: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#d95b57',
        borderWidth: 1,
        borderColor: '#f3f3f3',
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
