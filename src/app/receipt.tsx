import { useLocalSearchParams, useRouter } from 'expo-router';
import { clearPersistedCartItems, savePersistedCartItems } from '../components/pos/cartStore';
import Receipt from '../components/pos/Receipt';
import { parseCart } from '../lib/utils';

const ReceiptRoute = () => {
    const router = useRouter();
    const { cart } = useLocalSearchParams();
    const cartItems = parseCart(typeof cart === 'string' ? cart : '');

    const handleClearAll = async () => {
        await clearPersistedCartItems();

        router.replace({
            pathname: '/(tabs)/pos',
            params: {
                cart: JSON.stringify([]),
                updatedAt: Date.now().toString(),
            },
        });
    };

    const handleAddMore = async () => {
        await savePersistedCartItems(cartItems);

        router.replace({
            pathname: '/(tabs)/pos',
            params: {
                cart: JSON.stringify(cartItems),
            },
        });
    };

    const handleConfirm = () => {
        router.push({
            pathname: '/payment',
            params: {
                cart: JSON.stringify(cartItems),
                updatedAt: Date.now().toString(),
            },
        });
    };

    return (
        <Receipt
            cartItems={cartItems}
            onBack={() => router.back()}
            onAddMore={handleAddMore}
            onClearAll={handleClearAll}
            onConfirm={handleConfirm}
        />
    );
};

export default ReceiptRoute;