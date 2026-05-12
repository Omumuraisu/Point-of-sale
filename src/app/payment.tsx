import { useLocalSearchParams, useRouter } from 'expo-router';
import Payment from '../components/pos/Payment';
import { saveReceiptTransaction } from '../components/pos/transactionsStore';
import { parseCart } from '../lib/utils';

const PaymentRoute = () => {
    const router = useRouter();
    const { cart } = useLocalSearchParams();
    const cartItems = parseCart(typeof cart === 'string' ? cart : '');

    const totalDue = cartItems.reduce(
        (sum, item) => sum + (Number.isFinite(item?.total) ? item.total : 0),
        0,
    );

    const handleConfirmPayment = async (paidAmount: number) => {
        const savedTransaction = await saveReceiptTransaction({
            cartItems,
            paidAmount,
            totalDue,
        });

        if (__DEV__) {
            console.log('[PAYMENT_DEBUG] Saved transaction:', {
                savedTransaction,
                paidAmount,
                totalDue,
                cartItemsCount: cartItems.length,
            });
        }

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