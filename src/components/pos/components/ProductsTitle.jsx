import { View, Text, StyleSheet } from 'react-native';
import { useThemedStyles } from '../../../lib/theme';

const ProductsTitle = () => {
    const styles = useThemedStyles(baseStyles);
    return (
    <View style={styles.sectionWrap}>
        <Text style={styles.sectionTitle}>My Products</Text>
    </View>
    );
};

export default ProductsTitle;

const baseStyles = StyleSheet.create({
    sectionWrap: {
        marginBottom: 2,
    },
    sectionTitle: {
        fontSize: 21,
        fontWeight: '800',
        color: '#05070d',
    },
});
