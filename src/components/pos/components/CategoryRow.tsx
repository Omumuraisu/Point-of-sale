import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../../../lib/theme';

interface CategoryRowProps {
    item: string;
    tintColor: string;
    onPress: (item: string) => void;
    disabled?: boolean;
}

const CategoryRow = ({ item, tintColor, onPress, disabled = false }: CategoryRowProps) => {
    const styles = useThemedStyles(baseStyles);
    const { resolvePalette, resolveTextColor, colors } = useTheme();
    const resolvedTint = resolveTextColor(tintColor, colors.background);
    const thumbPalette = resolvePalette({
        backgroundColor: '#bdc9eb',
        borderColor: '#6690ff',
        textColor: tintColor,
        iconColor: tintColor,
    });
    return (
    <Pressable style={[styles.row, disabled && styles.disabled]} onPress={() => onPress(item)} disabled={disabled}>
        <View style={styles.rowLeft}>
            <View style={[styles.thumb, { backgroundColor: thumbPalette.backgroundColor, borderColor: thumbPalette.borderColor }]}>
                <Ionicons name="cube-outline" size={18} color={thumbPalette.iconColor ?? thumbPalette.textColor} />
            </View>
            <Text style={[styles.rowLabel, { color: resolvedTint }]}>{item}</Text>
        </View>
        <Ionicons name="chevron-forward" size={26} color={colors.textMuted} />
    </Pressable>
    );
};

export default CategoryRow;

const baseStyles = StyleSheet.create({
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
    disabled: {
        opacity: 0.45,
    },
});
