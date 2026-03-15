import { useLocalSearchParams, useRouter } from 'expo-router';
import Receipt from '../components/pos/Receipt';

const parseCart = (rawCart) => {
    if (typeof rawCart !== 'string' || !rawCart.trim()) {
        return [];
    }

    try {
        const parsed = JSON.parse(rawCart);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const ReceiptRoute = () => {
    const router = useRouter();
    const { cart } = useLocalSearchParams();
    const cartItems = parseCart(typeof cart === 'string' ? cart : '');

    const handleClearAll = () => {
        router.replace({
            pathname: '/',
            params: {
                cart: JSON.stringify([]),
                updatedAt: Date.now().toString(),
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
            onAddMore={() => router.replace({ pathname: '/', params: { cart: JSON.stringify(cartItems) } })}
            onClearAll={handleClearAll}
            onConfirm={handleConfirm}
        />
    );
};

export default ReceiptRoute;