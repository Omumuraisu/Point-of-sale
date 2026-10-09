import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatCurrency } from '../../../lib/utils';
import { useTheme, useThemedStyles } from '../../../lib/theme';
import type { SavedProductRecord } from '../productsStore';

interface ProductSearchResultProps {
    product: SavedProductRecord;
    onPress: (product: SavedProductRecord) => void;
    disabled?: boolean;
}

const ProductSearchResult = ({ product, onPress, disabled = false }: ProductSearchResultProps) => {
    const styles = useThemedStyles(baseStyles);
    const { colors } = useTheme();

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Select ${product.name}`}
            style={[styles.row, disabled && styles.disabled]}
            onPress={() => onPress(product)}
            disabled={disabled}
        >
            <View style={styles.iconWrap}>
                <Ionicons name="cube-outline" size={21} color={colors.primary} />
            </View>
            <View style={styles.details}>
                <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
                {product.variant ? <Text style={styles.variant} numberOfLines={1}>{product.variant}</Text> : null}
                <Text style={styles.category} numberOfLines={1}>{product.categoryLabel}</Text>
            </View>
            <View style={styles.priceWrap}>
                <Text style={styles.price}>{formatCurrency(product.pricePerUnit)}</Text>
                <Text style={styles.unit}>per {product.unit}</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
        </Pressable>
    );
};

export default ProductSearchResult;

const baseStyles = StyleSheet.create({
    row: {
        minHeight: 76,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#c8cedc',
        backgroundColor: '#f4f4f5',
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    disabled: {
        opacity: 0.5,
    },
    iconWrap: {
        width: 42,
        height: 42,
        borderRadius: 11,
        backgroundColor: '#dbe4ff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    details: {
        flex: 1,
        minWidth: 0,
    },
    name: {
        fontSize: 16,
        fontWeight: '800',
        color: '#151922',
    },
    variant: {
        marginTop: 1,
        fontSize: 13,
        fontWeight: '600',
        color: '#5f6875',
    },
    category: {
        marginTop: 2,
        fontSize: 12,
        fontWeight: '600',
        color: '#7d818b',
    },
    priceWrap: {
        alignItems: 'flex-end',
    },
    price: {
        fontSize: 14,
        fontWeight: '800',
        color: '#2448a4',
    },
    unit: {
        marginTop: 2,
        fontSize: 11,
        fontWeight: '600',
        color: '#7d818b',
    },
});
