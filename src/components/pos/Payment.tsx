import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency } from '../../lib/utils';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'];

interface PaymentProps {
    totalDue?: number;
    onBack: () => void;
    onConfirmPayment: (paidAmount: number, changeAmount: number) => void;
}

const Payment = ({ totalDue = 0, onBack, onConfirmPayment }: PaymentProps) => {
    const insets = useSafeAreaInsets();
    const [amountInput, setAmountInput] = useState('');

    const paidAmount = useMemo(() => {
        const parsed = Number.parseFloat(amountInput);
        return Number.isFinite(parsed) ? parsed : 0;
    }, [amountInput]);

    const changeAmount = Math.max(paidAmount - Number(totalDue || 0), 0);
    const canConfirm = paidAmount >= Number(totalDue || 0) && Number(totalDue || 0) > 0;

    const handleKeyPress = (key: string) => {
        if (key === 'backspace') {
            setAmountInput((prev) => prev.slice(0, -1));
            return;
        }

        if (key === '.') {
            setAmountInput((prev) => {
                if (prev.includes('.')) {
                    return prev;
                }
                return prev.length ? `${prev}.` : '0.';
            });
            return;
        }

        setAmountInput((prev) => {
            const [whole = '', decimals = ''] = prev.split('.');

            if (prev.includes('.') && decimals.length >= 2) {
                return prev;
            }

            if (!prev.includes('.') && whole.length >= 6) {
                return prev;
            }

            return `${prev}${key}`;
        });
    };

    return (
        <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
            <ScrollView
                style={styles.scrollArea}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: Math.max(insets.bottom, 10) + 10 },
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.header}>
                    <Pressable style={styles.backBtn} onPress={onBack}>
                        <Ionicons name="chevron-back" size={22} color="#ffffff" />
                    </Pressable>
                    <Text style={styles.headerTitle}>Payment Process</Text>
                </View>

                <View style={styles.summaryCard}>
                    <View>
                        <Text style={styles.summaryLabel}>Total Due</Text>
                        <Text style={styles.summaryAmount}>{formatCurrency(Number(totalDue || 0))}</Text>
                    </View>
                    <View style={styles.summaryRight}>
                        <View style={styles.cartBadge}>
                            <Ionicons name="cart" size={28} color="#315bd7" />
                        </View>
                        <Text style={styles.orderText}>Order No. 123</Text>
                    </View>
                </View>

                <View style={styles.paidCard}>
                    <Text style={styles.paidTitle}>Amount Paid</Text>

                    <View style={styles.paidInputBox}>
                        <Text style={styles.paidInputText}>{formatCurrency(paidAmount)}</Text>
                    </View>

                    <View style={styles.changeBox}>
                        <Text style={styles.changeText}>{formatCurrency(changeAmount)}</Text>
                    </View>
                </View>

                <View style={styles.keyboardWrap}>
                    <View style={styles.keyGrid}>
                        {KEYS.map((key) => {
                            const isDelete = key === 'backspace';

                            return (
                                <Pressable
                                    key={key}
                                    style={[styles.keyButton, isDelete && styles.deleteKeyButton]}
                                    onPress={() => handleKeyPress(key)}
                                >
                                    {isDelete ? (
                                        <MaterialIcons name="backspace" size={24} color="#c05f5f" />
                                    ) : (
                                        <Text style={styles.keyText}>{key}</Text>
                                    )}
                                </Pressable>
                            );
                        })}
                    </View>

                    <Pressable
                        style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
                        onPress={() => onConfirmPayment?.(paidAmount, changeAmount)}
                        disabled={!canConfirm}
                    >
                        <Text style={styles.confirmButtonText}>Confirm Payment</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default Payment;

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#dfe2ec',
        paddingHorizontal: 20,
    },
    scrollArea: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    header: {
        minHeight: 70,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    backBtn: {
        position: 'absolute',
        left: 0,
        width: 38,
        height: 38,
        borderRadius: 9,
        backgroundColor: '#2f58cc',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 38 / 2,
        fontWeight: '800',
        color: '#0f1118',
    },
    summaryCard: {
        marginTop: 4,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#b4b8c3',
        backgroundColor: '#f4f4f5',
        minHeight: 120,
        paddingHorizontal: 20,
        paddingVertical: 18,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 48 / 2,
        fontWeight: '700',
        color: '#80838a',
    },
    summaryAmount: {
        marginTop: 6,
        fontSize: 72 / 2,
        fontWeight: '800',
        color: '#2448a4',
    },
    summaryRight: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    cartBadge: {
        width: 62,
        height: 62,
        borderRadius: 31,
        backgroundColor: '#cfd7f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    orderText: {
        marginTop: 8,
        fontSize: 18,
        fontWeight: '700',
        color: '#c1c1c5',
    },
    paidCard: {
        marginTop: 16,
        borderRadius: 22,
        backgroundColor: '#315bd7',
        paddingHorizontal: 16,
        paddingVertical: 14,
        shadowColor: '#000000',
        shadowOpacity: 0.15,
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 4,
        elevation: 4,
    },
    paidTitle: {
        fontSize: 52 / 2,
        fontWeight: '800',
        color: '#f5f7ff',
    },
    paidInputBox: {
        marginTop: 12,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#f2f2f2',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    paidInputText: {
        fontSize: 68 / 2,
        fontWeight: '800',
        color: '#2a3037',
    },
    changeBox: {
        marginTop: 10,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#c9e9cb',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    changeText: {
        fontSize: 68 / 2,
        fontWeight: '800',
        color: '#42984e',
    },
    keyboardWrap: {
        marginTop: 18,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#b4b8c3',
        backgroundColor: '#f4f4f5',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
    },
    keyGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 12,
    },
    keyButton: {
        width: '30%',
        height: 62,
        borderRadius: 20,
        backgroundColor: '#d5dbe8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    keyText: {
        fontSize: 50 / 2,
        fontWeight: '700',
        color: '#12141a',
    },
    deleteKeyButton: {
        backgroundColor: '#f0dcdd',
    },
    confirmButton: {
        marginTop: 18,
        height: 62,
        borderRadius: 22,
        backgroundColor: '#2f5ada',
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmButtonDisabled: {
        opacity: 0.55,
    },
    confirmButtonText: {
        fontSize: 48 / 2,
        fontWeight: '800',
        color: '#ffffff',
    },
});