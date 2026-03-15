import {
  View,
  FlatList,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CATEGORY_ITEMS } from './data';
import POSHeader from './components/POSHeader';
import ProductsTitle from './components/ProductsTitle';
import CategoryCard from './components/CategoryCard';
import BottomActionsBar from './components/BottomActionsBar';
import CartSummaryBar from './components/CartSummaryBar';

const POS = ({
  cartItems = [],
  cartCount = 0,
  cartTotal = 'P 00.00',
}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const addButtonLift = 72 + 10;

  const handleCategoryPress = (item) => {
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
          data={CATEGORY_ITEMS}
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
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: 170 + Math.max(insets.bottom, 10) },
          ]}
          showsVerticalScrollIndicator={false}
        />
        <BottomActionsBar
          onPress={handleAddNewProduct}
          bottomInset={Math.max(insets.bottom, 10) + addButtonLift}
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
});