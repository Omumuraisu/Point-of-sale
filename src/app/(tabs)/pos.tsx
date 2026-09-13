import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import POS from '../../components/pos/pos';
import { CartItem } from '../../lib/types';
import { formatCurrency, parseCart } from '../../lib/utils';
import { loadPersistedCartItems, savePersistedCartItems } from '../../components/pos/cartStore';
import { useAuthSession } from '../../lib/authSession';

export default function PosTabScreen() {
    const { cart } = useLocalSearchParams();
    const { currentUser } = useAuthSession();
    const scope = currentUser?.stallNumber ? { accountId: currentUser.accountId, stallNumber: currentUser.stallNumber } : null;
    const hasRouteCartParam = typeof cart === 'string';
    const routeCartItems = useMemo(
        () => parseCart(typeof cart === 'string' ? cart : ''),
        [cart],
    );
    const [cartItems, setCartItems] = useState<CartItem[]>(routeCartItems);

    useEffect(() => {
        let isMounted = true;

        const hydrateCart = async () => {
            if (hasRouteCartParam) {
                if (isMounted) {
                    setCartItems(routeCartItems);
                }

                if (scope) await savePersistedCartItems(scope, routeCartItems);
                return;
            }

            const stored = scope ? await loadPersistedCartItems(scope) : [];

            if (isMounted) {
                setCartItems(stored);
            }
        };

        void hydrateCart();

        return () => {
            isMounted = false;
        };
    }, [hasRouteCartParam, routeCartItems, currentUser?.accountId, currentUser?.stallNumber]);

    const cartTotalValue = cartItems.reduce(
        (sum, item) => sum + (Number.isFinite(item?.total) ? item.total : 0),
        0,
    );

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />
            <POS
                cartItems={cartItems}
                cartCount={cartItems.length}
                cartTotal={formatCurrency(cartTotalValue)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#dfe2ec',
    },
});
