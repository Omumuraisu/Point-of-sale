import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthSession } from '../lib/authSession';
import { fetchPaymentHistory, PaymentHistoryEntry } from '../lib/billing';
import { formatCurrency } from '../lib/utils';
import { useTheme, useThemedStyles } from '../lib/theme';

const PAYMENT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
});

const formatPaymentDate = (value: string | null): string => {
    if (!value) {
        return 'Date unavailable';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'Date unavailable';
    }

    return PAYMENT_DATE_FORMATTER.format(date);
};

const PaymentHistoryRoute = () => {
    const styles = useThemedStyles(baseStyles);
    const { colors } = useTheme();
    const router = useRouter();
    const { currentUser } = useAuthSession();
    const [payments, setPayments] = useState<PaymentHistoryEntry[]>([]);
    const [isLoading, setLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        let isActive = true;

        const loadPaymentHistory = async () => {
            setLoading(true);
            setHasError(false);

            try {
                const history = await fetchPaymentHistory(
                    currentUser?.businessId,
                    currentUser?.stallNumber,
                );

                if (isActive) {
                    setPayments(history);
                }
            } catch {
                if (isActive) {
                    setPayments([]);
                    setHasError(true);
                }
            } finally {
                if (isActive) {
                    setLoading(false);
                }
            }
        };

        void loadPaymentHistory();

        return () => {
            isActive = false;
        };
    }, [currentUser?.businessId, currentUser?.stallNumber]);

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Back to billing"
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="chevron-back" size={24} color={colors.icon} />
                </Pressable>
                <Text style={styles.headerTitle}>Payment History</Text>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.contentContainer}
            >
                {isLoading ? (
                    <View style={styles.stateCard}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.stateTitle}>Loading payment history</Text>
                    </View>
                ) : hasError ? (
                    <View style={styles.stateCard}>
                        <Ionicons name="cloud-offline-outline" size={46} color={colors.textMuted} />
                        <Text style={styles.stateTitle}>Unable to load payments</Text>
                        <Text style={styles.stateText}>Please check your connection and try again later.</Text>
                    </View>
                ) : payments.length === 0 ? (
                    <View style={styles.stateCard}>
                        <Ionicons name="receipt-outline" size={46} color={colors.textMuted} />
                        <Text style={styles.stateTitle}>No payment history yet</Text>
                        <Text style={styles.stateText}>Completed billing payments will appear here.</Text>
                    </View>
                ) : (
                    <View style={styles.historyCard}>
                        {payments.map((payment, index) => (
                            <View
                                key={payment.paymentId}
                                style={[
                                    styles.paymentRow,
                                    index === payments.length - 1 ? styles.lastPaymentRow : null,
                                ]}
                            >
                                <View style={styles.paymentIcon}>
                                    <Ionicons name="checkmark" size={18} color={colors.success} />
                                </View>
                                <View style={styles.paymentText}>
                                    <Text style={styles.paymentAmount}>{formatCurrency(payment.amount)}</Text>
                                    <Text style={styles.paymentDate}>{formatPaymentDate(payment.paidAt)}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default PaymentHistoryRoute;

const baseStyles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#dfe2ec',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 6,
        paddingBottom: 10,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#eef0f6',
    },
    headerTitle: {
        marginLeft: 10,
        fontSize: 22,
        fontWeight: '700',
        color: '#1c2028',
    },
    contentContainer: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingBottom: 24,
    },
    historyCard: {
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#c8ccd8',
        backgroundColor: '#f4f4f5',
        paddingHorizontal: 14,
    },
    paymentRow: {
        minHeight: 76,
        borderBottomWidth: 1,
        borderBottomColor: '#d9dde8',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    lastPaymentRow: {
        borderBottomWidth: 0,
    },
    paymentIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#d9f1dc',
        alignItems: 'center',
        justifyContent: 'center',
    },
    paymentText: {
        flex: 1,
    },
    paymentAmount: {
        fontSize: 20,
        fontWeight: '800',
        color: '#2448a4',
    },
    paymentDate: {
        marginTop: 3,
        fontSize: 14,
        fontWeight: '600',
        color: '#6d7280',
    },
    stateCard: {
        minHeight: 240,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#c8ccd8',
        backgroundColor: '#f4f4f5',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    stateTitle: {
        marginTop: 12,
        fontSize: 20,
        fontWeight: '800',
        color: '#1c2029',
        textAlign: 'center',
    },
    stateText: {
        marginTop: 6,
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '600',
        color: '#6d7280',
        textAlign: 'center',
    },
});
