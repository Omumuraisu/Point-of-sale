import { View, Text, StyleSheet } from 'react-native';

const ProductsTitle = () => (
    <View style={styles.sectionWrap}>
        <Text style={styles.sectionTitle}>Products</Text>
    </View>
);

export default ProductsTitle;

const styles = StyleSheet.create({
    sectionWrap: {
        marginBottom: 2,
    },
    sectionTitle: {
        fontSize: 21,
        fontWeight: '800',
        color: '#05070d',
    },
});
