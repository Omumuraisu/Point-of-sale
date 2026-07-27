import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import POSHeader from '../../components/pos/components/POSHeader';
import { CATEGORY_ITEMS } from '../../components/pos/data';
import { loadSavedTransactions } from '../../components/pos/transactionsStore';
import { TransactionRecord } from '../../lib/types';
import { useAuthSession } from '../../lib/authSession';
import { loadRemoteSalesTransactions } from '../../lib/transactionsSync';
import { subscribeToTransactionSyncEvents } from '../../lib/transactionSyncEvents';
import { getTodaySalesSummary } from '../../lib/salesMetrics';
import { formatCurrency } from '../../lib/utils';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import {
    loadWeeklySalesPatterns,
    verifyHoltWintersReadAccess,
    WeeklySalesPattern,
} from '../../lib/weeklySalesPatterns';

type TopSoldProductBar = {
    label: string;
    value: number;
    quantity: number;
    categoryKey: string;
};

type TopProductGroup = {
    key: string;
    label: string;
};

const formatTopProductLabel = (rawLabel: string): string => {
    const label = rawLabel.trim().replace(/\s+/g, ' ');

    if (!label) {
        return '';
    }

    return label.length > 14 ? `${label.slice(0, 14)}...` : label;
};

const interpolateColor = (startColor: string, endColor: string, progress: number): string => {
    const normalizedProgress = Math.min(1, Math.max(0, progress));
    const startValue = startColor.replace('#', '');
    const endValue = endColor.replace('#', '');

    const startRgb = [
        parseInt(startValue.slice(0, 2), 16),
        parseInt(startValue.slice(2, 4), 16),
        parseInt(startValue.slice(4, 6), 16),
    ];
    const endRgb = [
        parseInt(endValue.slice(0, 2), 16),
        parseInt(endValue.slice(2, 4), 16),
        parseInt(endValue.slice(4, 6), 16),
    ];

    const mixedRgb = startRgb.map((channel, index) => (
        Math.round(channel + (endRgb[index] - channel) * normalizedProgress)
    ));

    return `#${mixedRgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
};

const getTopProductBarColor = (index: number, total: number): string => {
    const blue = '#6f8be0';
    const green = '#57c36a';

    if (total <= 1) {
        return green;
    }

    return interpolateColor(blue, green, 1 - (index / (total - 1)));
};

const getTopProductGroup = (rawLabel: string): TopProductGroup => {
    const cleanedLabel = rawLabel.trim().replace(/\s+/g, ' ');
    const normalizedKey = cleanedLabel
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (normalizedKey.includes('chicken')) {
        return {
            key: 'chicken',
            label: 'Chicken',
        };
    }

    return {
        key: normalizedKey,
        label: cleanedLabel,
    };
};

const CATEGORY_COLOR_MAP = CATEGORY_ITEMS.reduce((accumulator, category) => {
    accumulator[category.label.trim().toLowerCase()] = {
        backgroundColor: category.bgColor,
        borderColor: category.borderColor,
        textColor: category.textColor,
    };

    return accumulator;
}, {} as Record<string, { backgroundColor: string; borderColor: string; textColor: string }>);

const getSyncStatus = (transaction: TransactionRecord) => {
    if (transaction.synced) {
        return {
            label: 'Synced',
            pillStyle: styles.syncPillSynced,
            textStyle: styles.syncTextSynced,
        };
    }

    if (transaction.syncError) {
        return {
            label: 'Sync failed',
            pillStyle: styles.syncPillFailed,
            textStyle: styles.syncTextFailed,
        };
    }

    return {
        label: 'Not synced yet',
        pillStyle: styles.syncPillPending,
        textStyle: styles.syncTextPending,
    };
};

interface ChartViewProps {
    topSoldProducts: TopSoldProductBar[];
    todayTotal: number;
    growthPercent: number | null;
}

interface TransactionsViewProps {
    transactions: TransactionRecord[];
    onTransactionPress: (transactionId: string) => void;
}

const Sales = () => {
    const router = useRouter();
    const { currentUser } = useAuthSession();
    const { view } = useLocalSearchParams<{ view?: string | string[] }>();
    const requestedView = typeof view === 'string' ? view : Array.isArray(view) ? view[0] : undefined;
    const initialViewMode: 'chart' | 'transactions' = requestedView === 'transactions' ? 'transactions' : 'chart';
    const [viewMode, setViewMode] = useState<'chart' | 'transactions'>(initialViewMode);
    const [savedTransactions, setSavedTransactions] = useState<TransactionRecord[]>([]);
    const todaySales = useMemo(() => getTodaySalesSummary(savedTransactions), [savedTransactions]);

    const topSoldProducts = useMemo<TopSoldProductBar[]>(() => {
        const quantityByProduct = new Map<string, {
            label: string;
            quantity: number;
            categoryTotals: Map<string, number>;
        }>();

        savedTransactions.forEach((transaction) => {
            transaction.cartItems?.forEach((item) => {
                const productGroup = getTopProductGroup(item.name);
                const quantity = Number.isFinite(item.quantity) ? item.quantity : 0;

                if (!productGroup.key || quantity <= 0) {
                    return;
                }

                const existing = quantityByProduct.get(productGroup.key);

                if (existing) {
                    existing.quantity += quantity;

                    const normalizedCategory = item.category.trim().toLowerCase();

                    if (normalizedCategory) {
                        const previous = existing.categoryTotals.get(normalizedCategory) ?? 0;
                        existing.categoryTotals.set(normalizedCategory, previous + quantity);
                    }

                    return;
                }

                const initialCategoryTotals = new Map<string, number>();
                const normalizedCategory = item.category.trim().toLowerCase();

                if (normalizedCategory) {
                    initialCategoryTotals.set(normalizedCategory, quantity);
                }

                quantityByProduct.set(productGroup.key, {
                    label: productGroup.label,
                    quantity,
                    categoryTotals: initialCategoryTotals,
                });
            });
        });

        const rankedProducts = Array.from(quantityByProduct.values())
            .sort((first, second) => (
                second.quantity - first.quantity
                || first.label.localeCompare(second.label)
            ))
            .slice(0, 7);

        if (rankedProducts.length === 0) {
            return [];
        }

        const highestQuantity = rankedProducts[0].quantity;

        return rankedProducts.map((product) => {
            const label = formatTopProductLabel(product.label);
            const dominantCategory = Array.from(product.categoryTotals.entries())
                .sort((first, second) => second[1] - first[1])[0]?.[0] ?? 'neutral';

            return {
                label,
                quantity: Number(product.quantity.toFixed(2)),
                categoryKey: dominantCategory,
                value: highestQuantity > 0
                    ? Math.max(12, Math.round((product.quantity / highestQuantity) * 100))
                    : 0,
            };
        });
    }, [savedTransactions]);

    useEffect(() => {
        if (requestedView === 'transactions' || requestedView === 'chart') {
            setViewMode(requestedView);
        }
    }, [requestedView]);

    useFocusEffect(
        useCallback(() => {
            let isMounted = true;

            const hydrateTransactions = async () => {
                const remoteTransactions = await loadRemoteSalesTransactions({
                    accountId: currentUser?.accountId,
                    stallId: currentUser?.stallId,
                    stallNumber: currentUser?.stallNumber,
                });
                const localTransactions = await loadSavedTransactions(currentUser?.accountId);
                const unsyncedLocalTransactions = localTransactions.filter((transaction) => !transaction.synced);
                const stored = [...unsyncedLocalTransactions, ...remoteTransactions]
                    .sort((first, second) => second.createdAt - first.createdAt);

                if (isMounted) {
                    setSavedTransactions(stored);
                }
            };

            hydrateTransactions();
            const unsubscribe = subscribeToTransactionSyncEvents(() => {
                void hydrateTransactions();
            });

            return () => {
                isMounted = false;
                unsubscribe();
            };
        }, [currentUser?.accountId, currentUser?.stallId, currentUser?.stallNumber]),
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
                    ? (
                        <ChartView
                            topSoldProducts={topSoldProducts}
                            todayTotal={todaySales.total}
                            growthPercent={todaySales.growthPercent}
                        />
                    )
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

const MANILA_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
});

const MANILA_WEEKDAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
});

const CALENDAR_DAY_INDEX: Record<string, number> = {
    Monday: 0,
    Tuesday: 1,
    Wednesday: 2,
    Thursday: 3,
    Friday: 4,
    Saturday: 5,
    Sunday: 6,
};

const ChartView = ({
    topSoldProducts,
    todayTotal,
    growthPercent,
}: ChartViewProps) => {
    const [patterns, setPatterns] = useState<WeeklySalesPattern[]>([]);
    const [isPatternsLoading, setPatternsLoading] = useState(true);
    const [patternsUnavailable, setPatternsUnavailable] = useState(false);

    const reloadWeeklyPatterns = useCallback(async () => {
        setPatternsLoading(true);
        const result = await loadWeeklySalesPatterns();
        setPatterns(result.data);
        setPatternsUnavailable(result.error);
        setPatternsLoading(false);
    }, []);

    useEffect(() => {
        let isMounted = true;

        const loadInitialPatterns = async () => {
            const [hasReadAccess, result] = await Promise.all([
                verifyHoltWintersReadAccess(),
                loadWeeklySalesPatterns(),
            ]);

            if (!isMounted) {
                return;
            }

            setPatterns(result.data);
            setPatternsUnavailable(!hasReadAccess || result.error);
            setPatternsLoading(false);
        };

        void loadInitialPatterns();

        if (!isSupabaseConfigured || !supabase) {
            return () => {
                isMounted = false;
            };
        }

        const supabaseClient = supabase;
        const channelTopic = 'realtime:pos-weekly-pattern-updates';
        let activeChannel: ReturnType<typeof supabaseClient.channel> | null = null;

        const setupRealtimeChannel = async () => {
            const existingChannels = supabaseClient
                .getChannels()
                .filter((channel) => channel.topic === channelTopic);

            await Promise.all(
                existingChannels.map((channel) => supabaseClient.removeChannel(channel)),
            );

            if (!isMounted) {
                return;
            }

            activeChannel = supabaseClient
                .channel('pos-weekly-pattern-updates')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'hw_forecast_runs',
                    },
                    (payload) => {
                        const nextRun = payload.new as { status?: string } | null;

                        if (nextRun?.status === 'success') {
                            void reloadWeeklyPatterns();
                        }
                    },
                )
                .subscribe();
        };

        void setupRealtimeChannel();

        return () => {
            isMounted = false;

            if (activeChannel) {
                void supabaseClient.removeChannel(activeChannel);
            }
        };
    }, [reloadWeeklyPatterns]);

    const highestPatternValue = useMemo(() => Math.max(
        ...patterns.map((pattern) => pattern.avgDailyRevPhp),
        0,
    ), [patterns]);

    const generatedAtLabel = useMemo(() => {
        const generatedAt = patterns[0]?.generatedAt;

        if (!generatedAt) {
            return '';
        }

        const date = new Date(generatedAt);
        return Number.isNaN(date.getTime()) ? '' : MANILA_DATE_TIME_FORMATTER.format(date);
    }, [patterns]);
    const currentManilaDay = MANILA_WEEKDAY_FORMATTER.format(new Date());
    const currentManilaDayIndex = CALENDAR_DAY_INDEX[currentManilaDay] ?? 0;

    return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.summaryWrap}>
                <Text style={styles.summaryLabel}>Today's Total Sales</Text>
                <Text style={styles.summaryAmount}>{formatCurrency(todayTotal)}</Text>
                <View style={styles.growthPill}>
                    <Text style={styles.growthText}>
                        {growthPercent === null
                            ? 'No sales recorded yesterday'
                            : `${growthPercent >= 0 ? '+' : ''}${growthPercent.toFixed(1)}% from yesterday`}
                    </Text>
                </View>
            </View>

            <View style={styles.chartCard}>
                <View style={styles.patternHeader}>
                    <View style={styles.patternTitleWrap}>
                        <Text style={styles.cardTitle}>Weekly Sales Patterns</Text>
                        {generatedAtLabel ? (
                            <Text style={styles.patternGeneratedAt}>Updated {generatedAtLabel}</Text>
                        ) : null}
                    </View>
                    <MaterialCommunityIcons name="chart-timeline-variant" size={24} color="#2f5ada" />
                </View>

                {isPatternsLoading ? (
                    <View style={styles.patternState}>
                        <ActivityIndicator size="small" color="#2f5ada" />
                        <Text style={styles.patternStateText}>Loading weekly sales patterns...</Text>
                    </View>
                ) : null}

                {!isPatternsLoading && patternsUnavailable ? (
                    <View style={styles.patternState}>
                        <Ionicons name="cloud-offline-outline" size={28} color="#747b8a" />
                        <Text style={styles.patternStateTitle}>Weekly sales patterns are currently unavailable.</Text>
                    </View>
                ) : null}

                {!isPatternsLoading && !patternsUnavailable && patterns.length === 0 ? (
                    <View style={styles.patternState}>
                        <Ionicons name="analytics-outline" size={28} color="#747b8a" />
                        <Text style={styles.patternStateTitle}>No weekly sales patterns are available yet.</Text>
                    </View>
                ) : null}

                {!isPatternsLoading && !patternsUnavailable && patterns.length > 0 ? (
                    <>
                        <View style={styles.patternBarsWrap}>
                            {patterns.map((pattern) => {
                                const patternValue = pattern.avgDailyRevPhp;
                                const patternDayIndex = CALENDAR_DAY_INDEX[pattern.dayOfWeek] ?? pattern.dowIndex;
                                const isFutureDay = patternDayIndex > currentManilaDayIndex;
                                const barHeight = !isFutureDay && highestPatternValue > 0
                                    ? Math.max(4, Math.round((patternValue / highestPatternValue) * 100))
                                    : 0;
                                const isCurrentDay = pattern.dayOfWeek === currentManilaDay;

                                return (
                                    <View key={`${pattern.runId}-${pattern.dayOfWeek}`} style={styles.patternBarColumn}>
                                        <View style={[
                                            styles.patternBarTrack,
                                            pattern.isWeekend && styles.patternBarTrackWeekend,
                                        ]}>
                                            <View
                                                style={[
                                                    styles.patternBarFill,
                                                    { height: `${barHeight}%` },
                                                    pattern.isWeekend && styles.patternBarFillWeekend,
                                                ]}
                                            >
                                                {isCurrentDay ? (
                                                    <View style={styles.activeMarker}>
                                                        <Ionicons name="chevron-up" size={14} color="#ffffff" />
                                                    </View>
                                                ) : null}
                                            </View>
                                        </View>
                                        <Text style={[
                                            styles.patternDayLabel,
                                            pattern.isWeekend && styles.patternDayLabelWeekend,
                                        ]}>
                                            {pattern.dayOfWeek.slice(0, 3)}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>

                        <View style={styles.periodSwitchWrap}>
                            {(['Daily', 'Weekly', 'Monthly'] as const).map((label) => {
                                const isAvailable = label === 'Daily';

                                return (
                                    <Pressable
                                        key={label}
                                        disabled={!isAvailable}
                                        style={[
                                            styles.periodSwitchBtn,
                                            isAvailable && styles.periodSwitchBtnActive,
                                            !isAvailable && styles.periodSwitchBtnDisabled,
                                        ]}
                                    >
                                        <Text style={[
                                            styles.periodText,
                                            isAvailable && styles.periodTextActive,
                                            !isAvailable && styles.periodTextDisabled,
                                        ]}>
                                            {label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </>
                ) : null}
            </View>

            <View style={styles.chartCard}>
                <Text style={styles.cardTitle}>Top Sold Products</Text>

                {topSoldProducts.length > 0 ? (
                    <View style={styles.topProductsList}>
                        {topSoldProducts.map((bar, index) => {
                            const isActive = index === 0;
                            const barColor = getTopProductBarColor(index, topSoldProducts.length);

                            const barFillStyle = {
                                backgroundColor: isActive ? barColor : `${barColor}cc`,
                            };

                            return (
                                <View key={`top-${bar.label}-${index}`} style={[styles.topProductRow, isActive && styles.topProductRowActive]}>
                                    <Text
                                        style={[styles.topProductLabel, isActive && styles.topProductLabelActive]}
                                        numberOfLines={1}
                                    >
                                        {bar.label}
                                    </Text>
                                    <View style={styles.topProductGraphCell}>
                                        <View style={[styles.topProductBarTrack, isActive && styles.topProductBarTrackActive]}>
                                            <View
                                                style={[
                                                    styles.topProductBarFill,
                                                    { width: `${bar.value}%` },
                                                    barFillStyle,
                                                    isActive && styles.topProductBarFillActive,
                                                ]}
                                            />
                                        </View>
                                    </View>
                                    <View style={styles.topProductValueCell}>
                                        <Text style={[styles.topProductValue, isActive && styles.topProductValueActive]}>
                                            {bar.quantity}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                ) : (
                    <View style={styles.topProductsEmptyWrap}>
                        <Text style={styles.emptyTransactionsTitle}>No sold products yet</Text>
                        <Text style={styles.emptyTransactionsText}>
                            Confirm transactions to see top sold products.
                        </Text>
                    </View>
                )}
            </View>
        </ScrollView>
    );
};

const TransactionsView = ({
    transactions = [],
    onTransactionPress,
}: TransactionsViewProps) => {
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
                    const syncStatus = getSyncStatus(transaction);

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
                                <View style={styles.transactionFooterLeft}>
                                    <Text style={styles.transactionFooterBold}>Transaction ID: {transaction.id}</Text>
                                    <View style={[styles.syncPill, syncStatus.pillStyle]}>
                                        <Text style={[styles.syncText, syncStatus.textStyle]}>{syncStatus.label}</Text>
                                    </View>
                                    {transaction.syncError ? (
                                        <Text style={styles.syncErrorText} numberOfLines={3}>
                                            {transaction.syncError}
                                        </Text>
                                    ) : null}
                                </View>
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
    patternHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    patternTitleWrap: {
        flex: 1,
    },
    patternGeneratedAt: {
        marginTop: 3,
        fontSize: 12,
        fontWeight: '600',
        color: '#747b8a',
    },
    patternState: {
        minHeight: 210,
        paddingHorizontal: 18,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    patternStateTitle: {
        fontSize: 15,
        lineHeight: 21,
        fontWeight: '800',
        color: '#525968',
        textAlign: 'center',
    },
    patternStateText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#747b8a',
    },
    patternBarsWrap: {
        height: 190,
        marginTop: 16,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 5,
    },
    patternBarColumn: {
        flex: 1,
        maxWidth: 46,
        alignItems: 'center',
    },
    patternBarTrack: {
        width: '100%',
        height: 154,
        borderRadius: 6,
        backgroundColor: '#dce4f7',
        justifyContent: 'flex-end',
        overflow: 'hidden',
    },
    patternBarTrackWeekend: {
        backgroundColor: '#cbd8f4',
    },
    patternBarFill: {
        width: '100%',
        borderTopLeftRadius: 6,
        borderTopRightRadius: 6,
        backgroundColor: '#5274d5',
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    patternBarFillWeekend: {
        backgroundColor: '#3158b8',
    },
    patternDayLabel: {
        marginTop: 7,
        fontSize: 12,
        fontWeight: '800',
        color: '#626a7b',
    },
    patternDayLabelWeekend: {
        color: '#3158b8',
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
    topProductsList: {
        marginTop: 16,
        gap: 2,
    },
    topProductRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 26,
    },
    topProductRowActive: {
        // optional styling for active row
    },
    topProductRank: {
        display: 'none',
    },
    topProductRankActive: {
        display: 'none',
    },
    topProductRankText: {
        display: 'none',
    },
    topProductRankTextActive: {
        display: 'none',
    },
    topProductLabel: {
        width: 78,
        fontSize: 13,
        lineHeight: 15,
        fontWeight: '700',
        color: '#6b7280',
    },
    topProductLabelActive: {
        color: '#11151f',
    },
    topProductGraphCell: {
        flex: 1,
        height: 34,
        justifyContent: 'center',
        paddingHorizontal: 0,
    },
    topProductBarTrack: {
        height: 22,
        borderRadius: 5,
        backgroundColor: '#dce4f7',
        overflow: 'hidden',
        justifyContent: 'center',
    },
    topProductBarTrackActive: {
        backgroundColor: '#ccd9f6',
    },
    topProductBarFill: {
        height: '100%',
        borderRadius: 5,
        minWidth: 6,
    },
    topProductBarFillActive: {
        shadowColor: '#1f2d4d',
        shadowOpacity: 0.22,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
    },
    topProductValueCell: {
        width: 48,
        alignItems: 'flex-end',
    },
    topProductValue: {
        fontSize: 13,
        fontWeight: '800',
        color: '#687085',
    },
    topProductValueActive: {
        color: '#11151f',
        fontSize: 14,
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
    periodSwitchBtnDisabled: {
        opacity: 0.58,
    },
    periodText: {
        fontSize: 18 / 1.2,
        fontWeight: '700',
        color: '#2a2d34',
    },
    periodTextActive: {
        color: '#ffffff',
    },
    periodTextDisabled: {
        color: '#747b8a',
    },
    topProductsEmptyWrap: {
        marginTop: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#d1d5df',
        backgroundColor: '#f4f4f5',
        padding: 14,
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
        alignItems: 'flex-end',
        gap: 10,
    },
    transactionFooterLeft: {
        flex: 1,
        gap: 6,
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
        textAlign: 'right',
        flexShrink: 0,
    },
    syncPill: {
        alignSelf: 'flex-start',
        minHeight: 24,
        borderRadius: 12,
        paddingHorizontal: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    syncPillSynced: {
        backgroundColor: '#ddf4e4',
        borderColor: '#70bf83',
    },
    syncPillPending: {
        backgroundColor: '#fff2cc',
        borderColor: '#d5a923',
    },
    syncPillFailed: {
        backgroundColor: '#fde4e1',
        borderColor: '#d96b5f',
    },
    syncText: {
        fontSize: 12,
        fontWeight: '800',
    },
    syncTextSynced: {
        color: '#27723a',
    },
    syncTextPending: {
        color: '#8a6810',
    },
    syncTextFailed: {
        color: '#b9463b',
    },
    syncErrorText: {
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '600',
        color: '#9d3f36',
    },
});
