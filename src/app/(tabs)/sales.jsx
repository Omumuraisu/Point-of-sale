import { useState } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import POSHeader from '../../components/pos/components/POSHeader';

const BAR_DATA = [
    { month: 'Jan', value: 72, active: false },
    { month: 'Feb', value: 44, active: true },
    { month: 'Mar', value: 88, active: false },
    { month: 'Apr', value: 84, active: false },
    { month: 'May', value: 90, active: false },
    { month: 'Jun', value: 86, active: false },
    { month: 'Jul', value: 89, active: false },
];

const TRANSACTIONS = [
    {
        id: '#12345',
        item: 'Chicken Thigh',
        amount: 'P 364.00',
        subtitle: '170 per kg',
        category: 'Meat',
        categoryType: 'meat',
    },
    {
        id: '#12346',
        item: 'Pancit Noodles',
        amount: 'P 144.00',
        subtitle: '4 packs',
        category: 'Dry Goods',
        categoryType: 'dry',
    },
];

const Sales = () => {
    const [viewMode, setViewMode] = useState('chart');

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

                {viewMode === 'chart' ? <ChartView /> : <TransactionsView />}
            </View>
        </SafeAreaView>
    );
};

const ChartView = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.summaryWrap}>
            <Text style={styles.summaryLabel}>Today's Total Sales</Text>
            <Text style={styles.summaryAmount}>P 14,247.00</Text>
            <View style={styles.growthPill}>
                <Text style={styles.growthText}>+12% from yesterday</Text>
            </View>
        </View>

        <View style={styles.chartCard}>
            <Text style={styles.cardTitle}>Monthly Sales</Text>

            <View style={styles.barsWrap}>
                {BAR_DATA.map((bar) => (
                    <View key={bar.month} style={styles.barCol}>
                        <View style={styles.barTrack}>
                            <View style={[styles.barFill, { height: `${bar.value}%` }, bar.active && styles.barFillActive]}>
                                {bar.active ? (
                                    <View style={styles.activeDot}>
                                        <Ionicons name="chevron-up" size={14} color="#ffffff" />
                                    </View>
                                ) : null}
                            </View>
                        </View>
                        <Text style={[styles.monthText, bar.active && styles.monthTextActive]}>{bar.month}</Text>
                    </View>
                ))}
            </View>

            <View style={styles.periodSwitchWrap}>
                <View style={styles.periodSwitchBtn}><Text style={styles.periodText}>Daily</Text></View>
                <View style={styles.periodSwitchBtn}><Text style={styles.periodText}>Weekly</Text></View>
                <View style={[styles.periodSwitchBtn, styles.periodSwitchBtnActive]}>
                    <Text style={[styles.periodText, styles.periodTextActive]}>Monthly</Text>
                </View>
            </View>
        </View>
    </ScrollView>
);

const TransactionsView = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.filtersRow}>
            <View style={styles.filterPill}>
                <Ionicons name="calendar" size={16} color="#2a2d34" />
                <Text style={styles.filterText}>mm/dd/yyyy</Text>
            </View>
            <View style={styles.filterPill}>
                <Text style={styles.filterText}>Category</Text>
                <Ionicons name="chevron-down" size={16} color="#6a6e77" />
            </View>
            <View style={[styles.filterPill, styles.exportPill]}>
                <MaterialCommunityIcons name="tray-arrow-down" size={16} color="#d85647" />
                <Text style={styles.exportText}>Export</Text>
            </View>
        </View>

        {TRANSACTIONS.map((transaction) => (
            <View key={transaction.id} style={styles.transactionCard}>
                <View style={styles.transactionTopRow}>
                    <Text style={styles.transactionTitle}>{transaction.item}</Text>
                    <Text style={styles.transactionAmount}>{transaction.amount}</Text>
                </View>

                <View style={styles.transactionMetaRow}>
                    <View
                        style={[
                            styles.categoryPill,
                            transaction.categoryType === 'meat' ? styles.categoryPillMeat : styles.categoryPillDry,
                        ]}
                    >
                        <Text
                            style={[
                                styles.categoryPillText,
                                transaction.categoryType === 'meat'
                                    ? styles.categoryPillTextMeat
                                    : styles.categoryPillTextDry,
                            ]}
                        >
                            {transaction.category}
                        </Text>
                    </View>

                    <Text style={styles.transactionSub}>{transaction.subtitle}</Text>
                </View>

                <View style={styles.transactionFooterRow}>
                    <Text style={styles.transactionFooterBold}>Transaction ID: {transaction.id}</Text>
                    <Text style={styles.transactionFooter}>Feb. 12, 2026 | 11:24AM</Text>
                </View>
            </View>
        ))}
    </ScrollView>
);

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
        alignItems: 'center',
    },
    barTrack: {
        width: 46,
        height: 170,
        borderRadius: 23,
        backgroundColor: '#a8b9ea',
        justifyContent: 'flex-end',
        overflow: 'hidden',
    },
    barFill: {
        backgroundColor: '#7f98e4',
        borderRadius: 23,
        alignItems: 'center',
        justifyContent: 'center',
    },
    barFillActive: {
        backgroundColor: '#2448a4',
    },
    activeDot: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#c3d6ff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    monthText: {
        marginTop: 8,
        fontSize: 16,
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
    filterText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6a6e77',
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
