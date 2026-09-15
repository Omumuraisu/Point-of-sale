import { useCallback, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import CategoryScreen from '../../components/pos/category';
import { getCategoryById } from '../../components/pos/data';
import { ProductCatalogItem, loadMergedProductsByCategory } from '../../components/pos/productsStore';
import { CategoryType } from '../../lib/types';
import { formatCurrency, parseCart } from '../../lib/utils';
import { loadListingCategories } from '../../components/pos/productsStore';
import { useAuthSession } from '../../lib/authSession';
import { useBusinessOperatingStatus } from '../../lib/businessOperatingStatus';

const CategoryRoute = () => {
  const router = useRouter();
  const { currentUser } = useAuthSession();
  const { isOpen } = useBusinessOperatingStatus();
  const { categoryId, cart } = useLocalSearchParams();

  const [categories, setCategories] = useState<CategoryType[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<ProductCatalogItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const hydrateCategoryContext = async () => {
        const scope = currentUser?.stallNumber ? { accountId: currentUser.accountId, stallNumber: currentUser.stallNumber } : null;
        const mergedCategories = scope ? await loadListingCategories(scope) : [];
        const selectedCategory = typeof categoryId === 'string'
          ? getCategoryById(categoryId, mergedCategories)
          : undefined;
        const mergedProducts = typeof categoryId === 'string'
          ? (scope ? await loadMergedProductsByCategory(scope, categoryId) : [])
          : [];

        if (isMounted) {
          setCategories(mergedCategories);
          setCatalogProducts(mergedProducts);
          setProducts(mergedProducts.map((product) => product.variant ? `${product.name} — ${product.variant}` : product.name));
        }
      };

      void hydrateCategoryContext();

      return () => {
        isMounted = false;
      };
    }, [categoryId, currentUser?.accountId, currentUser?.stallNumber]),
  );

  const selectedCategory =
    typeof categoryId === 'string' ? getCategoryById(categoryId, categories) : undefined;

  const cartItems = parseCart(typeof cart === 'string' ? cart : '');
  const cartTotalValue = cartItems.reduce(
    (sum, item) => sum + (Number.isFinite(item?.total) ? item.total : 0),
    0,
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
        categoryId: typeof categoryId === 'string' ? categoryId : '',
        categoryLabel: selectedCategory?.label || 'Category',
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
      categoryLabel={selectedCategory?.label || 'Category'}
      tintColor={selectedCategory?.textColor || '#3a3f4a'}
      products={products}
      onBack={() => router.back()}
      onProductPress={handleProductPress}
      cartCount={cartItems.length}
      cartTotal={formatCurrency(cartTotalValue)}
      isStallOpen={isOpen === true}
    />
  );
};

export default CategoryRoute;
