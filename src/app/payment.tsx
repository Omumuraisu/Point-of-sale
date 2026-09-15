import { useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Payment from '../components/pos/Payment';
import { saveReceiptTransaction } from '../components/pos/transactionsStore';
import { parseCart } from '../lib/utils';
import { useAuthSession } from '../lib/authSession';
import { useBusinessOperatingStatus } from '../lib/businessOperatingStatus';

const PaymentRoute = () => {
    const router = useRouter();
    const { currentUser } = useAuthSession();
    const { isOpen } = useBusinessOperatingStatus();
    const { cart } = useLocalSearchParams();
    const cartItems = parseCart(typeof cart === 'string' ? cart : '');
    const isSavingPaymentRef = useRef(false);
    const [isSavingPayment, setIsSavingPayment] = useState(false);
    const [paymentError, setPaymentError] = useState<string | null>(null);

    const totalDue = cartItems.reduce(
        (sum, item) => sum + (Number.isFinite(item?.total) ? item.total : 0),
        0,
    );

    const handleConfirmPayment = async (paidAmount: number) => {
        setPaymentError(null);
        if (isOpen !== true) {
            setPaymentError('Open the stall before starting a sale.');
            return;
        }
        if (cartItems.length === 0 || cartItems.some((item) => !Number.isFinite(item.pricePerUnit) || item.pricePerUnit <= 0)) {
            return;
        }
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
            const result = await saveReceiptTransaction({
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
                    savedTransaction: result.transaction,
                    paidAmount,
                    totalDue,
                    cartItemsCount: cartItems.length,
                });
            }

            if (!result.transaction) {
                setPaymentError(result.error ?? 'Unable to record the sale. Check your connection and try again.');
                isSavingPaymentRef.current = false;
                setIsSavingPayment(false);
                return;
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
            setPaymentError('Unable to record the sale. Check your connection and try again.');
        }
    };

    return (
        <Payment
            totalDue={totalDue}
            onBack={() => router.back()}
            onConfirmPayment={handleConfirmPayment}
            isConfirming={isSavingPayment}
            isStallOpen={isOpen === true}
            errorMessage={paymentError}
        />
    );
};

export default PaymentRoute;
