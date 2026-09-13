import { useLocalSearchParams, useRouter } from 'expo-router';
import { clearPersistedCartItems } from '../components/pos/cartStore';
import { useAuthSession } from '../lib/authSession';
import PaymentSuccess from '../components/pos/PaymentSuccess';
import { parseCart } from '../lib/utils';

const PaymentSuccessRoute = () => {
    const router = useRouter();
    const { currentUser } = useAuthSession();
    const scope = currentUser?.stallNumber ? { accountId: currentUser.accountId, stallNumber: currentUser.stallNumber } : null;
    const { cart, paidAmount } = useLocalSearchParams();
    const cartItems = parseCart(typeof cart === 'string' ? cart : '');

    const numericPaidAmount = Number.parseFloat(
        typeof paidAmount === 'string' ? paidAmount : '0',
    );

    const handleBackHome = async () => {
        if (scope) await clearPersistedCartItems(scope);

        router.replace({
            pathname: '/(tabs)/pos',
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
