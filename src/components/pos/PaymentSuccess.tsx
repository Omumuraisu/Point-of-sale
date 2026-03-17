import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CartItem } from '../../lib/types';
import { formatCurrency } from '../../lib/utils';

interface PaymentSuccessProps {
    cartItems?: CartItem[];
    paidAmount?: number;
    onNewSale: () => void;
    onBackHome: () => void;
}

const PaymentSuccess = ({
    cartItems = [],
    paidAmount = 0,
    onNewSale,
    onBackHome,
}: PaymentSuccessProps) => {
    const insets = useSafeAreaInsets();
    const totalAmount = cartItems.reduce(
        (sum, item) => sum + (Number.isFinite(item?.total) ? item.total : 0),
        0,
    );

    return (
        <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
            <View style={styles.successWrap}>
                <View style={styles.successCircleOuter}>
                    <View style={styles.successCircleInner}>
                        <Ionicons name="checkmark" size={52} color="#c8f4c8" />
                    </View>
                </View>
                <Text style={styles.successTitle}>Payment Successful!</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.amountLabel}>Total Amount Paid</Text>
                <Text style={styles.amountValue}>{formatCurrency(totalAmount)}</Text>

                <Text style={styles.sectionTitle}>Receipt Details</Text>

                <ScrollView
                    style={styles.itemsScroll}
                    contentContainerStyle={styles.itemsContent}
                    showsVerticalScrollIndicator={false}
                >
                    {cartItems.map((item) => (
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
                    <Text style={styles.orderText}>Transaction ID: #{Math.floor(Date.now() / 1000)}</Text>
                    <Text style={styles.orderText}>{new Date().toLocaleString()}</Text>
                    <Text style={styles.orderText}>Paid: {formatCurrency(Number(paidAmount || 0))}</Text>
                </View>
            </View>

            <View style={[styles.footerActions, { paddingBottom: Math.max(insets.bottom, 10) }]}>
                <Pressable style={styles.newSaleButton} onPress={onNewSale}>
                    <Ionicons name="cart" size={24} color="#ffffff" />
                    <Text style={styles.newSaleText}>NEW SALE</Text>
                </Pressable>

                <Pressable style={styles.backHomeButton} onPress={onBackHome}>
                    <Text style={styles.backHomeText}>BACK TO HOME</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
};

export default PaymentSuccess;

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#dfe2ec',
        paddingHorizontal: 18,
    },
    successWrap: {
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 12,
    },
    successCircleOuter: {
        width: 124,
        height: 124,
        borderRadius: 62,
        backgroundColor: '#c6edc8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    successCircleInner: {
        width: 78,
        height: 78,
        borderRadius: 39,
        backgroundColor: '#4ea852',
        alignItems: 'center',
        justifyContent: 'center',
    },
    successTitle: {
        marginTop: 14,
        fontSize: 56 / 2,
        fontWeight: '800',
        color: '#0f1118',
    },
    card: {
        flex: 1,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#b4b8c3',
        backgroundColor: '#f4f4f5',
        paddingHorizontal: 18,
        paddingTop: 20,
        paddingBottom: 12,
    },
    amountLabel: {
        textAlign: 'center',
        fontSize: 46 / 2,
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
        marginTop: 6,
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
    footerActions: {
        marginTop: 12,
        gap: 12,
    },
    newSaleButton: {
        height: 78,
        borderRadius: 39,
        backgroundColor: '#4da853',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    newSaleText: {
        fontSize: 52 / 2,
        fontWeight: '800',
        color: '#ffffff',
    },
    backHomeButton: {
        height: 68,
        borderRadius: 34,
        borderWidth: 2,
        borderColor: '#c2c6d1',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f4f4f5',
    },
    backHomeText: {
        fontSize: 48 / 2,
        fontWeight: '800',
        color: '#384150',
    },
});