import { useCallback, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { clearPersistedCartItems, savePersistedCartItems } from '../components/pos/cartStore';
import Receipt from '../components/pos/Receipt';
import { parseCart } from '../lib/utils';
import { useAuthSession } from '../lib/authSession';
import { useBusinessOperatingStatus } from '../lib/businessOperatingStatus';

const ReceiptRoute = () => {
    const router = useRouter();
    const { currentUser } = useAuthSession();
    const { isOpen } = useBusinessOperatingStatus();
    const scope = currentUser?.stallNumber ? { accountId: currentUser.accountId, stallNumber: currentUser.stallNumber } : null;
    const { cart } = useLocalSearchParams();
    const cartItems = parseCart(typeof cart === 'string' ? cart : '');
    const isConfirmingRef = useRef(false);
    const [isConfirming, setIsConfirming] = useState(false);

    useFocusEffect(
        useCallback(() => {
            isConfirmingRef.current = false;
            setIsConfirming(false);
        }, []),
    );

    const handleClearAll = async () => {
        if (isOpen !== true) return;
        if (scope) await clearPersistedCartItems(scope);

        router.replace({
            pathname: '/(tabs)/pos',
            params: {
                cart: JSON.stringify([]),
                updatedAt: Date.now().toString(),
            },
        });
    };

    const handleAddMore = async () => {
        if (isOpen !== true) return;
        if (scope) await savePersistedCartItems(scope, cartItems);

        router.replace({
            pathname: '/(tabs)/pos',
            params: {
                cart: JSON.stringify(cartItems),
            },
        });
    };

    const handleConfirm = () => {
        if (isOpen !== true) return;
        if (isConfirmingRef.current) {
            return;
        }

        isConfirmingRef.current = true;
        setIsConfirming(true);

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
            isConfirming={isConfirming}
            isStallOpen={isOpen === true}
        />
    );
};

export default ReceiptRoute;
