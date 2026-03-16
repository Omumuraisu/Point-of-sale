import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import POSHeader from '../pos/components/POSHeader';

const Rent = () => {
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

                        <View style={styles.rowBetween}>
                            <View style={styles.dueRow}>
                                <Ionicons name="calendar-outline" size={20} color="#2f5ada" />
                                <Text style={styles.dueText}>Due: March 24, 2026</Text>
                            </View>
                            <Ionicons name="chevron-down" size={22} color="#8d919a" />
                        </View>
                    </View>

                    <Text style={styles.personnelTitle}>Other Personnel</Text>

                    <View style={styles.personnelCard}>
                        <View style={styles.personnelAvatar}>
                            <Ionicons name="person" size={24} color="#ffffff" />
                        </View>
                        <Text style={styles.personnelName}>Juan Dela Cruz</Text>
                    </View>

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
