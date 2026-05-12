import { useCallback, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import CategoryScreen from '../../components/pos/category';
import { CATEGORY_ITEMS, getCategoryById } from '../../components/pos/data';
import { loadMergedCategories } from '../../components/pos/categoriesStore';
import { ProductCatalogItem, loadMergedProductsByCategory } from '../../components/pos/productsStore';
import { CategoryType } from '../../lib/types';
import { formatCurrency, inferPricePerKg, parseCart } from '../../lib/utils';

const CategoryRoute = () => {
  const router = useRouter();
  const { categoryId, cart } = useLocalSearchParams();

  const [categories, setCategories] = useState<CategoryType[]>(CATEGORY_ITEMS);
  const [products, setProducts] = useState<string[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<ProductCatalogItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const hydrateCategoryContext = async () => {
        const mergedCategories = await loadMergedCategories();
        const selectedCategory = typeof categoryId === 'string'
          ? getCategoryById(categoryId, mergedCategories)
          : undefined;
        const mergedProducts = typeof categoryId === 'string'
          ? await loadMergedProductsByCategory(categoryId, selectedCategory?.label || 'Category')
          : [];

        if (isMounted) {
          setCategories(mergedCategories);
          setCatalogProducts(mergedProducts);
          setProducts(mergedProducts.map((product) => product.name));
        }
      };

      void hydrateCategoryContext();

      return () => {
        isMounted = false;
      };
    }, [categoryId]),
  );

  const selectedCategory =
    typeof categoryId === 'string' ? getCategoryById(categoryId, categories) : undefined;

  const cartItems = parseCart(typeof cart === 'string' ? cart : '');
  const cartTotalValue = cartItems.reduce(
    (sum, item) => sum + (Number.isFinite(item?.total) ? item.total : 0),
    0,
  );

  const handleProductPress = (product: string) => {
    const catalogProduct = catalogProducts.find((item) => (
      item.name.trim().toLowerCase() === product.trim().toLowerCase()
    ));

    const resolvedPricePerUnit = catalogProduct?.source === 'saved'
      ? catalogProduct.pricePerUnit
      : inferPricePerKg(product);
    const resolvedUnit = catalogProduct?.unit ?? 'kg';

    router.push({
      pathname: '/add-item',
      params: {
        categoryId: typeof categoryId === 'string' ? categoryId : '',
        categoryLabel: selectedCategory?.label || 'Category',
        productId: catalogProduct?.id || '',
        productSource: catalogProduct?.source || 'default',
        defaultKey: catalogProduct?.defaultKey || '',
        originalProductName: catalogProduct?.originalName || product,
        productName: product,
        pricePerUnit: resolvedPricePerUnit.toString(),
        unit: resolvedUnit,
        pricePerKg: resolvedPricePerUnit.toString(),
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
    />
  );
};

export default CategoryRoute;
