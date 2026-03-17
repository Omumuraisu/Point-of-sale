import { Pressable, View, Text, StyleSheet } from 'react-native';

interface CartSummaryBarProps {
    count: number;
    total: string;
    bottomOffset?: number;
    onPress?: () => void;
}

const CartSummaryBar = ({ count, total, bottomOffset = 0, onPress }: CartSummaryBarProps) => (
    <Pressable style={[styles.cartBar, { bottom: bottomOffset }]} onPress={onPress}>
        <View style={styles.cartPill}>
            <Text style={styles.cartPillText}>{count} items in cart</Text>
        </View>
        <Text style={styles.cartTotal}>{total}</Text>
    </Pressable>
);

export default CartSummaryBar;

const styles = StyleSheet.create({
    cartBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 72,
        backgroundColor: '#315bd7',
        paddingHorizontal: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    cartPill: {
        height: 38,
        borderRadius: 19,
        paddingHorizontal: 16,
        backgroundColor: '#6f91ef',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cartPillText: {
        color: '#eff3ff',
        fontSize: 15,
        fontWeight: '700',
    },
    cartTotal: {
        color: '#ffffff',
        fontSize: 19,
        fontWeight: '800',
        letterSpacing: 0.4,
    },
});
