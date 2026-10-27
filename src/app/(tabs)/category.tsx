import { useCallback, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import CategoryScreen from '../../components/pos/category';
import { getCanonicalCategoryLabel, getCategoryById, getCategoryByLabel } from '../../components/pos/data';
import { loadCachedScopedProducts, loadScopedProducts, ProductCatalogItem, SavedProductRecord } from '../../components/pos/productsStore';
import { CategoryType } from '../../lib/types';
import { formatCurrency, parseCart } from '../../lib/utils';
import { buildListingCategories, filterProductsByCategoryLabel } from '../../components/pos/productSearch';
import { useAuthSession } from '../../lib/authSession';
import { useBusinessOperatingStatus } from '../../lib/businessOperatingStatus';

const CategoryRoute = () => {
  const router = useRouter();
  const { currentUser } = useAuthSession();
  const { isOpen } = useBusinessOperatingStatus();
  const { categoryId, categoryLabel, cart } = useLocalSearchParams();

  const [categories, setCategories] = useState<CategoryType[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<ProductCatalogItem[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const refreshGeneration = useRef(0);
  const activeProductScope = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const generation = ++refreshGeneration.current;

      const hydrateCategoryContext = async () => {
        const scope = currentUser?.stallNumber && currentUser.businessId
          ? { accountId: currentUser.accountId, businessId: currentUser.businessId, stallNumber: currentUser.stallNumber }
          : null;
        const scopeKey = scope ? `${scope.accountId}:${scope.businessId}:${scope.stallNumber}` : null;
        if (activeProductScope.current !== scopeKey) {
          activeProductScope.current = scopeKey;
          setCategories([]);
          setCatalogProducts([]);
          setProducts([]);
          setIsProductsLoading(Boolean(scope));
        }
        if (!scope) {
          if (isMounted && generation === refreshGeneration.current) {
            setCategories([]);
            setCatalogProducts([]);
            setProducts([]);
            setIsProductsLoading(false);
          }
          return;
        }

        const applySnapshot = (snapshot: SavedProductRecord[]) => {
          if (!isMounted || generation !== refreshGeneration.current) return;
          const snapshotCategories = buildListingCategories(snapshot);
          const selectedCategory = typeof categoryId === 'string'
            ? getCategoryById(categoryId, snapshotCategories)
            : undefined;
          const requestedCategory = typeof categoryLabel === 'string'
            ? getCanonicalCategoryLabel(categoryLabel)
            : selectedCategory?.label;
          const matchingProducts = requestedCategory
            ? filterProductsByCategoryLabel(snapshot, requestedCategory)
            : [];
          setCategories(snapshotCategories);
          setCatalogProducts(matchingProducts);
          setProducts(matchingProducts.map((product) => product.variant ? `${product.name} — ${product.variant}` : product.name));
        };

        setIsProductsLoading(true);
        const cachedProducts = await loadCachedScopedProducts(scope);
        if (cachedProducts.length > 0) {
          applySnapshot(cachedProducts);
          if (isMounted && generation === refreshGeneration.current) setIsProductsLoading(false);
        }

        const refreshedProducts = await loadScopedProducts(scope);
        applySnapshot(refreshedProducts);
        if (isMounted && generation === refreshGeneration.current) setIsProductsLoading(false);
      };

      void hydrateCategoryContext();

      return () => {
        isMounted = false;
        refreshGeneration.current += 1;
      };
    }, [categoryId, categoryLabel, currentUser?.accountId, currentUser?.businessId, currentUser?.stallNumber]),
  );

  const selectedCategory = typeof categoryId === 'string'
    ? getCategoryById(categoryId, categories)
    : undefined;
  const resolvedCategory = selectedCategory ?? (typeof categoryLabel === 'string'
    ? getCategoryByLabel(categories, categoryLabel)
    : undefined);

  const cartItems = useMemo(
    () => parseCart(typeof cart === 'string' ? cart : ''),
    [cart],
  );
  const cartTotalValue = cartItems.reduce(
    (sum, item) => sum + (Number.isFinite(item?.total) ? item.total : 0),
    0,
  );

  const handleBack = useCallback(() => {
    router.replace({
      pathname: '/pos',
      params: { cart: JSON.stringify(cartItems) },
    });
  }, [cartItems, router]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBack();
        return true;
      });
      return () => subscription.remove();
    }, [handleBack]),
  );

  const handleProductPress = (product: string) => {
    if (isOpen !== true) {
      Alert.alert('Stall closed', 'Open the stall before starting a sale.');
      return;
    }
    const catalogProduct = catalogProducts.find((item) => (
      (item.variant ? `${item.name} — ${item.variant}` : item.name).trim().toLowerCase() === product.trim().toLowerCase()
    ));
    if (!catalogProduct) return;

    router.push({
      pathname: '/add-item',
      params: {
        categoryId: catalogProduct.categoryId,
        categoryLabel: resolvedCategory?.label ?? getCanonicalCategoryLabel(catalogProduct.categoryLabel),
        productId: catalogProduct.id,
        catalogProductId: catalogProduct.catalogProductId || '',
        productName: product,
        pricePerUnit: catalogProduct.pricePerUnit.toString(),
        unit: catalogProduct.unit,
        cart: JSON.stringify(cartItems),
      },
    });
  };

  return (
    <CategoryScreen
      categoryLabel={resolvedCategory?.label || 'Category'}
      tintColor={resolvedCategory?.textColor || '#3a3f4a'}
      products={products}
      isLoading={isProductsLoading}
      onBack={handleBack}
      onProductPress={handleProductPress}
      cartCount={cartItems.length}
      cartTotal={formatCurrency(cartTotalValue)}
      isStallOpen={isOpen === true}
    />
  );
};

export default CategoryRoute;
