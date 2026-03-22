import { useLocalSearchParams, useRouter } from 'expo-router';
import AddItemScreen from '../components/pos/AddItem';
import { savePersistedCartItems } from '../components/pos/cartStore';
import { AddCartItemPayload } from '../lib/types';
import { parseCart } from '../lib/utils';

const AddItemRoute = () => {
    const router = useRouter();
    const { productName, categoryLabel, pricePerKg, pricePerUnit, unit, cart } = useLocalSearchParams();

    const resolvedPrice = Number.parseFloat(
        typeof pricePerUnit === 'string'
            ? pricePerUnit
            : (typeof pricePerKg === 'string' ? pricePerKg : '0'),
    );
    const resolvedUnit = typeof unit === 'string' && unit.trim().length > 0 ? unit : 'kg';

    const handleAdd = async (itemPayload: AddCartItemPayload) => {
        const previousCart = parseCart(typeof cart === 'string' ? cart : '');

        const newItem = {
            id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            ...itemPayload,
            createdAt: Date.now(),
        };

        const updatedCart = [...previousCart, newItem];

        await savePersistedCartItems(updatedCart);

        router.replace({
            pathname: '/(tabs)/pos',
            params: {
                cart: JSON.stringify(updatedCart),
                updatedAt: Date.now().toString(),
            },
        });
    };

    return (
        <AddItemScreen
            productName={typeof productName === 'string' ? productName : 'Product'}
            categoryLabel={typeof categoryLabel === 'string' ? categoryLabel : 'Category'}
            pricePerUnit={Number.isFinite(resolvedPrice) ? resolvedPrice : 0}
            unit={resolvedUnit}
            onBack={() => router.back()}
            onAdd={handleAdd}
        />
    );
};

export default AddItemRoute;