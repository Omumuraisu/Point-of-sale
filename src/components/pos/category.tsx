import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import CategoryRow from './components/CategoryRow';
import CartSummaryBar from './components/CartSummaryBar';

interface CategoryScreenProps {
    categoryLabel: string;
    products: string[];
    tintColor: string;
    onBack: () => void;
    onProductPress: (product: string) => void;
    cartCount?: number;
    cartTotal?: string;
}

const CategoryScreen = ({
    categoryLabel,
    products,
    tintColor,
    onBack,
    onProductPress,
    cartCount = 0,
    cartTotal = 'P 00.00',
}: CategoryScreenProps) => {
    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <Pressable style={styles.backBtn} onPress={onBack}>
                    <Ionicons name="chevron-back" size={22} color="#ffffff" />
                </Pressable>
                <Text style={styles.headerTitle}>Category</Text>
            </View>

            <Text style={[styles.categoryName, { color: tintColor }]}>{categoryLabel}</Text>

            <FlatList
                data={products}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                    <CategoryRow item={item} tintColor={tintColor} onPress={onProductPress} />
                )}
                ListEmptyComponent={(
                    <View style={styles.emptyStateWrap}>
                        <Text style={styles.emptyStateTitle}>No products yet</Text>
                        <Text style={styles.emptyStateText}>
                            Add products to this category from the Add Product screen.
                        </Text>
                    </View>
                )}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />

            <CartSummaryBar count={cartCount} total={cartTotal} />
        </SafeAreaView>
    );
};

export default CategoryScreen;

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#dfe2ec',
    },
    header: {
        height: 58,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 18,
        justifyContent: 'center',
        position: 'relative',
    },
    backBtn: {
        position: 'absolute',
        left: 18,
        width: 30,
        height: 30,
        borderRadius: 6,
        backgroundColor: '#2f58cc',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 34 / 2,
        fontWeight: '800',
        color: '#0f1118',
    },
    categoryName: {
        marginTop: 8,
        marginBottom: 12,
        textAlign: 'center',
        fontSize: 34 / 2,
        fontWeight: '700',
    },
    listContent: {
        paddingHorizontal: 18,
        paddingBottom: 92,
    },
    emptyStateWrap: {
        marginTop: 24,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#cad0de',
        backgroundColor: '#edf1f8',
        paddingHorizontal: 14,
        paddingVertical: 16,
        alignItems: 'center',
    },
    emptyStateTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1f2531',
    },
    emptyStateText: {
        marginTop: 6,
        fontSize: 13,
        fontWeight: '600',
        color: '#6a7282',
        textAlign: 'center',
    },
});
