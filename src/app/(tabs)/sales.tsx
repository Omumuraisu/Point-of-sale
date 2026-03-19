import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import POSHeader from '../../components/pos/components/POSHeader';
import { CATEGORY_ITEMS } from '../../components/pos/data';
import { loadSavedTransactions, seedPrebuiltTransactionsIfEmpty } from '../../components/pos/transactionsStore';
import { TransactionRecord } from '../../lib/types';

const CHART_PERIODS = {
    daily: {
        title: 'Daily Sales',
        bars: [
            { label: 'Sun', value: 58 },
            { label: 'Mon', value: 66 },
            { label: 'Tue', value: 48 },
            { label: 'Wed', value: 76 },
            { label: 'Thu', value: 59 },
            { label: 'Fri', value: 63 },
            { label: 'Sat', value: 42 },
        ],
        activeIndex: 6,
    },
    weekly: {
        title: 'Weekly Sales',
        bars: [
            { label: 'W1', value: 64 },
            { label: 'W2', value: 70 },
            { label: 'W3', value: 50 },
            { label: 'W4', value: 62 },
            { label: 'W5', value: 56 },
            { label: 'W1\nMar', value: 53 },
            { label: 'W2\nMar', value: 49 },
        ],
        activeIndex: 1,
    },
    monthly: {
        title: 'Monthly Sales',
        bars: [
            { label: 'Jan', value: 66 },
            { label: 'Feb', value: 44 },
            { label: 'Mar', value: 68 },
            { label: 'Apr', value: 71 },
            { label: 'May', value: 77 },
            { label: 'Jun', value: 74 },
            { label: 'Jul', value: 72 },
        ],
        activeIndex: 1,
    },
};

type ChartBar = {
    label: string;
    value: number;
};

type ChartPeriodConfig = {
    title: string;
    bars: ChartBar[];
    activeIndex: number;
};

const PERIOD_OPTIONS = ['daily', 'weekly', 'monthly'] as const;
type PeriodOption = (typeof PERIOD_OPTIONS)[number];
const CHART_PERIODS_TYPED: Record<PeriodOption, ChartPeriodConfig> = CHART_PERIODS;

const CATEGORY_COLOR_MAP = CATEGORY_ITEMS.reduce((accumulator, category) => {
    accumulator[category.label.trim().toLowerCase()] = {
        backgroundColor: category.bgColor,
        borderColor: category.borderColor,
        textColor: category.textColor,
    };

    return accumulator;
}, {} as Record<string, { backgroundColor: string; borderColor: string; textColor: string }>);

interface ChartViewProps {
    period: PeriodOption;
    onPeriodChange: (period: PeriodOption) => void;
}

interface TransactionsViewProps {
    transactions: TransactionRecord[];
    onTransactionPress: (transactionId: string) => void;
}

const Sales = () => {
    const router = useRouter();
    const { view } = useLocalSearchParams<{ view?: string | string[] }>();
    const requestedView = typeof view === 'string' ? view : Array.isArray(view) ? view[0] : undefined;
    const initialViewMode: 'chart' | 'transactions' = requestedView === 'transactions' ? 'transactions' : 'chart';
    const [viewMode, setViewMode] = useState<'chart' | 'transactions'>(initialViewMode);
    const [period, setPeriod] = useState<PeriodOption>('daily');
    const [savedTransactions, setSavedTransactions] = useState<TransactionRecord[]>([]);

    useEffect(() => {
        if (requestedView === 'transactions' || requestedView === 'chart') {
            setViewMode(requestedView);
        }
    }, [requestedView]);

    useFocusEffect(
        useCallback(() => {
            let isMounted = true;

            const hydrateTransactions = async () => {
                let stored = await loadSavedTransactions();

                if (stored.length === 0) {
                    stored = await seedPrebuiltTransactionsIfEmpty(3);
                }

                if (isMounted) {
                    setSavedTransactions(stored);
                }
            };

            hydrateTransactions();

            return () => {
                isMounted = false;
            };
        }, []),
    );

    useEffect(() => {
        if (__DEV__ && viewMode === 'transactions') {
            console.log('[TRANSACTIONS_DEBUG] Saved transactions:', savedTransactions);
        }
    }, [viewMode, savedTransactions]);

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.container}>
                <POSHeader />

                <View style={styles.segmentWrap}>
                    <Pressable
                        style={[styles.segmentBtn, viewMode === 'chart' && styles.segmentBtnActive]}
                        onPress={() => setViewMode('chart')}
                    >
                        <Text style={[styles.segmentText, viewMode === 'chart' && styles.segmentTextActive]}>
                            View Chart
                        </Text>
                    </Pressable>
                    <Pressable
                        style={[
                            styles.segmentBtn,
                            viewMode === 'transactions' && styles.segmentBtnActive,
                        ]}
                        onPress={() => setViewMode('transactions')}
                    >
                        <Text
                            style={[
                                styles.segmentText,
                                viewMode === 'transactions' && styles.segmentTextActive,
                            ]}
                        >
                            View Transactions
                        </Text>
                    </Pressable>
                </View>

                {viewMode === 'chart'
                    ? <ChartView period={period} onPeriodChange={setPeriod} />
                    : (
                        <TransactionsView
                            transactions={savedTransactions}
                            onTransactionPress={(transactionId) => {
                                router.push({
                                    pathname: '/transaction-detail',
                                    params: { id: transactionId },
                                });
                            }}
                        />
                    )}
            </View>
        </SafeAreaView>
    );
};

const ChartView = ({ period, onPeriodChange }: ChartViewProps) => {
    const activePeriod = CHART_PERIODS_TYPED[period] ?? CHART_PERIODS_TYPED.daily;

    return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.summaryWrap}>
                <Text style={styles.summaryLabel}>Today's Total Sales</Text>
                <Text style={styles.summaryAmount}>P 14,247.00</Text>
                <View style={styles.growthPill}>
                    <Text style={styles.growthText}>+12% from yesterday</Text>
                </View>
            </View>

            <View style={styles.chartCard}>
                <Text style={styles.cardTitle}>{activePeriod.title}</Text>

                <View style={styles.barsWrap}>
                    {activePeriod.bars.map((bar, index) => {
                        const isActive = index === activePeriod.activeIndex;

                        return (
                            <View key={`${period}-${bar.label}-${index}`} style={styles.barCol}>
                                <View style={styles.barTrack}>
                                    <View style={[styles.barFill, { height: `${bar.value}%` }, isActive && styles.barFillActive]}>
                                        {isActive ? (
                                            <View style={styles.activeMarker}>
                                                <Ionicons name="chevron-up" size={14} color="#ffffff" />
                                            </View>
                                        ) : null}
                                    </View>
                                </View>
                                <Text style={[styles.monthText, isActive && styles.monthTextActive]}>{bar.label}</Text>
                            </View>
                        );
                    })}
                </View>

                <View style={styles.periodSwitchWrap}>
                    {PERIOD_OPTIONS.map((option) => {
                        const isActive = period === option;
                        const label = option.charAt(0).toUpperCase() + option.slice(1);

                        return (
                            <Pressable
                                key={option}
                                style={[styles.periodSwitchBtn, isActive && styles.periodSwitchBtnActive]}
                                onPress={() => onPeriodChange(option)}
                            >
                                <Text style={[styles.periodText, isActive && styles.periodTextActive]}>{label}</Text>
                            </Pressable>
                        );
                    })}
                </View>
            </View>
        </ScrollView>
    );
};

const TransactionsView = ({ transactions = [], onTransactionPress }: TransactionsViewProps) => {
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [isCategoryMenuOpen, setCategoryMenuOpen] = useState(false);

    const categoryOptions = useMemo(() => {
        const uniqueCategories = Array.from(
            new Set(
                transactions
                    .map((transaction) => transaction.category.trim())
                    .filter(Boolean),
            ),
        );

        return ['All', ...uniqueCategories];
    }, [transactions]);

    const filteredTransactions = useMemo(() => {
        if (selectedCategory === 'All') {
            return transactions;
        }

        return transactions.filter((transaction) => transaction.category === selectedCategory);
    }, [selectedCategory, transactions]);

    useEffect(() => {
        if (!categoryOptions.includes(selectedCategory)) {
            setSelectedCategory('All');
        }
    }, [categoryOptions, selectedCategory]);

    return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.filtersRow}>
                <View style={styles.filterPill}>
                    <Ionicons name="calendar" size={16} color="#2a2d34" />
                    <Text style={styles.filterText}>mm/dd/yyyy</Text>
                </View>
                <Pressable
                    style={[styles.filterPill, isCategoryMenuOpen && styles.filterPillActive]}
                    onPress={() => setCategoryMenuOpen((previous) => !previous)}
                >
                    <Text style={styles.filterText}>{selectedCategory}</Text>
                    <Ionicons
                        name={isCategoryMenuOpen ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color="#6a6e77"
                    />
                </Pressable>
                <View style={[styles.filterPill, styles.exportPill]}>
                    <MaterialCommunityIcons name="tray-arrow-down" size={16} color="#d85647" />
                    <Text style={styles.exportText}>Export</Text>
                </View>
            </View>

            {isCategoryMenuOpen ? (
                <View style={styles.categoryMenuCard}>
                    {categoryOptions.map((option) => {
                        const isSelected = selectedCategory === option;

                        return (
                            <Pressable
                                key={option}
                                style={[styles.categoryMenuItem, isSelected && styles.categoryMenuItemSelected]}
                                onPress={() => {
                                    setSelectedCategory(option);
                                    setCategoryMenuOpen(false);
                                }}
                            >
                                <Text
                                    style={[
                                        styles.categoryMenuItemText,
                                        isSelected && styles.categoryMenuItemTextSelected,
                                    ]}
                                >
                                    {option}
                                </Text>
                                {isSelected ? <Ionicons name="checkmark" size={16} color="#2f5ada" /> : null}
                            </Pressable>
                        );
                    })}
                </View>
            ) : null}

            {transactions.length === 0 ? (
                <View style={styles.emptyTransactionsWrap}>
                    <Text style={styles.emptyTransactionsTitle}>No transactions yet</Text>
                    <Text style={styles.emptyTransactionsText}>
                        Confirm a payment to save a transaction record.
                    </Text>
                </View>
            ) : null}

            {transactions.length > 0 && filteredTransactions.length === 0 ? (
                <View style={styles.emptyTransactionsWrap}>
                    <Text style={styles.emptyTransactionsTitle}>No matching transactions</Text>
                    <Text style={styles.emptyTransactionsText}>
                        No transactions found for the selected category.
                    </Text>
                </View>
            ) : null}

            {filteredTransactions.map((transaction) => (
                (() => {
                    const colorTheme = CATEGORY_COLOR_MAP[transaction.category.trim().toLowerCase()];

                    return (
                        <Pressable
                            key={transaction.id}
                            style={styles.transactionCard}
                            onPress={() => onTransactionPress(transaction.id)}
                        >
                            <View style={styles.transactionTopRow}>
                                <Text style={styles.transactionTitle}>{transaction.item}</Text>
                                <Text style={styles.transactionAmount}>{transaction.amount}</Text>
                            </View>

                            <View style={styles.transactionMetaRow}>
                                <View
                                    style={[
                                        styles.categoryPill,
                                        colorTheme
                                            ? {
                                                backgroundColor: colorTheme.backgroundColor,
                                                borderWidth: 1,
                                                borderColor: colorTheme.borderColor,
                                            }
                                            : styles.categoryPillNeutral,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.categoryPillText,
                                            colorTheme
                                                ? { color: colorTheme.textColor }
                                                : styles.categoryPillTextNeutral,
                                        ]}
                                    >
                                        {transaction.category}
                                    </Text>
                                </View>

                                <Text style={styles.transactionSub}>{transaction.subtitle}</Text>
                            </View>

                            <View style={styles.transactionFooterRow}>
                                <Text style={styles.transactionFooterBold}>Transaction ID: {transaction.id}</Text>
                                <Text style={styles.transactionFooter}>{transaction.dateLabel || 'Feb. 12, 2026 | 11:24AM'}</Text>
                            </View>
                        </Pressable>
                    );
                })()
            ))}
        </ScrollView>
    );
};

export default Sales;

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#dfe2ec',
    },
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    segmentWrap: {
        height: 56,
        backgroundColor: '#f1f1f1',
        borderWidth: 1,
        borderColor: '#c7ccd9',
        borderRadius: 28,
        padding: 6,
        flexDirection: 'row',
        marginBottom: 12,
    },
    segmentBtn: {
        flex: 1,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    segmentBtnActive: {
        backgroundColor: '#2f5ada',
    },
    segmentText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#2a2d34',
    },
    segmentTextActive: {
        color: '#ffffff',
    },
    scrollContent: {
        paddingBottom: 26,
    },
    summaryWrap: {
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 36 / 2,
        fontWeight: '700',
        color: '#6f737c',
    },
    summaryAmount: {
        marginTop: 4,
        fontSize: 76 / 2,
        fontWeight: '800',
        color: '#242a32',
    },
    growthPill: {
        marginTop: 8,
        height: 30,
        borderRadius: 15,
        paddingHorizontal: 14,
        backgroundColor: '#a3e2a6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    growthText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#2f7a36',
    },
    chartCard: {
        marginTop: 14,
        minHeight: 306,
        borderRadius: 14,
        backgroundColor: '#f4f4f5',
        padding: 16,
        borderWidth: 1,
        borderColor: '#d1d5df',
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#242830',
    },
    barsWrap: {
        marginTop: 14,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    barCol: {
        width: 42,
        alignItems: 'center',
    },
    barTrack: {
        width: '100%',
        height: 170,
        borderRadius: 5,
        backgroundColor: '#c2d0f2',
        justifyContent: 'flex-end',
        overflow: 'hidden',
    },
    barFill: {
        backgroundColor: '#6f8be0',
        borderTopLeftRadius: 5,
        borderTopRightRadius: 5,
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    barFillActive: {
        backgroundColor: '#23439c',
    },
    activeMarker: {
        marginTop: 6,
        width: 22,
        height: 22,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#b5c9ff',
        backgroundColor: '#1d3a8b',
        alignItems: 'center',
        justifyContent: 'center',
    },
    monthText: {
        marginTop: 8,
        fontSize: 14,
        lineHeight: 14,
        height: 30,
        textAlign: 'center',
        fontWeight: '700',
        color: '#8b8f98',
    },
    monthTextActive: {
        color: '#11151f',
    },
    periodSwitchWrap: {
        marginTop: 18,
        backgroundColor: '#d2daee',
        borderRadius: 24,
        padding: 6,
        flexDirection: 'row',
    },
    periodSwitchBtn: {
        flex: 1,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
    },
    periodSwitchBtnActive: {
        backgroundColor: '#2f5ada',
    },
    periodText: {
        fontSize: 18 / 1.2,
        fontWeight: '700',
        color: '#2a2d34',
    },
    periodTextActive: {
        color: '#ffffff',
    },
    filtersRow: {
        marginTop: 2,
        flexDirection: 'row',
        gap: 8,
    },
    filterPill: {
        height: 42,
        borderRadius: 7,
        borderWidth: 1,
        borderColor: '#9ea4b3',
        paddingHorizontal: 8,
        backgroundColor: '#f5f5f5',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        flex: 1,
    },
    filterPillActive: {
        borderColor: '#2f5ada',
        backgroundColor: '#eef2ff',
    },
    filterText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6a6e77',
    },
    categoryMenuCard: {
        marginTop: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#cfd4df',
        backgroundColor: '#f8f9fc',
        paddingVertical: 4,
    },
    categoryMenuItem: {
        minHeight: 36,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    categoryMenuItemSelected: {
        backgroundColor: '#e9efff',
    },
    categoryMenuItemText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#475067',
    },
    categoryMenuItemTextSelected: {
        color: '#2f5ada',
    },
    exportPill: {
        borderColor: '#e16b5f',
        backgroundColor: '#fcefed',
        flex: 0.9,
    },
    exportText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#d85647',
    },
    emptyTransactionsWrap: {
        marginTop: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#d1d5df',
        backgroundColor: '#f4f4f5',
        padding: 14,
    },
    emptyTransactionsTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1c2029',
    },
    emptyTransactionsText: {
        marginTop: 6,
        fontSize: 14,
        fontWeight: '600',
        color: '#6d7280',
    },
    transactionCard: {
        marginTop: 12,
        borderRadius: 12,
        padding: 14,
        backgroundColor: '#f4f4f5',
        borderWidth: 1,
        borderColor: '#d1d5df',
    },
    transactionTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    transactionTitle: {
        fontSize: 36 / 2,
        fontWeight: '800',
        color: '#0f1118',
    },
    transactionAmount: {
        fontSize: 38 / 2,
        fontWeight: '800',
        color: '#0f1118',
    },
    transactionMetaRow: {
        marginTop: 4,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    categoryPill: {
        minWidth: 94,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
    },
    categoryPillMeat: {
        backgroundColor: '#f7dddd',
        borderWidth: 1,
        borderColor: '#db6666',
    },
    categoryPillDry: {
        backgroundColor: '#f7ebc1',
        borderWidth: 1,
        borderColor: '#e0c75f',
    },
    categoryPillNeutral: {
        backgroundColor: '#e5e9f2',
        borderWidth: 1,
        borderColor: '#a4adc2',
    },
    categoryPillText: {
        fontSize: 14,
        fontWeight: '700',
    },
    categoryPillTextMeat: {
        color: '#ce5252',
    },
    categoryPillTextDry: {
        color: '#d8b83d',
    },
    categoryPillTextNeutral: {
        color: '#6a7182',
    },
    transactionSub: {
        fontSize: 16,
        fontWeight: '700',
        color: '#7c8089',
    },
    transactionFooterRow: {
        marginTop: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    transactionFooterBold: {
        fontSize: 14,
        fontWeight: '800',
        color: '#2e3138',
    },
    transactionFooter: {
        fontSize: 14,
        fontWeight: '700',
        color: '#80848e',
    },
});
