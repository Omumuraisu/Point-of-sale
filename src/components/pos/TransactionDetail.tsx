import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CartItem, TransactionRecord } from '../../lib/types';
import { formatCurrency } from '../../lib/utils';

interface TransactionDetailProps {
    transaction: TransactionRecord | null;
    onBack: () => void;
}

const TransactionDetail = ({ transaction, onBack }: TransactionDetailProps) => {
    const insets = useSafeAreaInsets();

    const cartItems = Array.isArray(transaction?.cartItems) ? transaction.cartItems : [];
    const computedTotal = cartItems.reduce(
        (sum, item) => sum + (Number.isFinite(item?.total) ? item.total : 0),
        0,
    );

    const totalAmount = Number.isFinite(transaction?.totalDue)
        ? Number(transaction?.totalDue)
        : computedTotal;

    const paidAmount = Number.isFinite(transaction?.paidAmount)
        ? Number(transaction?.paidAmount)
        : totalAmount;

    const fallbackItem: CartItem[] = transaction
        ? [
            {
                id: `${transaction.id}-summary`,
                name: transaction.item,
                category: transaction.category,
                quantity: 1,
                unit: 'set',
                pricePerKg: totalAmount,
                total: totalAmount,
                createdAt: transaction.createdAt,
            },
        ]
        : [];

    const detailItems = cartItems.length > 0 ? cartItems : fallbackItem;

    return (
        <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <Pressable style={styles.backBtn} onPress={onBack}>
                    <Ionicons name="chevron-back" size={22} color="#ffffff" />
                </Pressable>

                <Text style={styles.headerTitle}>Transaction</Text>
            </View>

            <View style={styles.card}>
                {transaction ? (
                    <>
                        <Text style={styles.amountLabel}>Total Amount</Text>
                        <Text style={styles.amountValue}>{formatCurrency(totalAmount)}</Text>

                        <Text style={styles.sectionTitle}>Receipt Details</Text>

                        <ScrollView
                            style={styles.itemsScroll}
                            contentContainerStyle={styles.itemsContent}
                            showsVerticalScrollIndicator={false}
                        >
                            {detailItems.map((item) => (
                                <View key={item.id} style={styles.itemRow}>
                                    <View style={styles.itemMain}>
                                        <Text style={styles.itemName}>{item.name}</Text>
                                        <Text style={styles.itemSub}>
                                            {formatCurrency(item.pricePerKg)} per {item.unit}
                                        </Text>
                                    </View>
                                    <Text style={styles.itemPrice}>{formatCurrency(item.total)}</Text>
                                </View>
                            ))}
                        </ScrollView>

                        <View style={styles.cardFooter}>
                            <Text style={styles.orderText}>Transaction ID: {transaction.id}</Text>
                            <Text style={styles.orderText}>{transaction.dateLabel}</Text>
                            <Text style={styles.orderText}>Paid: {formatCurrency(paidAmount)}</Text>
                        </View>
                    </>
                ) : (
                    <View style={styles.emptyWrap}>
                        <Text style={styles.emptyTitle}>Transaction not found</Text>
                        <Text style={styles.emptyText}>
                            This transaction may have been removed from local storage.
                        </Text>
                    </View>
                )}
            </View>

            <Pressable
                style={[styles.confirmBtn, { marginBottom: Math.max(insets.bottom, 10) + 10 }]}
                onPress={onBack}
            >
                <Ionicons name="arrow-back-circle" size={30} color="#ffffff" />
                <Text style={styles.confirmText}>Back to Sales</Text>
            </Pressable>
        </SafeAreaView>
    );
};

export default TransactionDetail;

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#dfe2ec',
        paddingHorizontal: 20,
    },
    header: {
        minHeight: 62,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    backBtn: {
        position: 'absolute',
        left: 0,
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: '#2f58cc',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 38 / 2,
        fontWeight: '800',
        color: '#0f1118',
    },
    card: {
        flex: 1,
        marginTop: 6,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#b4b8c3',
        backgroundColor: '#f4f4f5',
        paddingHorizontal: 18,
        paddingTop: 24,
        paddingBottom: 14,
    },
    amountLabel: {
        textAlign: 'center',
        fontSize: 44 / 2,
        fontWeight: '700',
        color: '#8a8d94',
    },
    amountValue: {
        marginTop: 6,
        textAlign: 'center',
        fontSize: 68 / 2,
        fontWeight: '800',
        color: '#2448a4',
    },
    sectionTitle: {
        marginTop: 16,
        fontSize: 40 / 2,
        fontWeight: '700',
        color: '#111219',
    },
    itemsScroll: {
        marginTop: 8,
        flex: 1,
    },
    itemsContent: {
        paddingBottom: 8,
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#ceced2',
    },
    itemMain: {
        flex: 1,
        paddingRight: 8,
    },
    itemName: {
        fontSize: 34 / 2,
        fontWeight: '700',
        color: '#111219',
    },
    itemSub: {
        marginTop: 2,
        fontSize: 30 / 2,
        fontWeight: '600',
        color: '#80838a',
    },
    itemPrice: {
        alignSelf: 'center',
        fontSize: 33 / 2,
        fontWeight: '800',
        color: '#12131a',
    },
    cardFooter: {
        borderTopWidth: 1,
        borderTopColor: '#d0d2d7',
        marginTop: 8,
        paddingTop: 10,
        alignItems: 'center',
    },
    orderText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#c1c1c5',
    },
    emptyWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1c2029',
    },
    emptyText: {
        marginTop: 10,
        textAlign: 'center',
        fontSize: 15,
        fontWeight: '600',
        color: '#6d7280',
    },
    confirmBtn: {
        marginTop: 18,
        height: 88,
        borderRadius: 22,
        backgroundColor: '#2f5ada',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        shadowColor: '#000000',
        shadowOpacity: 0.15,
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 4,
        elevation: 4,
    },
    confirmText: {
        fontSize: 48 / 2,
        fontWeight: '800',
        color: '#ffffff',
    },
});
