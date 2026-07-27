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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import POSHeader from '../pos/components/POSHeader';
import { loadVendorApplications, PersonnelRecord } from './personnelStore';
import { useAuthSession } from '../../lib/authSession';
import { fetchBillingSummary, BillingSummary } from '../../lib/billing';
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

const Rent = () => {
    const router = useRouter();
    const { currentUser } = useAuthSession();
    const [isDueDetailsExpanded, setDueDetailsExpanded] = useState(false);
    const [personnelRecords, setPersonnelRecords] = useState<PersonnelRecord[]>([]);
    const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(null);
    const [leaseAgreement, setLeaseAgreement] = useState<BusinessLeaseAgreement | null>(null);
    const [isBillingLoading, setBillingLoading] = useState(true);
    const isVendor = currentUser?.profileTable === 'vendor';

    useEffect(() => {
        if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
            UIManager.setLayoutAnimationEnabledExperimental(true);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            const loadPersonnel = async () => {
                const [saved, summary, lease] = await Promise.all([
                    loadVendorApplications(currentUser?.businessOwnerId),
                    fetchBillingSummary(currentUser?.businessId, currentUser?.stallNumber),
                    isVendor
                        ? Promise.resolve(null)
                        : fetchBusinessLeaseAgreement(currentUser?.businessId, currentUser?.businessOwnerId),
                ]);

                if (isActive) {
                    setPersonnelRecords(saved);
                    setBillingSummary(summary);
                    setLeaseAgreement(lease);
                    setBillingLoading(false);
                }
            };

            setBillingLoading(true);
            setDueDetailsExpanded(false);
            loadPersonnel();

            return () => {
                isActive = false;
            };
        }, [currentUser?.businessId, currentUser?.businessOwnerId, currentUser?.stallNumber, isVendor])
    );

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

    const personnelList = isVendor
        ? personnelRecords.filter((personnel) => personnel.accountId !== currentUser?.accountId)
        : personnelRecords;
    const stallNumber = currentUser?.stallNumber ?? 'Not assigned';
    const billingStatus = billingSummary?.status ?? 'UNPAID';
    const billingStatusIsPaid = billingStatus === 'PAID';
    const totalAmount = isBillingLoading
        ? 'Loading...'
        : formatCurrency(billingSummary?.totalAmount ?? 0);
    const amountLabel = billingStatusIsPaid ? 'Total Amount Paid' : 'Total Amount Due';
    const billingDateLabel = billingSummary
        ? isVendor
            ? `Due: ${formatDate(billingSummary.dueDate)}`
            : billingStatusIsPaid
                ? `Paid: ${formatDate(billingSummary.paidAt)}`
                : `Due: ${formatDate(billingSummary.dueDate)}`
        : 'No billing record yet';
    const billingDateIcon = isVendor
        ? 'calendar-outline'
        : billingStatusIsPaid
            ? 'checkmark-circle-outline'
            : 'calendar-outline';
    const billBreakdown = billingSummary
        ? [
            { label: 'Rent', amount: billingSummary.rentAmount },
            { label: 'Electricity', amount: billingSummary.electricityAmount },
            { label: 'Water', amount: billingSummary.waterAmount },
            ...(billingSummary.violationsAmount > 0
                ? [{ label: 'Violations', amount: billingSummary.violationsAmount }]
                : []),
        ]
        : [];

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
                                <MaterialCommunityIcons name="storefront-outline" size={34} color="#2448a4" />
                            </View>
                            <View>
                                <Text style={styles.stallName}>Stall</Text>
                                <Text style={styles.stallNumber}>{stallNumber}</Text>
                            </View>
                        </View>

                        <View style={styles.ownerWrap}>
                            <Text style={styles.ownerName}>{currentUser?.displayName ?? 'Loading...'}</Text>
                            <Text style={styles.ownerRole}>{isVendor ? 'STALL VENDOR' : 'STALL OWNER'}</Text>
                        </View>
                    </View>

                    <View style={styles.card}>
                        <View style={styles.rowBetween}>
                            <View>
                                <Text style={styles.sectionTitle}>Billing Status</Text>
                                {!isVendor ? (
                                    <Text style={styles.billingMonthTitle}>
                                        {isBillingLoading ? 'Loading bill...' : formatBillingMonth(billingSummary?.billingMonth ?? null)}
                                    </Text>
                                ) : null}
                            </View>
                            <View style={[styles.unpaidPill, billingStatusIsPaid ? styles.paidPill : null]}>
                                <Text style={[styles.unpaidText, billingStatusIsPaid ? styles.paidText : null]}>
                                    {isBillingLoading ? 'LOADING' : billingStatus}
                                </Text>
                            </View>
                        </View>

                        <Text style={styles.subLabel}>{amountLabel}</Text>
                        <Text style={styles.totalAmount}>{totalAmount}</Text>

                        <Pressable
                            style={styles.rowBetween}
                            disabled={isVendor}
                            onPress={isVendor ? undefined : handleToggleDueDetails}
                        >
                            <View style={styles.dueRow}>
                                <Ionicons name={billingDateIcon} size={20} color="#2f5ada" />
                                <Text style={styles.dueText}>{billingDateLabel}</Text>
                            </View>
                            {!isVendor ? (
                                <Ionicons
                                    name={isDueDetailsExpanded ? 'chevron-up' : 'chevron-down'}
                                    size={22}
                                    color="#8d919a"
                                />
                            ) : null}
                        </Pressable>

                        {!isVendor && isDueDetailsExpanded ? (
                            <View style={styles.extraDetailsWrap}>
                                <Text style={styles.extraDetailsTitle}>Bill Summary</Text>
                                {billBreakdown.length > 0 ? (
                                    <>
                                        <View style={styles.monthSectionHeader}>
                                            <Text style={styles.monthSectionTitle}>Current Bill</Text>
                                            <Text style={styles.monthSectionMeta}>
                                                {formatBillingMonthLabel(billingSummary?.currentBill?.billingMonth ?? null)}
                                            </Text>
                                        </View>
                                        {billBreakdown.map((item) => (
                                            <View style={styles.breakdownRow} key={item.label}>
                                                <Text style={styles.extraDetailsLabel}>{item.label}</Text>
                                                <Text style={styles.extraDetailsAmount}>{formatCurrency(item.amount)}</Text>
                                            </View>
                                        ))}
                                        <View style={[styles.breakdownRow, styles.subtotalRow]}>
                                            <Text style={styles.subtotalLabel}>Current Period Subtotal</Text>
                                            <Text style={styles.subtotalAmount}>
                                                {formatCurrency(billingSummary?.currentBill?.totalAmount ?? 0)}
                                            </Text>
                                        </View>
                                        {billingSummary?.arrearsMonths.length ? (
                                            <View style={styles.arrearsWrap}>
                                                <View style={styles.monthSectionHeader}>
                                                    <Text style={styles.monthSectionTitle}>Arrears</Text>
                                                    <Text style={styles.monthSectionMeta}>Previous Balance</Text>
                                                </View>
                                                {billingSummary.arrearsMonths.map((month) => (
                                                    <View style={styles.breakdownRow} key={month.billingMonth ?? 'unassigned'}>
                                                        <Text style={styles.extraDetailsLabel}>
                                                            {formatBillingMonthLabel(month.billingMonth)}
                                                        </Text>
                                                        <Text style={styles.extraDetailsAmount}>
                                                            {formatCurrency(month.unpaidAmount)}
                                                        </Text>
                                                    </View>
                                                ))}
                                                <View style={[styles.breakdownRow, styles.subtotalRow]}>
                                                    <Text style={styles.subtotalLabel}>Arrears Subtotal</Text>
                                                    <Text style={styles.subtotalAmount}>
                                                        {formatCurrency(billingSummary.arrearsAmount)}
                                                    </Text>
                                                </View>
                                            </View>
                                        ) : null}
                                        <View style={[styles.breakdownRow, styles.overallRow]}>
                                            <Text style={styles.overallLabel}>
                                                {billingStatusIsPaid ? 'Overall Total Paid' : 'Total Due'}
                                            </Text>
                                            <Text style={styles.overallAmount}>
                                                {formatCurrency(billingSummary?.totalAmount ?? 0)}
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
                                    <Ionicons name="document-text-outline" size={18} color="#7a808e" />
                                    <Text style={styles.extraDetailsNote}>
                                        {billingSummary
                                            ? billingStatusIsPaid
                                                ? 'Payment has been recorded.'
                                                : 'Penalty starts after due date.'
                                            : 'Billing details will appear once submitted.'}
                                    </Text>
                                </View>
                            </View>
                        ) : null}
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
                                    <Ionicons name="chevron-forward" size={20} color="#7a808e" />
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
                                        color={leaseAgreement ? '#4cab53' : '#d85647'}
                                    />
                                    <Text style={[styles.renewedText, !leaseAgreement ? styles.noLeaseText : null]}>
                                        {isBillingLoading ? 'LOADING' : leaseAgreement ? 'ACTIVE' : 'NO RECORD'}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.leaseItem}>
                                <Text style={styles.leaseLabel}>LEASE DATE</Text>
                                <Text style={styles.leaseDueDate}>
                                    {isBillingLoading ? 'Loading...' : formatPlainDate(leaseAgreement?.leaseDate ?? null)}
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
                                    <Text style={styles.leaseDetailValue}>{leaseAgreement.businessType}</Text>
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
        height: 36,
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#e1e5ee',
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
