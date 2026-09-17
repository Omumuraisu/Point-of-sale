import { useCallback, useEffect, useState } from 'react';
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
import { CartItem, CategoryType } from '../../lib/types';
import { getProductSyncSummary, loadListingCategories, ProductSyncSummary, retryAllProductSync, subscribeToProductSyncChanges } from './productsStore';
import { useAuthSession } from '../../lib/authSession';
import POSHeader from './components/POSHeader';
import ProductsTitle from './components/ProductsTitle';
import CategoryCard from './components/CategoryCard';
import CartSummaryBar from './components/CartSummaryBar';
import { useBusinessOperatingStatus } from '../../lib/businessOperatingStatus';

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
  const { currentUser } = useAuthSession();
  const { isOpen, isLoading, error: statusError } = useBusinessOperatingStatus();
  const salesDisabled = isOpen !== true;
  const [categories, setCategories] = useState<CategoryType[]>([]);
  const [syncSummary, setSyncSummary] = useState<ProductSyncSummary>({ attempted: 0, synced: 0, failed: 0, pending: 0 });
  const [isRetryingProducts, setIsRetryingProducts] = useState(false);

  const refreshProducts = useCallback(async () => {
    if (!currentUser?.stallNumber) {
      setCategories([]);
      setSyncSummary({ attempted: 0, synced: 0, failed: 0, pending: 0 });
      return;
    }
    const scope = { accountId: currentUser.accountId, stallNumber: currentUser.stallNumber };
    const [mergedCategories, summary] = await Promise.all([
      loadListingCategories(scope),
      getProductSyncSummary(scope),
    ]);
    setCategories(mergedCategories);
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

  const handleOpenReceipt = () => {
    if (salesDisabled) return;
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
            <CategoryCard item={item} onPress={handleCategoryPress} disabled={salesDisabled} />
          )}
          numColumns={2}
          columnWrapperStyle={styles.columnWrap}
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
            </>
          }
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
