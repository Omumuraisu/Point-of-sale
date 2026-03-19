import { useCallback, useState } from 'react';
import {
  View,
  FlatList,
  Pressable,
  Text,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { CATEGORY_ITEMS } from './data';
import { CartItem, CategoryType } from '../../lib/types';
import { loadMergedCategories } from './categoriesStore';
import POSHeader from './components/POSHeader';
import ProductsTitle from './components/ProductsTitle';
import CategoryCard from './components/CategoryCard';
import CartSummaryBar from './components/CartSummaryBar';

interface POSProps {
  cartItems?: CartItem[];
  cartCount?: number;
  cartTotal?: string;
}

const POS = ({
  cartItems = [],
  cartCount = 0,
  cartTotal = 'P 00.00',
}: POSProps) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryType[]>(CATEGORY_ITEMS);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const hydrateCategories = async () => {
        const mergedCategories = await loadMergedCategories();

        if (isMounted) {
          setCategories(mergedCategories);
        }
      };

      void hydrateCategories();

      return () => {
        isMounted = false;
      };
    }, []),
  );

  const handleCategoryPress = (item: CategoryType) => {
    router.push({
      pathname: '/category',
      params: {
        categoryId: item.id,
        cart: JSON.stringify(cartItems),
      },
    });
  };

  const handleAddNewProduct = () => {
    router.push('/add-product');
  };

  const handleOpenReceipt = () => {
    router.push({
      pathname: '/receipt',
      params: {
        cart: JSON.stringify(cartItems),
      },
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.container}>
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CategoryCard item={item} onPress={handleCategoryPress} />
          )}
          numColumns={2}
          columnWrapperStyle={styles.columnWrap}
          ListHeaderComponent={
            <>
              <POSHeader />
              <ProductsTitle />
            </>
          }
          ListFooterComponent={
            <View style={styles.footerWrap}>
              <Pressable style={styles.addProductsButton} onPress={handleAddNewProduct}>
                <Text style={styles.addProductsText}>Add New Products</Text>
              </Pressable>
            </View>
          }
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: 86 + Math.max(insets.bottom, 10) },
          ]}
          showsVerticalScrollIndicator={false}
        />
        <CartSummaryBar
          count={cartCount}
          total={cartTotal}
          bottomOffset={0}
          onPress={handleOpenReceipt}
        />
      </View>
    </SafeAreaView>
  );
};

export default POS;

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#dfe2ec',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 12,
    paddingHorizontal: 20,
    gap: 16,
  },
  columnWrap: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  footerWrap: {
    marginTop: 4,
    marginBottom: 10,
  },
  addProductsButton: {
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
  addProductsText: {
    color: '#f3f5fb',
    fontSize: 17,
    fontWeight: '700',
  },
});