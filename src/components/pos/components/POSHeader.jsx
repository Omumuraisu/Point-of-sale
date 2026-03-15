import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const POSHeader = () => (
    <View style={styles.headerRow}>
        <View style={styles.profileGroup}>
            <View style={styles.avatarCircle}>
                <Ionicons name="person" size={26} color="#40444f" />
            </View>
            <View>
                <Text style={styles.profileName}>Mika Bini</Text>
                <Text style={styles.profileDate}>Mon, Feb 6, 2026</Text>
            </View>
        </View>
        <View style={styles.headerActions}>
            <TouchableOpacity style={styles.actionBtn}>
                <Ionicons name="notifications" size={20} color="#f0cc42" />
                <View style={styles.badgeDot} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.primaryActionBtn]}>
                <MaterialCommunityIcons name="cash-register" size={20} color="#ffffff" />
            </TouchableOpacity>
        </View>
    </View>
);

export default POSHeader;

const styles = StyleSheet.create({
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    profileGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatarCircle: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#eef0f5',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#c3c8d8',
    },
    profileName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f1014',
    },
    profileDate: {
        marginTop: 2,
        fontSize: 12,
        color: '#212328',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 10,
    },
    actionBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#f3f3f3',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#d3d7e1',
        position: 'relative',
    },
    primaryActionBtn: {
        backgroundColor: '#305ddf',
        borderColor: '#305ddf',
    },
    badgeDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#d95b57',
        position: 'absolute',
        top: 4,
        right: 4,
        borderWidth: 1,
        borderColor: '#f3f3f3',
    },
});
