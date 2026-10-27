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

const PAYMENT_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
});

const BILLING_MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
});

const UTILITY_LABELS = {
    rent: 'Rent',
    electricity: 'Electricity',
    water: 'Water',
    other: 'Market Fees',
} as const;

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

const formatRecordedAt = (value: string | null): string => {
    if (!value) return 'Date unavailable';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Date unavailable' : PAYMENT_DATE_TIME_FORMATTER.format(date);
};

const formatBillingMonth = (value: string): string => {
    const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? value : BILLING_MONTH_FORMATTER.format(date);
};

const PaymentHistoryRoute = () => {
    const styles = useThemedStyles(baseStyles);
    const { colors } = useTheme();
    const router = useRouter();
    const { currentUser } = useAuthSession();
    const [payments, setPayments] = useState<PaymentHistoryEntry[]>([]);
    const [isLoading, setLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [expandedPaymentId, setExpandedPaymentId] = useState<number | null>(null);

    useEffect(() => {
        let isActive = true;

        const loadPaymentHistory = async () => {
            setLoading(true);
            setHasError(false);

            try {
                const history = await fetchPaymentHistory(
                    {
                        businessId: currentUser?.businessId,
                    },
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
    }, [currentUser?.businessId]);

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
                                    styles.paymentEntry,
                                    index === payments.length - 1 ? styles.lastPaymentEntry : null,
                                ]}
                            >
                                <Pressable
                                    style={styles.paymentRow}
                                    onPress={() => setExpandedPaymentId((current) => (
                                        current === payment.paymentId ? null : payment.paymentId
                                    ))}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Payment ${formatCurrency(payment.amount)} on ${formatPaymentDate(payment.paidAt)}`}
                                    accessibilityState={{ expanded: expandedPaymentId === payment.paymentId }}
                                >
                                    <View style={styles.paymentIcon}>
                                        <Ionicons name="checkmark" size={18} color={colors.success} />
                                    </View>
                                    <View style={styles.paymentText}>
                                        <Text style={styles.paymentAmount}>{formatCurrency(payment.amount)}</Text>
                                        <Text style={styles.paymentDate}>{formatPaymentDate(payment.paidAt)}</Text>
                                        {payment.referenceNumber ? (
                                            <Text style={styles.paymentReference}>Reference: {payment.referenceNumber}</Text>
                                        ) : null}
                                    </View>
                                    <Ionicons
                                        name={expandedPaymentId === payment.paymentId ? 'chevron-up' : 'chevron-down'}
                                        size={20}
                                        color={colors.textMuted}
                                    />
                                </Pressable>

                                {expandedPaymentId === payment.paymentId ? (
                                    <View style={styles.paymentDetails}>
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailLabel}>Recorded by</Text>
                                            <Text style={styles.detailValue}>{payment.recordedBy ?? 'Not available'}</Text>
                                        </View>
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailLabel}>Recorded on</Text>
                                            <Text style={styles.detailValue}>{formatRecordedAt(payment.recordedAt)}</Text>
                                        </View>
                                        {payment.notes ? (
                                            <View style={styles.notesWrap}>
                                                <Text style={styles.detailLabel}>Notes</Text>
                                                <Text style={styles.notesText}>{payment.notes}</Text>
                                            </View>
                                        ) : null}
                                        <Text style={styles.allocationsTitle}>Payment allocations</Text>
                                        {payment.allocations.map((allocation) => (
                                            <View style={styles.allocationRow} key={allocation.allocationId}>
                                                <View style={styles.allocationLabelWrap}>
                                                    <Text style={styles.allocationMonth}>
                                                        {formatBillingMonth(allocation.billingMonth)}
                                                    </Text>
                                                    <Text style={styles.allocationUtility}>
                                                        {allocation.utilityType
                                                            ? UTILITY_LABELS[allocation.utilityType]
                                                            : 'Unspecified'}
                                                    </Text>
                                                </View>
                                                <Text style={styles.allocationAmount}>{formatCurrency(allocation.amount)}</Text>
                                            </View>
                                        ))}
                                    </View>
                                ) : null}
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
    paymentEntry: {
        borderBottomWidth: 1,
        borderBottomColor: '#d9dde8',
    },
    lastPaymentEntry: {
        borderBottomWidth: 0,
    },
    paymentRow: {
        minHeight: 76,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
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
    paymentReference: {
        marginTop: 2,
        fontSize: 12,
        fontWeight: '600',
        color: '#7b808e',
    },
    paymentDetails: {
        marginBottom: 14,
        borderRadius: 12,
        backgroundColor: '#e9edf6',
        padding: 12,
        gap: 8,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
    },
    detailLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#747b89',
        textTransform: 'uppercase',
    },
    detailValue: {
        flex: 1,
        textAlign: 'right',
        fontSize: 13,
        fontWeight: '700',
        color: '#303746',
    },
    notesWrap: {
        borderTopWidth: 1,
        borderTopColor: '#d3d9e5',
        paddingTop: 8,
    },
    notesText: {
        marginTop: 3,
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '600',
        color: '#3f4655',
    },
    allocationsTitle: {
        marginTop: 2,
        borderTopWidth: 1,
        borderTopColor: '#d3d9e5',
        paddingTop: 9,
        fontSize: 14,
        fontWeight: '800',
        color: '#262d3a',
    },
    allocationRow: {
        minHeight: 42,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    allocationLabelWrap: {
        flex: 1,
    },
    allocationMonth: {
        fontSize: 13,
        fontWeight: '700',
        color: '#303746',
    },
    allocationUtility: {
        marginTop: 1,
        fontSize: 12,
        fontWeight: '600',
        color: '#747b89',
    },
    allocationAmount: {
        fontSize: 14,
        fontWeight: '800',
        color: '#2448a4',
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
