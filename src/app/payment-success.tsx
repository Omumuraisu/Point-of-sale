import { useLocalSearchParams, useRouter } from 'expo-router';
import PaymentSuccess from '../components/pos/PaymentSuccess';
import { parseCart } from '../lib/utils';

const PaymentSuccessRoute = () => {
    const router = useRouter();
    const { cart, paidAmount } = useLocalSearchParams();
    const cartItems = parseCart(typeof cart === 'string' ? cart : '');

    const numericPaidAmount = Number.parseFloat(
        typeof paidAmount === 'string' ? paidAmount : '0',
    );

    const handleBackHome = () => {
        router.replace({
            pathname: '/',
            params: {
                cart: JSON.stringify([]),
                updatedAt: Date.now().toString(),
            },
        });
    };

    return (
        <PaymentSuccess
            cartItems={cartItems}
            paidAmount={Number.isFinite(numericPaidAmount) ? numericPaidAmount : 0}
            onNewSale={handleBackHome}
            onBackHome={handleBackHome}
        />
    );
};

export default PaymentSuccessRoute;