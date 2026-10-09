import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  FlatList,
  Pressable,
  Text,
  TextInput,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { CartItem, CategoryType } from '../../lib/types';
import { getProductSyncSummary, loadScopedProducts, ProductSyncSummary, retryAllProductSync, SavedProductRecord, subscribeToProductSyncChanges } from './productsStore';
import { useAuthSession } from '../../lib/authSession';
import POSHeader from './components/POSHeader';
import ProductsTitle from './components/ProductsTitle';
import CategoryCard from './components/CategoryCard';
import CartSummaryBar from './components/CartSummaryBar';
import ProductSearchResult from './components/ProductSearchResult';
import { useBusinessOperatingStatus } from '../../lib/businessOperatingStatus';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { buildListingCategories, buildProductSelectionParams, filterProducts } from './productSearch';

interface POSProps {
  cartItems?: CartItem[];
  cartCount?: number;
  cartTotal?: string;
}

type POSListItem =
  | { kind: 'category'; value: CategoryType }
  | { kind: 'product'; value: SavedProductRecord };

const POS = ({
  cartItems = [],
  cartCount = 0,
  cartTotal = 'P 00.00',
}: POSProps) => {
  const styles = useThemedStyles(baseStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentUser } = useAuthSession();
  const { isOpen, isLoading, error: statusError } = useBusinessOperatingStatus();
  const salesDisabled = isOpen !== true;
  const [categories, setCategories] = useState<CategoryType[]>([]);
  const [products, setProducts] = useState<SavedProductRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncSummary, setSyncSummary] = useState<ProductSyncSummary>({ attempted: 0, synced: 0, failed: 0, pending: 0 });
  const [isRetryingProducts, setIsRetryingProducts] = useState(false);

  const refreshProducts = useCallback(async () => {
    if (!currentUser?.stallNumber) {
      setCategories([]);
      setProducts([]);
      setSyncSummary({ attempted: 0, synced: 0, failed: 0, pending: 0 });
      return;
    }
    const scope = { accountId: currentUser.accountId, stallNumber: currentUser.stallNumber };
    const [mergedProducts, summary] = await Promise.all([
      loadScopedProducts(scope),
      getProductSyncSummary(scope),
    ]);
    setProducts(mergedProducts);
    setCategories(buildListingCategories(mergedProducts));
    setSyncSummary(summary);
  }, [currentUser?.accountId, currentUser?.stallNumber]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const hydrateCategories = async () => { if (isMounted) await refreshProducts(); };

      void hydrateCategories();

      return () => {
        isMounted = false;
      };
    }, [refreshProducts]),
  );

  useEffect(() => subscribeToProductSyncChanges(() => { void refreshProducts(); }), [refreshProducts]);

  const retryProductChanges = async () => {
    if (!currentUser?.stallNumber || isRetryingProducts) return;
    setIsRetryingProducts(true);
    try {
      await retryAllProductSync({ accountId: currentUser.accountId, stallNumber: currentUser.stallNumber });
      await refreshProducts();
    } finally {
      setIsRetryingProducts(false);
    }
  };

  const handleCategoryPress = (item: CategoryType) => {
    if (salesDisabled) return;
    router.push({
      pathname: '/category',
      params: {
        categoryId: item.id,
        cart: JSON.stringify(cartItems),
      },
    });
  };

  const handleAddNewProduct = () => {
    if (salesDisabled) return;
    router.push('/add-product');
  };

  const handleProductPress = (product: SavedProductRecord) => {
    if (salesDisabled) return;
    router.push({
      pathname: '/add-item',
      params: buildProductSelectionParams(product, cartItems),
    });
  };

  const handleOpenReceipt = () => {
    if (salesDisabled) return;
    router.push({
      pathname: '/receipt',
      params: {
        cart: JSON.stringify(cartItems),
      },
    });
  };

  const normalizedSearchQuery = searchQuery.trim();
  const isSearching = normalizedSearchQuery.length > 0;
  const matchingProducts = useMemo(
    () => filterProducts(products, normalizedSearchQuery),
    [normalizedSearchQuery, products],
  );
  const listItems = useMemo<POSListItem[]>(() => (
    isSearching
      ? matchingProducts.map((product) => ({ kind: 'product', value: product }))
      : categories.map((category) => ({ kind: 'category', value: category }))
  ), [categories, isSearching, matchingProducts]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.container}>
        <FlatList
          key={isSearching ? 'product-results' : 'category-grid'}
          data={listItems}
          keyExtractor={(item) => `${item.kind}:${item.value.id}`}
          renderItem={({ item }) => item.kind === 'category' ? (
            <CategoryCard item={item.value} onPress={handleCategoryPress} disabled={salesDisabled} />
          ) : (
            <ProductSearchResult product={item.value} onPress={handleProductPress} disabled={salesDisabled} />
          )}
          numColumns={isSearching ? 1 : 2}
          columnWrapperStyle={isSearching ? undefined : styles.columnWrap}
          ListHeaderComponent={
            <>
              <POSHeader />
              {salesDisabled ? (
                <View style={styles.closedBanner}>
                  <Text style={styles.closedBannerTitle}>{isLoading ? 'Checking stall status...' : 'Stall Closed'}</Text>
                  <Text style={styles.closedBannerText}>
                    {statusError ?? 'Open the stall before starting a sale.'}
                  </Text>
                </View>
              ) : null}
              {syncSummary.failed + syncSummary.pending > 0 ? (
                <View style={styles.syncBanner}>
                  <View style={styles.syncBannerTextWrap}>
                    <Text style={styles.syncBannerTitle}>Product changes not synced</Text>
                    <Text style={styles.syncBannerText}>
                      {syncSummary.failed + syncSummary.pending} change{syncSummary.failed + syncSummary.pending === 1 ? '' : 's'} waiting for the server.
                    </Text>
                  </View>
                  <Pressable style={styles.syncRetryButton} onPress={retryProductChanges} disabled={isRetryingProducts}>
                    <Text style={styles.syncRetryText}>{isRetryingProducts ? 'Retrying...' : 'Retry All'}</Text>
                  </Pressable>
                </View>
              ) : null}
              <ProductsTitle />
              <View style={styles.searchWrap}>
                <Ionicons name="search" size={20} color={colors.textMuted} />
                <TextInput
                  accessibilityLabel="Search products"
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search products"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear product search"
                    style={styles.clearSearchButton}
                    onPress={() => setSearchQuery('')}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
            </>
          }
          ListEmptyComponent={isSearching ? (
            <View style={styles.emptySearchWrap}>
              <Ionicons name="search-outline" size={36} color={colors.textMuted} />
              <Text style={styles.emptySearchTitle}>No matching products</Text>
              <Text style={styles.emptySearchText}>Try another product, variant, or category name.</Text>
            </View>
          ) : null}
          ListFooterComponent={
            <View style={styles.footerWrap}>
              <Pressable style={[styles.addProductsButton, salesDisabled && styles.disabledButton]} onPress={handleAddNewProduct} disabled={salesDisabled}>
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
          disabled={salesDisabled}
        />
      </View>
    </SafeAreaView>
  );
};

export default POS;

// ── Styles ────────────────────────────────────────────────────────

const baseStyles = StyleSheet.create({
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
  searchWrap: {
    marginTop: 10,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c8cedc',
    backgroundColor: '#f4f4f5',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
    color: '#151922',
  },
  clearSearchButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySearchWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#c8cedc',
    backgroundColor: '#edf1f8',
    paddingHorizontal: 18,
    paddingVertical: 28,
    alignItems: 'center',
    marginBottom: 8,
  },
  emptySearchTitle: {
    marginTop: 9,
    fontSize: 17,
    fontWeight: '800',
    color: '#151922',
  },
  emptySearchText: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: '#6a7282',
    textAlign: 'center',
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
  disabledButton: {
    opacity: 0.5,
  },
  closedBanner: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2a39e',
    backgroundColor: '#fde8e6',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  closedBannerTitle: {
    color: '#8f302a',
    fontSize: 16,
    fontWeight: '800',
  },
  closedBannerText: {
    marginTop: 3,
    color: '#7c443f',
    fontSize: 13,
    fontWeight: '600',
  },
  syncBanner: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d2a64c',
    backgroundColor: '#fff5d9',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  syncBannerTextWrap: { flex: 1 },
  syncBannerTitle: { color: '#75530d', fontSize: 15, fontWeight: '800' },
  syncBannerText: { marginTop: 3, color: '#806523', fontSize: 13, fontWeight: '600' },
  syncRetryButton: { borderRadius: 8, backgroundColor: '#9a6b0d', paddingHorizontal: 12, paddingVertical: 9 },
  syncRetryText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
});
