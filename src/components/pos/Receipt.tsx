import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { CartItem } from '../../lib/types';
import { formatCurrency } from '../../lib/utils';

interface ReceiptProps {
    cartItems?: CartItem[];
    onBack: () => void;
    onAddMore: () => void;
    onClearAll: () => void;
    onConfirm: () => void;
    isConfirming?: boolean;
}

const Receipt = ({ cartItems = [], onBack, onAddMore, onClearAll, onConfirm, isConfirming = false }: ReceiptProps) => {
    const insets = useSafeAreaInsets();
    const totalAmount = cartItems.reduce(
        (sum, item) => sum + (Number.isFinite(item?.total) ? item.total : 0),
        0,
    );

    return (
        <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <Pressable style={styles.backBtn} onPress={onBack}>
                    <Ionicons name="chevron-back" size={22} color="#ffffff" />
                </Pressable>

                <Text style={styles.headerTitle}>Receipt</Text>

                <Pressable style={styles.clearBtn} onPress={onClearAll}>
                    <Ionicons name="trash-outline" size={15} color="#d85647" />
                    <Text style={styles.clearText}>Clear All</Text>
                </Pressable>
            </View>

            <View style={styles.card}>
                <Text style={styles.amountLabel}>Total Amount</Text>
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
                            <View style={styles.itemRight}>
                                <Text style={styles.itemPrice}>{formatCurrency(item.total)}</Text>
                                <View style={styles.rowActions}>
                                    <Ionicons name="trash-outline" size={14} color="#8f9196" />
                                    <Ionicons name="create-outline" size={14} color="#8f9196" />
                                </View>
                            </View>
                        </View>
                    ))}

                    <Pressable style={styles.addMoreRow} onPress={onAddMore}>
                        <Ionicons name="add-circle" size={20} color="#1e2a33" />
                        <Text style={styles.addMoreText}>Add More</Text>
                    </Pressable>
                </ScrollView>

                <View style={styles.cardFooter}>
                    <Text style={styles.orderText}>Order No. 123</Text>
                    <Text style={styles.orderText}>February 12, 2026 * 11:46 AM</Text>
                </View>
            </View>

            <Pressable
                style={[
                    styles.confirmBtn,
                    isConfirming ? styles.confirmBtnDisabled : null,
                    { marginBottom: Math.max(insets.bottom, 10) + 10 },
                ]}
                onPress={onConfirm}
                disabled={isConfirming}
            >
                <Ionicons name="wallet" size={31} color="#ffffff" />
                <Text style={styles.confirmText}>{isConfirming ? 'Opening Payment...' : 'Confirm'}</Text>
            </Pressable>
        </SafeAreaView>
    );
};

export default Receipt;

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
    clearBtn: {
        position: 'absolute',
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    clearText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#d85647',
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
    itemRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    itemPrice: {
        fontSize: 33 / 2,
        fontWeight: '800',
        color: '#12131a',
    },
    rowActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    addMoreRow: {
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    addMoreText: {
        fontSize: 40 / 2,
        fontWeight: '700',
        color: '#14151b',
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
    confirmBtn: {
        marginTop: 18,
        height: 102,
        borderRadius: 22,
        backgroundColor: '#70d976',
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
    confirmBtnDisabled: {
        opacity: 0.65,
    },
    confirmText: {
        fontSize: 70 / 2,
        fontWeight: '800',
        color: '#ffffff',
    },
});
