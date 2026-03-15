import { useLocalSearchParams, useRouter } from 'expo-router';
import Payment from '../components/pos/Payment';

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

const PaymentRoute = () => {
    const router = useRouter();
    const { cart } = useLocalSearchParams();
    const cartItems = parseCart(typeof cart === 'string' ? cart : '');

    const totalDue = cartItems.reduce(
        (sum, item) => sum + (Number.isFinite(item?.total) ? item.total : 0),
        0,
    );

    const handleConfirmPayment = (paidAmount) => {
        router.replace({
            pathname: '/payment-success',
            params: {
                cart: JSON.stringify(cartItems),
                paidAmount: Number.isFinite(paidAmount) ? paidAmount.toString() : '0',
                updatedAt: Date.now().toString(),
            },
        });
    };

    return (
        <Payment
            totalDue={totalDue}
            onBack={() => router.back()}
            onConfirmPayment={handleConfirmPayment}
        />
    );
};

export default PaymentRoute;