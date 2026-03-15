import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CategoryRow = ({ item, tintColor, onPress }) => (
    <Pressable style={styles.row} onPress={() => onPress(item)}>
        <View style={styles.rowLeft}>
            <View style={styles.thumb}>
                <Ionicons name="cube-outline" size={18} color={tintColor} />
            </View>
            <Text style={[styles.rowLabel, { color: tintColor }]}>{item}</Text>
        </View>
        <Ionicons name="chevron-forward" size={26} color="#8f929c" />
    </Pressable>
);

export default CategoryRow;

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        minHeight: 52,
    },
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    thumb: {
        width: 44,
        height: 44,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#6690ff',
        backgroundColor: '#bdc9eb',
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowLabel: {
        fontSize: 19,
        fontWeight: '700',
    },
});
