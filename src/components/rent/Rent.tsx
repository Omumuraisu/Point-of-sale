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
import { loadPersonnelRecords, PersonnelRecord } from './personnelStore';

const DEFAULT_PERSONNEL: PersonnelRecord[] = [
    {
        id: 'personnel-juan',
        firstName: 'Juan',
        lastName: 'Dela Cruz',
        birthday: '',
        address: '',
        phoneNumber: '',
        email: '',
        status: 'approved',
        createdAt: 0,
    },
];

const Rent = () => {
    const router = useRouter();
    const [isDueDetailsExpanded, setDueDetailsExpanded] = useState(false);
    const [personnelRecords, setPersonnelRecords] = useState<PersonnelRecord[]>([]);

    useEffect(() => {
        if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
            UIManager.setLayoutAnimationEnabledExperimental(true);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            const loadPersonnel = async () => {
                const saved = await loadPersonnelRecords();

                if (isActive) {
                    setPersonnelRecords(saved);
                }
            };

            loadPersonnel();

            return () => {
                isActive = false;
            };
        }, [])
    );

    const handleToggleDueDetails = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setDueDetailsExpanded((previous) => !previous);
    };

    const handleAddPersonnel = () => {
        router.push({ pathname: 'add-personnel' });
    };

    const personnelList = [...DEFAULT_PERSONNEL, ...personnelRecords];

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
                                <Text style={styles.stallNumber}>#42</Text>
                            </View>
                        </View>

                        <View style={styles.ownerWrap}>
                            <Text style={styles.ownerName}>Mika Bini</Text>
                            <Text style={styles.ownerRole}>STALL OWNER</Text>
                        </View>
                    </View>

                    <View style={styles.card}>
                        <View style={styles.rowBetween}>
                            <Text style={styles.sectionTitle}>Rent Status</Text>
                            <View style={styles.unpaidPill}>
                                <Text style={styles.unpaidText}>UNPAID</Text>
                            </View>
                        </View>

                        <Text style={styles.subLabel}>Total Amount Due</Text>
                        <Text style={styles.totalAmount}>P 1,500.00</Text>

                        <Pressable
                            style={styles.rowBetween}
                            onPress={handleToggleDueDetails}
                        >
                            <View style={styles.dueRow}>
                                <Ionicons name="calendar-outline" size={20} color="#2f5ada" />
                                <Text style={styles.dueText}>Due: March 24, 2026</Text>
                            </View>
                            <Ionicons
                                name={isDueDetailsExpanded ? 'chevron-up' : 'chevron-down'}
                                size={22}
                                color="#8d919a"
                            />
                        </Pressable>

                        {isDueDetailsExpanded ? (
                            <View style={styles.extraDetailsWrap}>
                                <View style={styles.extraDetailsRow}>
                                    <Text style={styles.extraDetailsLabel}>Last Month</Text>
                                    <Text style={styles.extraDetailsLabel}>This Month</Text>
                                </View>
                                <View style={[styles.extraDetailsRow, styles.extraDetailsAmountRow]}>
                                    <Text style={styles.extraDetailsAmount}>P 0.00</Text>
                                    <Text style={styles.extraDetailsAmount}>P 1,500.00</Text>
                                </View>
                                <View style={[styles.extraDetailsRow, styles.violationsRow]}>
                                    <Text style={styles.extraDetailsLabel}>Violations</Text>
                                    <Text style={styles.violationsValue}>0</Text>
                                </View>
                                <View style={styles.extraDetailsNoteRow}>
                                    <Ionicons name="document-text-outline" size={18} color="#7a808e" />
                                    <Text style={styles.extraDetailsNote}>Penalty starts after due date.</Text>
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
                            <View style={styles.personnelCard} key={personnel.id}>
                                <View style={styles.personnelAvatar}>
                                    <Ionicons name="person" size={24} color="#ffffff" />
                                </View>
                                <Text style={styles.personnelName}>{fullName || 'Unnamed'}</Text>
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
                        );
                    })}

                    <Pressable
                        style={styles.addPersonnelButton}
                        onPress={handleAddPersonnel}
                    >
                        <Text style={styles.addPersonnelText}>Add Personnel</Text>
                    </Pressable>

                    <View style={styles.card}>
                        <Text style={styles.leaseTitle}>LEASE AGREEMENT</Text>

                        <View style={styles.leaseGrid}>
                            <View style={styles.leaseItem}>
                                <Text style={styles.leaseLabel}>STATUS</Text>
                                <View style={styles.renewedRow}>
                                    <Ionicons name="checkmark-circle" size={22} color="#4cab53" />
                                    <Text style={styles.renewedText}>RENEWED</Text>
                                </View>
                            </View>

                            <View style={styles.leaseItem}>
                                <Text style={styles.leaseLabel}>DUE DATE</Text>
                                <Text style={styles.leaseDueDate}>June 2030</Text>
                            </View>
                        </View>
                    </View>
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
    extraDetailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
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
    violationsRow: {
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#e1e5ee',
        paddingTop: 10,
    },
    violationsValue: {
        fontSize: 18,
        fontWeight: '800',
        color: '#2f5ada',
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
    personnelName: {
        fontSize: 42 / 2,
        fontWeight: '700',
        color: '#11131a',
        flexShrink: 1,
    },
    statusPill: {
        marginLeft: 'auto',
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
    leaseDueDate: {
        marginTop: 8,
        fontSize: 40 / 2,
        fontWeight: '800',
        color: '#222833',
    },
});
