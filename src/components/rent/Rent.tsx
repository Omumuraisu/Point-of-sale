import { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    LayoutAnimation,
    Platform,
    UIManager,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import POSHeader from '../pos/components/POSHeader';
import { loadVendorApplications, PersonnelRecord } from './personnelStore';
import { useAuthSession } from '../../lib/authSession';
import {
    calculateUtilityPenalty,
    fetchBillingSummary,
    BillingStatus,
    BillingSummary,
    ChargeableUtilityType,
} from '../../lib/billing';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { fetchBusinessLeaseAgreement, BusinessLeaseAgreement } from '../../lib/businessLease';
import { formatCurrency } from '../../lib/utils';

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
});

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
});

const formatDate = (value: string | null) => {
    if (!value) {
        return 'No due date yet';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return DATE_FORMATTER.format(date);
};

const formatPlainDate = (value: string | null) => {
    if (!value) {
        return 'No record yet';
    }

    const normalizedDateValue = /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? `${value}T00:00:00`
        : value;
    const date = new Date(normalizedDateValue);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return DATE_FORMATTER.format(date);
};

const formatBillingMonth = (value: string | null) => {
    if (!value) {
        return 'Current Bill';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return `${value} Bill`;
    }

    return `${MONTH_FORMATTER.format(date)} Bill`;
};

const formatBillingMonthLabel = (value: string | null) => {
    if (!value) {
        return 'Unassigned month';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return MONTH_FORMATTER.format(date);
};

const BILLING_STATUS_LABELS: Record<BillingStatus, string> = {
    pending: 'PENDING',
    partially_paid: 'PARTIALLY PAID',
    overdue: 'OVERDUE',
    overdue_partially_paid: 'OVERDUE - PARTIALLY PAID',
    fully_paid: 'FULLY PAID',
};

const formatLeaseType = (value: string): string => value.replace(/_+/g, ' ').trim();

const Rent = () => {
    const styles = useThemedStyles(baseStyles);
    const { colors } = useTheme();
    const router = useRouter();
    const params = useLocalSearchParams<{ billingCycleId?: string | string[]; billingMonth?: string | string[] }>();
    const { currentUser } = useAuthSession();
    const [isDueDetailsExpanded, setDueDetailsExpanded] = useState(false);
    const [expandedUtilities, setExpandedUtilities] = useState<Partial<Record<ChargeableUtilityType, boolean>>>({});
    const [personnelRecords, setPersonnelRecords] = useState<PersonnelRecord[]>([]);
    const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(null);
    const [leaseAgreement, setLeaseAgreement] = useState<BusinessLeaseAgreement | null>(null);
    const [isBillingLoading, setBillingLoading] = useState(true);
    const [billingError, setBillingError] = useState<string | null>(null);
    const [isLeaseLoading, setLeaseLoading] = useState(true);
    const isVendor = currentUser?.profileTable === 'vendor';
    const isDeveloper = currentUser?.userType.toLowerCase().trim() === 'developer';
    const billingCycleParam = Array.isArray(params.billingCycleId) ? params.billingCycleId[0] : params.billingCycleId;
    const billingMonthParam = Array.isArray(params.billingMonth) ? params.billingMonth[0] : params.billingMonth;
    const focusedBillingCycleId = billingCycleParam && Number.isSafeInteger(Number(billingCycleParam))
        ? Number(billingCycleParam)
        : null;

    useEffect(() => {
        if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
            UIManager.setLayoutAnimationEnabledExperimental(true);
        }
    }, []);

    const loadBilling = useCallback(async () => {
        setBillingLoading(true);
        setBillingError(null);
        try {
            const summary = await fetchBillingSummary({
                businessId: currentUser?.businessId,
            }, {
                billingCycleId: focusedBillingCycleId,
                billingMonth: billingMonthParam ?? null,
            });
            setBillingSummary(summary);
            if (summary?.focusedBillId) setDueDetailsExpanded(true);
        } catch {
            setBillingSummary(null);
            setBillingError('Billing information is temporarily unavailable. Please try again.');
        } finally {
            setBillingLoading(false);
        }
    }, [currentUser?.businessId, focusedBillingCycleId, billingMonthParam]);

    useFocusEffect(useCallback(() => {
        let isActive = true;
        setDueDetailsExpanded(Boolean(focusedBillingCycleId || billingMonthParam));
        void loadBilling();
        void loadVendorApplications(currentUser?.businessOwnerId)
            .then((saved) => { if (isActive) setPersonnelRecords(saved); })
            .catch(() => { if (isActive) setPersonnelRecords([]); });

        if (isVendor) {
            setLeaseAgreement(null);
            setLeaseLoading(false);
        } else {
            setLeaseLoading(true);
            void fetchBusinessLeaseAgreement(currentUser?.businessId, currentUser?.businessOwnerId)
                .then((lease) => { if (isActive) setLeaseAgreement(lease); })
                .catch(() => { if (isActive) setLeaseAgreement(null); })
                .finally(() => { if (isActive) setLeaseLoading(false); });
        }
        return () => { isActive = false; };
    }, [billingMonthParam, currentUser?.businessId, currentUser?.businessOwnerId, focusedBillingCycleId, isVendor, loadBilling]));

    const handleToggleDueDetails = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setDueDetailsExpanded((previous) => !previous);
    };

    const handleAddPersonnel = () => {
        router.push({ pathname: 'add-personnel' });
    };

    const handlePersonnelPress = (personnelId: string) => {
        router.push({
            pathname: '/personnel-detail',
            params: { id: personnelId },
        });
    };

    const handlePaymentHistoryPress = () => {
        router.push('/payment-history');
    };

    const handleToggleUtility = (utilityType: ChargeableUtilityType) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedUtilities((current) => ({
            ...current,
            [utilityType]: !current[utilityType],
        }));
    };

    const personnelList = isVendor
        ? personnelRecords.filter((personnel) => personnel.accountId !== currentUser?.accountId)
        : personnelRecords;
    const stallNumber = currentUser?.stallNumber ?? 'Not assigned';
    const currentBill = billingSummary?.currentBill ?? null;
    useEffect(() => {
        setExpandedUtilities({});
    }, [currentBill?.monthlyBillId]);
    const currentUtilityPenalty = currentBill ? calculateUtilityPenalty(currentBill) : null;
    const arrearsPenaltyTotal = billingSummary?.arrearsBills.reduce((sum, bill) => (
        sum + calculateUtilityPenalty(bill).totalPenalty
    ), 0) ?? 0;
    const billingStatus = currentBill?.status ?? 'pending';
    const billingStatusIsPaid = billingStatus === 'fully_paid';
    const billingStatusIsPartial = billingStatus === 'partially_paid';
    const billingStatusIsOverdue = billingStatus === 'overdue' || billingStatus === 'overdue_partially_paid';
    const totalAmount = isBillingLoading
        ? 'Loading...'
        : formatCurrency(
            (billingSummary?.totalOutstanding ?? 0)
            + (currentUtilityPenalty?.totalPenalty ?? 0)
            + arrearsPenaltyTotal,
        );
    const amountLabel = 'Total Outstanding';
    const billingDateLabel = currentBill
        ? billingStatusIsPaid
            ? 'Paid in full'
            : `Due: ${formatDate(currentBill.dueDate)}`
        : 'No billing record yet';
    const billingDateIcon = billingStatusIsPaid
            ? 'checkmark-circle-outline'
            : 'calendar-outline';
    const billBreakdown = currentBill
        ? currentBill.chargeBreakdown.length > 0
            ? currentBill.chargeBreakdown.map((charge) => ({
                id: `charge-${charge.id}`,
                code: charge.code,
                label: charge.label,
                amount: charge.amount,
                description: charge.description,
                utilityType: charge.utilityType,
            }))
            : [
                { id: 'fallback-rent', code: 'rent', label: 'Rent', amount: currentBill.rentAmount, description: null, utilityType: 'rent' as const },
                { id: 'fallback-electricity', code: 'electricity', label: 'Electricity', amount: currentBill.electricityAmount, description: null, utilityType: 'electricity' as const },
                { id: 'fallback-water', code: 'water', label: 'Water', amount: currentBill.waterAmount, description: null, utilityType: 'water' as const },
                ...(currentBill.otherAmount > 0 ? [{
                    id: 'fallback-other', code: 'other', label: 'Other Charges', amount: currentBill.otherAmount, description: null, utilityType: null,
                }] : []),
            ].filter((charge) => charge.amount > 0)
        : [];
    const utilityCharges = currentBill ? [
        { id: 'utility-rent', utilityType: 'rent' as const, label: 'Rent', amount: currentBill.rentAmount },
        { id: 'utility-water', utilityType: 'water' as const, label: 'Water', amount: currentBill.waterAmount },
        { id: 'utility-electricity', utilityType: 'electricity' as const, label: 'Electricity', amount: currentBill.electricityAmount },
    ] : [];
    const marketFeeCharges = billBreakdown.filter((charge) => {
        const normalizedCode = charge.code.trim().toLowerCase();
        return normalizedCode !== 'rent' && normalizedCode !== 'water' && normalizedCode !== 'electricity';
    });
    const marketFeeTotal = marketFeeCharges.reduce((sum, charge) => sum + charge.amount, 0);

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.container}>
                <POSHeader />

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.contentContainer}
                >
                    <View style={styles.card}>
                        <View style={styles.stallWrap}>
                            <View style={styles.stallIconBox}>
                    <MaterialCommunityIcons name="storefront-outline" size={34} color={colors.primary} />
                            </View>
                            <View>
                                <Text style={styles.stallName}>Stall</Text>
                                <Text style={styles.stallNumber}>{stallNumber}</Text>
                            </View>
                        </View>

                        <View style={styles.ownerWrap}>
                            <Text style={styles.ownerName}>{currentUser?.displayName ?? 'Loading...'}</Text>
                            <Text style={styles.ownerRole}>
                                {isDeveloper ? 'DEVELOPER' : isVendor ? 'STALL VENDOR' : 'STALL OWNER'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.card}>
                        <View style={styles.rowBetween}>
                            <View>
                                <Text style={styles.sectionTitle}>Billing Status</Text>
                                <Text style={styles.billingMonthTitle}>
                                    {isBillingLoading ? 'Loading bill...' : formatBillingMonth(currentBill?.billingMonth ?? null)}
                                </Text>
                            </View>
                            <View style={[
                                styles.unpaidPill,
                                billingStatusIsPaid ? styles.paidPill : null,
                                billingStatusIsPartial ? styles.partialPill : null,
                                billingStatusIsOverdue ? styles.overduePill : null,
                            ]}>
                                <Text style={[
                                    styles.unpaidText,
                                    billingStatusIsPaid ? styles.paidText : null,
                                    billingStatusIsPartial ? styles.partialText : null,
                                ]}>
                                    {isBillingLoading ? 'LOADING' : BILLING_STATUS_LABELS[billingStatus]}
                                </Text>
                            </View>
                        </View>

                        {isBillingLoading ? (
                            <View style={styles.billingState}>
                                <ActivityIndicator color={colors.primary} />
                                <Text style={styles.billingStateText}>Loading current billing information...</Text>
                            </View>
                        ) : billingError ? (
                            <View style={styles.billingErrorState}>
                                <Ionicons name="cloud-offline-outline" size={34} color={colors.textMuted} />
                                <Text style={styles.billingErrorText}>{billingError}</Text>
                                <Pressable style={styles.retryButton} onPress={() => void loadBilling()}>
                                    <Text style={styles.retryButtonText}>Try Again</Text>
                                </Pressable>
                            </View>
                        ) : !billingSummary ? (
                            <View style={styles.billingState}>
                                <Ionicons name="receipt-outline" size={34} color={colors.textMuted} />
                                <Text style={styles.billingStateTitle}>No issued bills yet</Text>
                                <Text style={styles.billingStateText}>Billing details will appear after a monthly bill is submitted.</Text>
                            </View>
                        ) : (
                        <>
                        <Text style={styles.subLabel}>{amountLabel}</Text>
                        <Text style={styles.totalAmount}>{totalAmount}</Text>

                        <Pressable
                            style={styles.rowBetween}
                            onPress={handleToggleDueDetails}
                        >
                            <View style={styles.dueRow}>
                                    <Ionicons name={billingDateIcon} size={20} color={colors.primary} />
                                <Text style={styles.dueText}>{billingDateLabel}</Text>
                            </View>
                            <Ionicons
                                name={isDueDetailsExpanded ? 'chevron-up' : 'chevron-down'}
                                size={22}
                                color={colors.textMuted}
                            />
                        </Pressable>

                        {isDueDetailsExpanded ? (
                            <View style={styles.extraDetailsWrap}>
                                <Text style={styles.extraDetailsTitle}>Bill Summary</Text>
                                {billBreakdown.length > 0 ? (
                                    <>
                                        <View style={[
                                            styles.monthSectionHeader,
                                            billingSummary?.focusedBillId === currentBill?.monthlyBillId ? styles.focusedBill : null,
                                        ]}>
                                            <Text style={styles.monthSectionTitle}>Current Bill</Text>
                                            <Text style={styles.monthSectionMeta}>
                                                {formatBillingMonthLabel(billingSummary?.currentBill?.billingMonth ?? null)}
                                            </Text>
                                        </View>
                                        <View style={styles.chargeSectionWrap}>
                                            <Text style={styles.chargeSectionTitle}>Utilities</Text>
                                            {utilityCharges.map((item) => {
                                                const calculation = currentBill
                                                    ? calculateUtilityPenalty(currentBill, undefined, item.utilityType)
                                                    : null;
                                                const isExpanded = Boolean(expandedUtilities[item.utilityType]);

                                                return (
                                                    <View key={item.id}>
                                                        <Pressable
                                                            style={styles.breakdownRow}
                                                            accessibilityRole="button"
                                                            accessibilityLabel={`${item.label} charge details`}
                                                            accessibilityState={{ expanded: isExpanded }}
                                                            onPress={() => handleToggleUtility(item.utilityType)}
                                                        >
                                                            <View style={styles.utilityRowLabelWrap}>
                                                                <Text style={styles.extraDetailsLabel}>{item.label}</Text>
                                                                <Ionicons
                                                                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                                                    size={16}
                                                                    color={colors.textMuted}
                                                                />
                                                            </View>
                                                            <Text style={styles.extraDetailsAmount}>{formatCurrency(item.amount)}</Text>
                                                        </Pressable>
                                                        {calculation && isExpanded ? (
                                                            <View style={styles.utilityPenaltyWrap}>
                                                                <Text style={styles.utilityPenaltyTitle}>
                                                                    {item.label} Charge Calculation
                                                                </Text>
                                                                <View style={styles.penaltyRow}>
                                                                    <Text style={styles.penaltyLabel}>Unpaid principal</Text>
                                                                    <Text style={styles.penaltyAmount}>
                                                                        {formatCurrency(calculation.unpaidPrincipal)}
                                                                    </Text>
                                                                </View>
                                                                <View style={styles.penaltyRow}>
                                                                    <Text style={styles.penaltyLabel}>One-time 25% surcharge</Text>
                                                                    <Text style={styles.penaltyAmount}>
                                                                        {formatCurrency(calculation.surcharge)}
                                                                    </Text>
                                                                </View>
                                                                <View style={styles.penaltyRow}>
                                                                    <Text style={styles.penaltyLabel}>
                                                                        Interest (2% per month starting when overdue, maximum 36 charges)
                                                                    </Text>
                                                                    <Text style={styles.penaltyAmount}>
                                                                        {formatCurrency(calculation.interest)}
                                                                    </Text>
                                                                </View>
                                                                <View style={styles.penaltyRow}>
                                                                    <Text style={styles.penaltyLabel}>36-month additional charge (72%)</Text>
                                                                    <Text style={styles.penaltyAmount}>
                                                                        {formatCurrency(calculation.additional36MonthCharge)}
                                                                    </Text>
                                                                </View>
                                                                <View style={[styles.penaltyRow, styles.totalUtilityRow]}>
                                                                    <Text style={styles.totalUtilityLabel}>
                                                                        Total {item.label.toLowerCase()} balance
                                                                    </Text>
                                                                    <Text style={styles.totalUtilityAmount}>
                                                                        {formatCurrency(calculation.totalUtilityBalance)}
                                                                    </Text>
                                                                </View>
                                                            </View>
                                                        ) : null}
                                                    </View>
                                                );
                                            })}
                                        </View>
                                        <View style={styles.marketFeesWrap}>
                                            <View style={styles.marketFeesHeader}>
                                                <Text style={styles.marketFeesTitle}>Market Fees</Text>
                                                <Text style={styles.marketFeesTotal}>{formatCurrency(marketFeeTotal)}</Text>
                                            </View>
                                        </View>
                                        <View style={[styles.breakdownRow, styles.subtotalRow]}>
                                            <Text style={styles.subtotalLabel}>Bill Total</Text>
                                            <Text style={styles.subtotalAmount}>
                                                {formatCurrency(
                                                    (currentBill?.totalAmount ?? 0)
                                                    + (currentUtilityPenalty?.totalPenalty ?? 0),
                                                )}
                                            </Text>
                                        </View>
                                        <View style={styles.breakdownRow}>
                                            <Text style={styles.extraDetailsLabel}>Payments Applied</Text>
                                            <Text style={styles.extraDetailsAmount}>{formatCurrency(currentBill?.appliedAmount ?? 0)}</Text>
                                        </View>
                                        <View style={[styles.breakdownRow, styles.subtotalRow]}>
                                            <Text style={styles.subtotalLabel}>Current Balance</Text>
                                            <Text style={styles.subtotalAmount}>
                                                {formatCurrency(
                                                    (currentBill?.balance ?? 0)
                                                    + (currentUtilityPenalty?.totalPenalty ?? 0),
                                                )}
                                            </Text>
                                        </View>
                                        {billingSummary?.arrearsBills.length ? (
                                            <View style={styles.arrearsWrap}>
                                                <View style={styles.monthSectionHeader}>
                                                    <Text style={styles.monthSectionTitle}>Arrears</Text>
                                                    <Text style={styles.monthSectionMeta}>Previous Balance</Text>
                                                </View>
                                                {billingSummary.arrearsBills.map((month) => {
                                                    const arrearsPenalty = calculateUtilityPenalty(month);
                                                    const arrearsMarketFees = month.chargeBreakdown.filter((charge) => (
                                                        charge.code.trim().toLowerCase() === 'market_fee'
                                                    ));
                                                    const arrearsMarketFeeTotal = arrearsMarketFees.reduce((sum, charge) => (
                                                        sum + charge.amount
                                                    ), 0);

                                                    return (
                                                        <View style={styles.arrearsMonthWrap} key={month.monthlyBillId}>
                                                            <View
                                                                style={[
                                                                    styles.breakdownRow,
                                                                    billingSummary.focusedBillId === month.monthlyBillId ? styles.focusedBill : null,
                                                                ]}
                                                            >
                                                                <Text style={styles.extraDetailsLabel}>
                                                                    {formatBillingMonthLabel(month.billingMonth)}
                                                                </Text>
                                                                <Text style={styles.extraDetailsAmount}>
                                                                    {formatCurrency(month.balance + arrearsPenalty.totalPenalty)}
                                                                </Text>
                                                            </View>
                                                            {arrearsMarketFees.length > 0 ? (
                                                                <View style={styles.arrearsMarketFeesWrap}>
                                                                    <View style={styles.marketFeesHeader}>
                                                                        <Text style={styles.arrearsMarketFeesTitle}>Market Fees</Text>
                                                                        <Text style={styles.arrearsMarketFeesTotal}>
                                                                            {formatCurrency(arrearsMarketFeeTotal)} billed
                                                                        </Text>
                                                                    </View>
                                                                </View>
                                                            ) : null}
                                                        </View>
                                                    );
                                                })}
                                                <View style={[styles.breakdownRow, styles.subtotalRow]}>
                                                    <Text style={styles.subtotalLabel}>Arrears Subtotal</Text>
                                                    <Text style={styles.subtotalAmount}>
                                                        {formatCurrency(billingSummary.arrearsAmount + arrearsPenaltyTotal)}
                                                    </Text>
                                                </View>
                                            </View>
                                        ) : null}
                                        <View style={[styles.breakdownRow, styles.overallRow]}>
                                            <Text style={styles.overallLabel}>
                                                Total Outstanding
                                            </Text>
                                            <Text style={styles.overallAmount}>
                                                {formatCurrency(
                                                    (billingSummary?.totalOutstanding ?? 0)
                                                    + (currentUtilityPenalty?.totalPenalty ?? 0)
                                                    + arrearsPenaltyTotal,
                                                )}
                                            </Text>
                                        </View>
                                    </>
                                ) : (
                                    <View style={styles.breakdownRow}>
                                        <Text style={styles.extraDetailsLabel}>No billing details yet</Text>
                                        <Text style={styles.extraDetailsAmount}>{formatCurrency(0)}</Text>
                                    </View>
                                )}
                                <View style={styles.extraDetailsNoteRow}>
                                    <Ionicons name="document-text-outline" size={18} color={colors.textMuted} />
                                    <Text style={styles.extraDetailsNote}>
                                        {billingSummary
                                            ? billingStatusIsPaid
                                                ? 'This bill has been paid in full.'
                                                : billingStatusIsOverdue
                                                    ? 'This bill is overdue. The balance includes the applicable utility charges.'
                                                    : 'The balance shown includes all payments currently applied.'
                                            : 'Billing details will appear once submitted.'}
                                    </Text>
                                </View>
                            </View>
                        ) : null}

                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Open payment history"
                            style={styles.paymentHistoryButton}
                            onPress={handlePaymentHistoryPress}
                        >
                                <Ionicons name="time-outline" size={18} color={colors.primary} />
                            <Text style={styles.paymentHistoryButtonText}>Payment History</Text>
                                <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                        </Pressable>
                        </>
                        )}
                    </View>

                    <Text style={styles.personnelTitle}>Other Personnel</Text>

                    {personnelList.map((personnel) => {
                        const fullName = `${personnel.firstName} ${personnel.lastName}`.trim();
                        const statusLabel = personnel.status?.toUpperCase();
                        const isPending = personnel.status === 'pending approval';

                        return (
                            <Pressable
                                style={styles.personnelCard}
                                key={personnel.id}
                                disabled={isVendor}
                                onPress={isVendor ? undefined : () => handlePersonnelPress(personnel.id)}
                            >
                                <View style={styles.personnelAvatar}>
                                    <Ionicons name="person" size={24} color="#ffffff" />
                                </View>
                                <View style={styles.personnelTextWrap}>
                                    <Text style={styles.personnelName} numberOfLines={1}>
                                        {fullName || 'Unnamed'}
                                    </Text>
                                    {statusLabel ? (
                                        <View
                                            style={[
                                                styles.statusPill,
                                                isPending ? styles.statusPillPending : styles.statusPillApproved,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.statusText,
                                                    isPending ? styles.statusTextPending : styles.statusTextApproved,
                                                ]}
                                            >
                                                {statusLabel}
                                            </Text>
                                        </View>
                                    ) : null}
                                </View>
                                {!isVendor ? (
                                            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                                ) : null}
                            </Pressable>
                        );
                    })}

                    {!isVendor ? (
                        <Pressable
                            style={styles.addPersonnelButton}
                            onPress={handleAddPersonnel}
                        >
                            <Text style={styles.addPersonnelText}>Add Personnel</Text>
                        </Pressable>
                    ) : null}

                    {!isVendor ? (
                        <View style={styles.card}>
                        <Text style={styles.leaseTitle}>LEASE AGREEMENT</Text>

                        <View style={styles.leaseGrid}>
                            <View style={styles.leaseItem}>
                                <Text style={styles.leaseLabel}>STATUS</Text>
                                <View style={styles.renewedRow}>
                                    <Ionicons
                                        name={leaseAgreement ? 'checkmark-circle' : 'alert-circle-outline'}
                                        size={22}
                            color={leaseAgreement ? colors.success : colors.danger}
                                    />
                                    <Text style={[styles.renewedText, !leaseAgreement ? styles.noLeaseText : null]}>
                                        {isLeaseLoading ? 'LOADING' : leaseAgreement ? 'ACTIVE' : 'NO RECORD'}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.leaseItem}>
                                <Text style={styles.leaseLabel}>LEASE DATE</Text>
                                <Text style={styles.leaseDueDate}>
                                    {isLeaseLoading ? 'Loading...' : formatPlainDate(leaseAgreement?.leaseDate ?? null)}
                                </Text>
                            </View>
                        </View>

                        {leaseAgreement ? (
                            <View style={styles.leaseDetails}>
                                <View style={styles.leaseDetailRow}>
                                    <Text style={styles.leaseDetailLabel}>Business</Text>
                                    <Text style={styles.leaseDetailValue}>{leaseAgreement.businessName}</Text>
                                </View>
                                <View style={styles.leaseDetailRow}>
                                    <Text style={styles.leaseDetailLabel}>Type</Text>
                                    <Text style={styles.leaseDetailValue}>{formatLeaseType(leaseAgreement.businessType)}</Text>
                                </View>
                                <View style={styles.leaseDetailRow}>
                                    <Text style={styles.leaseDetailLabel}>Section</Text>
                                    <Text style={styles.leaseDetailValue}>{leaseAgreement.section}</Text>
                                </View>
                            </View>
                        ) : null}
                        </View>
                    ) : null}
                </ScrollView>
            </View>
        </SafeAreaView>
    );
};

export default Rent;

const baseStyles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#dfe2ec',
    },
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    contentContainer: {
        paddingBottom: 20,
    },
    card: {
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#c8ccd8',
        backgroundColor: '#f4f4f5',
        padding: 14,
        shadowColor: '#000000',
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 4,
        elevation: 3,
        marginBottom: 12,
    },
    stallWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    stallIconBox: {
        width: 72,
        height: 64,
        borderRadius: 12,
        backgroundColor: '#dbe3f4',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stallName: {
        fontSize: 32 / 2,
        fontWeight: '700',
        color: '#2f333b',
    },
    stallNumber: {
        marginTop: -2,
        fontSize: 50 / 2,
        fontWeight: '800',
        color: '#1d232d',
    },
    ownerWrap: {
        position: 'absolute',
        right: 14,
        top: 18,
    },
    ownerName: {
        fontSize: 34 / 2,
        fontWeight: '700',
        color: '#6f737c',
    },
    ownerRole: {
        fontSize: 30 / 2,
        fontWeight: '800',
        color: '#2448a4',
        marginTop: 2,
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 42 / 2,
        fontWeight: '800',
        color: '#252932',
    },
    billingMonthTitle: {
        marginTop: 2,
        fontSize: 14,
        fontWeight: '700',
        color: '#7a7f89',
    },
    unpaidPill: {
        minWidth: 92,
        minHeight: 36,
        maxWidth: 172,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#dc6a61',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
        backgroundColor: '#f6e7e5',
    },
    unpaidText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#d85647',
    },
    paidPill: {
        borderColor: '#4cab53',
        backgroundColor: '#d9f1dc',
    },
    paidText: {
        color: '#2f7a40',
    },
    partialPill: {
        borderColor: '#d59b28',
        backgroundColor: '#fff0c9',
    },
    partialText: {
        color: '#9a6410',
    },
    overduePill: {
        borderColor: '#c4433a',
        backgroundColor: '#f6dfdd',
    },
    billingState: {
        minHeight: 150,
        marginTop: 12,
        borderRadius: 12,
        backgroundColor: '#eef1f7',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        gap: 8,
    },
    billingStateTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#252932',
    },
    billingStateText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#687083',
        textAlign: 'center',
    },
    billingErrorState: {
        minHeight: 160,
        marginTop: 12,
        borderRadius: 12,
        backgroundColor: '#f3e8e7',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
    },
    billingErrorText: {
        marginTop: 8,
        color: '#73403b',
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 12,
        borderRadius: 18,
        backgroundColor: '#315fda',
        paddingHorizontal: 18,
        paddingVertical: 8,
    },
    retryButtonText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '800',
    },
    subLabel: {
        marginTop: 10,
        fontSize: 36 / 2,
        fontWeight: '500',
        color: '#7a7f89',
    },
    totalAmount: {
        marginTop: 4,
        fontSize: 68 / 2,
        fontWeight: '800',
        color: '#2448a4',
    },
    dueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
    },
    dueText: {
        fontSize: 40 / 2,
        fontWeight: '700',
        color: '#313640',
    },
    extraDetailsWrap: {
        marginTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#d4d8e2',
        paddingTop: 12,
    },
    extraDetailsTitle: {
        marginBottom: 8,
        fontSize: 17,
        fontWeight: '800',
        color: '#252932',
    },
    extraDetailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    breakdownRow: {
        minHeight: 34,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#e1e5ee',
    },
    chargeSectionWrap: {
        marginTop: 4,
    },
    chargeSectionTitle: {
        paddingVertical: 7,
        fontSize: 15,
        fontWeight: '800',
        color: '#303846',
    },
    utilityRowLabelWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    utilityPenaltyWrap: {
        marginTop: 6,
        marginBottom: 8,
        marginLeft: 8,
        borderRadius: 10,
        backgroundColor: '#eef2fa',
        paddingHorizontal: 10,
        paddingTop: 10,
    },
    utilityPenaltyTitle: {
        marginBottom: 8,
        fontSize: 15,
        fontWeight: '800',
        color: '#26324e',
    },
    penaltyRow: {
        minHeight: 38,
        paddingVertical: 7,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#dce2ef',
    },
    penaltyLabel: {
        flex: 1,
        fontSize: 13,
        lineHeight: 17,
        fontWeight: '700',
        color: '#566176',
    },
    penaltyAmount: {
        fontSize: 13,
        fontWeight: '800',
        color: '#26324e',
        textAlign: 'right',
    },
    totalUtilityRow: {
        minHeight: 44,
        borderBottomWidth: 0,
        borderTopWidth: 1,
        borderTopColor: '#bdc9e4',
    },
    totalUtilityLabel: {
        fontSize: 14,
        fontWeight: '800',
        color: '#24418c',
    },
    totalUtilityAmount: {
        fontSize: 17,
        fontWeight: '800',
        color: '#2448a4',
    },
    breakdownLabelWrap: {
        flex: 1,
        paddingRight: 12,
    },
    marketFeesWrap: {
        marginTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#d4d8e2',
        paddingTop: 8,
    },
    marketFeesHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingVertical: 6,
    },
    marketFeesTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#252932',
    },
    marketFeesTotal: {
        fontSize: 14,
        fontWeight: '800',
        color: '#252932',
    },
    arrearsMonthWrap: {
        borderBottomWidth: 1,
        borderBottomColor: '#e4e7ed',
        paddingBottom: 6,
    },
    arrearsMarketFeesWrap: {
        marginLeft: 12,
        marginBottom: 6,
        borderLeftWidth: 2,
        borderLeftColor: '#c6d2ef',
        paddingLeft: 10,
    },
    arrearsMarketFeesTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#4c5565',
    },
    arrearsMarketFeesTotal: {
        fontSize: 12,
        fontWeight: '700',
        color: '#7a808e',
    },
    subtotalRow: {
        minHeight: 38,
        borderBottomColor: '#cfd5e3',
        backgroundColor: '#eef1f7',
        paddingHorizontal: 8,
        marginTop: 4,
        borderRadius: 8,
    },
    monthSectionHeader: {
        minHeight: 32,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
        marginBottom: 4,
    },
    focusedBill: {
        backgroundColor: '#e3eafb',
        borderRadius: 8,
        paddingHorizontal: 8,
    },
    monthSectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#252932',
    },
    monthSectionMeta: {
        fontSize: 13,
        fontWeight: '700',
        color: '#7a808e',
    },
    arrearsWrap: {
        marginTop: 10,
    },
    subtotalLabel: {
        fontSize: 16,
        fontWeight: '800',
        color: '#384050',
    },
    subtotalAmount: {
        fontSize: 16,
        fontWeight: '800',
        color: '#2448a4',
    },
    overallRow: {
        minHeight: 42,
        borderBottomWidth: 0,
        backgroundColor: '#dfe7fb',
        paddingHorizontal: 8,
        marginTop: 6,
        borderRadius: 8,
    },
    overallLabel: {
        fontSize: 17,
        fontWeight: '800',
        color: '#1d2430',
    },
    overallAmount: {
        fontSize: 18,
        fontWeight: '800',
        color: '#2448a4',
    },
    extraDetailsLabel: {
        fontSize: 17,
        fontWeight: '700',
        color: '#7b8089',
    },
    extraDetailsAmountRow: {
        marginTop: 6,
    },
    extraDetailsAmount: {
        fontSize: 30 / 2,
        fontWeight: '800',
        color: '#232833',
    },
    extraDetailsNoteRow: {
        marginTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    extraDetailsNote: {
        fontSize: 13,
        fontWeight: '600',
        color: '#7a808e',
    },
    paymentHistoryButton: {
        alignSelf: 'flex-start',
        minHeight: 38,
        marginTop: 14,
        borderRadius: 19,
        borderWidth: 1,
        borderColor: '#8fa5d7',
        backgroundColor: '#eef3ff',
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    paymentHistoryButtonText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#2448a4',
    },
    personnelTitle: {
        marginTop: 10,
        marginBottom: 8,
        fontSize: 50 / 2,
        fontWeight: '800',
        color: '#0d1016',
    },
    personnelCard: {
        marginBottom: 12,
        borderRadius: 28,
        backgroundColor: '#eceef4',
        paddingVertical: 14,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    personnelAvatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#a2a4ac',
        alignItems: 'center',
        justifyContent: 'center',
    },
    personnelTextWrap: {
        flex: 1,
        minWidth: 0,
    },
    personnelName: {
        fontSize: 42 / 2,
        fontWeight: '700',
        color: '#11131a',
    },
    statusPill: {
        alignSelf: 'flex-start',
        marginTop: 5,
        borderRadius: 16,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    statusPillPending: {
        backgroundColor: '#ffe8d4',
    },
    statusPillApproved: {
        backgroundColor: '#d9f1dc',
    },
    statusText: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.4,
    },
    statusTextPending: {
        color: '#c0661b',
    },
    statusTextApproved: {
        color: '#2f7a40',
    },
    addPersonnelButton: {
        alignSelf: 'center',
        minWidth: 190,
        borderRadius: 24,
        backgroundColor: '#1f63e6',
        paddingVertical: 10,
        paddingHorizontal: 26,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    addPersonnelText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffffff',
    },
    leaseTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#252932',
        marginBottom: 10,
    },
    leaseGrid: {
        flexDirection: 'row',
        gap: 10,
    },
    leaseItem: {
        flex: 1,
        borderRadius: 12,
        backgroundColor: '#c6d2ef',
        padding: 10,
        minHeight: 86,
    },
    leaseLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#2e3540',
    },
    renewedRow: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    renewedText: {
        fontSize: 30 / 2,
        fontWeight: '800',
        color: '#3ea547',
    },
    noLeaseText: {
        color: '#d85647',
    },
    leaseDueDate: {
        marginTop: 8,
        fontSize: 40 / 2,
        fontWeight: '800',
        color: '#222833',
    },
    leaseDetails: {
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#d4d8e2',
        paddingTop: 8,
        gap: 6,
    },
    leaseDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    leaseDetailLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#7a808e',
    },
    leaseDetailValue: {
        flex: 1,
        textAlign: 'right',
        fontSize: 14,
        fontWeight: '800',
        color: '#252932',
    },
});
