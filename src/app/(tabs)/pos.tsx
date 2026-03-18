import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import POS from '../../components/pos/pos';
import { CartItem } from '../../lib/types';
import { formatCurrency, parseCart } from '../../lib/utils';
import { loadPersistedCartItems, savePersistedCartItems } from '../../components/pos/cartStore';

export default function PosTabScreen() {
    const { cart } = useLocalSearchParams();
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

                await savePersistedCartItems(routeCartItems);
                return;
            }

            const stored = await loadPersistedCartItems();

            if (isMounted) {
                setCartItems(stored);
            }
        };

        void hydrateCart();

        return () => {
            isMounted = false;
        };
    }, [hasRouteCartParam, routeCartItems]);

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
