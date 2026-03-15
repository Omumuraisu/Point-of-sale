import { useLocalSearchParams, useRouter } from "expo-router";
import CategoryScreen from "../../components/pos/category";
import { CATEGORY_PRODUCTS, getCategoryById } from "../../components/pos/data";

const parseCart = (rawCart) => {
  if (typeof rawCart !== "string" || !rawCart.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawCart);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const formatCurrency = (value) => `P ${value.toFixed(2)}`;

const inferPricePerKg = (productName) => {
  const lowerName = productName.toLowerCase();

  if (lowerName.includes("thigh")) {
    return 170;
  }
  if (lowerName.includes("whole chicken")) {
    return 195;
  }
  if (lowerName.includes("wings")) {
    return 165;
  }

  return 150;
};

const CategoryRoute = () => {
  const router = useRouter();
  const { categoryId, cart } = useLocalSearchParams();

  const selectedCategory =
    typeof categoryId === "string" ? getCategoryById(categoryId) : undefined;

  const cartItems = parseCart(typeof cart === "string" ? cart : "");
  const cartTotalValue = cartItems.reduce(
    (sum, item) => sum + (Number.isFinite(item?.total) ? item.total : 0),
    0,
  );

  const handleProductPress = (product) => {
    router.push({
      pathname: "/add-item",
      params: {
        categoryId: typeof categoryId === "string" ? categoryId : "",
        categoryLabel: selectedCategory?.label || "Category",
        productName: product,
        pricePerKg: inferPricePerKg(product).toString(),
        cart: JSON.stringify(cartItems),
      },
    });
  };

  return (
    <CategoryScreen
      categoryLabel={selectedCategory?.label || "Category"}
      tintColor={selectedCategory?.textColor || "#3a3f4a"}
      products={
        typeof categoryId === "string"
          ? CATEGORY_PRODUCTS[categoryId] || []
          : []
      }
      onBack={() => router.back()}
      onProductPress={handleProductPress}
      cartCount={cartItems.length}
      cartTotal={formatCurrency(cartTotalValue)}
    />
  );
};

export default CategoryRoute;
