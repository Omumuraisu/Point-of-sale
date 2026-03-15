import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const BottomActionsBar = ({ onPress, bottomInset }) => (
    <View style={[styles.ctaWrap, { paddingBottom: Math.max(bottomInset, 10) }]}>
        <TouchableOpacity style={styles.ctaButton} onPress={onPress}>
            <Text style={styles.ctaText}>Add New Products</Text>
        </TouchableOpacity>
    </View>
);

export default BottomActionsBar;

const styles = StyleSheet.create({
    ctaWrap: {
        position: 'absolute',
        left: 20,
        right: 20,
        bottom: 0,
    },
    ctaButton: {
        backgroundColor: '#2846a5',
        height: 56,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000000',
        shadowOpacity: 0.15,
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 4,
        elevation: 3,
    },
    ctaText: {
        color: '#f3f5fb',
        fontSize: 17,
        fontWeight: '700',
    },
});
