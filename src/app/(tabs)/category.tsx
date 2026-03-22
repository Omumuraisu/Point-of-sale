import { useCallback, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import CategoryScreen from '../../components/pos/category';
import { CATEGORY_ITEMS, getCategoryById } from '../../components/pos/data';
import { loadMergedCategories } from '../../components/pos/categoriesStore';
import { loadMergedProductNamesByCategory, loadSavedProducts } from '../../components/pos/productsStore';
import { CategoryType } from '../../lib/types';
import { formatCurrency, inferPricePerKg, parseCart } from '../../lib/utils';

const CategoryRoute = () => {
  const router = useRouter();
  const { categoryId, cart } = useLocalSearchParams();

  const [categories, setCategories] = useState<CategoryType[]>(CATEGORY_ITEMS);
  const [products, setProducts] = useState<string[]>([]);
  const [savedProducts, setSavedProducts] = useState<Awaited<ReturnType<typeof loadSavedProducts>>>([]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const hydrateCategoryContext = async () => {
        const mergedCategories = await loadMergedCategories();
        const mergedProducts = typeof categoryId === 'string'
          ? await loadMergedProductNamesByCategory(categoryId)
          : [];
        const storedProducts = await loadSavedProducts();

        if (isMounted) {
          setCategories(mergedCategories);
          setProducts(mergedProducts);
          setSavedProducts(storedProducts);
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
    const savedProduct = savedProducts.find((item) => {
      if (typeof categoryId !== 'string') {
        return false;
      }

      return item.categoryId === categoryId
        && item.name.trim().toLowerCase() === product.trim().toLowerCase();
    });

    const resolvedPricePerUnit = savedProduct?.pricePerUnit ?? inferPricePerKg(product);
    const resolvedUnit = savedProduct?.unit ?? 'kg';

    router.push({
      pathname: '/add-item',
      params: {
        categoryId: typeof categoryId === 'string' ? categoryId : '',
        categoryLabel: selectedCategory?.label || 'Category',
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
