import { useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Payment from '../components/pos/Payment';
import { saveReceiptTransaction } from '../components/pos/transactionsStore';
import { parseCart } from '../lib/utils';
import { useAuthSession } from '../lib/authSession';

const PaymentRoute = () => {
    const router = useRouter();
    const { currentUser } = useAuthSession();
    const { cart } = useLocalSearchParams();
    const cartItems = parseCart(typeof cart === 'string' ? cart : '');
    const isSavingPaymentRef = useRef(false);
    const [isSavingPayment, setIsSavingPayment] = useState(false);

    const totalDue = cartItems.reduce(
        (sum, item) => sum + (Number.isFinite(item?.total) ? item.total : 0),
        0,
    );

    const handleConfirmPayment = async (paidAmount: number) => {
        if (isSavingPaymentRef.current) {
            return;
        }

        isSavingPaymentRef.current = true;
        setIsSavingPayment(true);

        if (!currentUser) {
            router.replace('/');
            return;
        }

        try {
            const savedTransaction = await saveReceiptTransaction({
                cartItems,
                paidAmount,
                totalDue,
                accountId: currentUser.accountId,
                username: currentUser.displayName,
                businessId: currentUser.businessId,
                stallId: currentUser.stallId,
                stallNumber: currentUser.stallNumber,
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
        } catch (error) {
            isSavingPaymentRef.current = false;
            setIsSavingPayment(false);

            if (__DEV__) {
                console.error('[PAYMENT_DEBUG] Failed to save transaction:', error);
            }
        }
    };

    return (
        <Payment
            totalDue={totalDue}
            onBack={() => router.back()}
            onConfirmPayment={handleConfirmPayment}
            isConfirming={isSavingPayment}
        />
    );
};

export default PaymentRoute;
