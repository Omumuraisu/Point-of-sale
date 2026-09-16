import { useLocalSearchParams, useRouter } from 'expo-router';
import { clearPersistedCartItems } from '../components/pos/cartStore';
import { useAuthSession } from '../lib/authSession';
import PaymentSuccess from '../components/pos/PaymentSuccess';
import { parseCart } from '../lib/utils';

const PaymentSuccessRoute = () => {
    const router = useRouter();
    const { currentUser } = useAuthSession();
    const scope = currentUser?.stallNumber ? { accountId: currentUser.accountId, stallNumber: currentUser.stallNumber } : null;
    const { cart, paidAmount, totalDue, changeAmount, orderId, completedAt } = useLocalSearchParams();
    const cartItems = parseCart(typeof cart === 'string' ? cart : '');

    const numericPaidAmount = Number.parseFloat(
        typeof paidAmount === 'string' ? paidAmount : '0',
    );
    const numericTotalDue = Number.parseFloat(typeof totalDue === 'string' ? totalDue : '0');
    const numericChangeAmount = Number.parseFloat(typeof changeAmount === 'string' ? changeAmount : '0');
    const numericOrderId = Number.parseInt(typeof orderId === 'string' ? orderId : '0', 10);
    const numericCompletedAt = Number.parseInt(typeof completedAt === 'string' ? completedAt : '0', 10);

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
            totalDue={Number.isFinite(numericTotalDue) ? numericTotalDue : undefined}
            changeAmount={Number.isFinite(numericChangeAmount) ? numericChangeAmount : 0}
            orderId={Number.isFinite(numericOrderId) ? numericOrderId : 0}
            completedAt={Number.isFinite(numericCompletedAt) ? numericCompletedAt : 0}
            onNewSale={handleBackHome}
            onBackHome={handleBackHome}
        />
    );
};

export default PaymentSuccessRoute;
