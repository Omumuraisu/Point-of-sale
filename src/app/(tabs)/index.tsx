import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import POS from "../../components/pos/pos";
import { formatCurrency, parseCart } from '../../lib/utils';

export default function App() {
  const { cart } = useLocalSearchParams();
  const cartItems = parseCart(typeof cart === "string" ? cart : "");
  const cartTotalValue = cartItems.reduce(
    (sum, item) => sum + (Number.isFinite(item?.total) ? item.total : 0),
    0,
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <POS
        cartItems={cartItems}
        cartCount={cartItems.length}
        cartTotal={formatCurrency(cartTotalValue)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#dfe2ec",
  },
});
