import { useLocalSearchParams, useRouter } from 'expo-router';
import AddItemScreen from '../components/pos/AddItem';
import { AddCartItemPayload } from '../lib/types';
import { parseCart } from '../lib/utils';

const AddItemRoute = () => {
    const router = useRouter();
    const { productName, categoryLabel, pricePerKg, cart } = useLocalSearchParams();

    const numericPrice = Number.parseFloat(typeof pricePerKg === 'string' ? pricePerKg : '0');

    const handleAdd = (itemPayload: AddCartItemPayload) => {
        const previousCart = parseCart(typeof cart === 'string' ? cart : '');

        const newItem = {
            id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            ...itemPayload,
            createdAt: Date.now(),
        };

        const updatedCart = [...previousCart, newItem];

        router.replace({
            pathname: '/(tabs)/pos',
            params: {
                cart: JSON.stringify([]),
                updatedAt: Date.now().toString(),
            },
        });
    };

    return (
        <AddItemScreen
            productName={typeof productName === 'string' ? productName : 'Product'}
            categoryLabel={typeof categoryLabel === 'string' ? categoryLabel : 'Category'}
            pricePerKg={Number.isFinite(numericPrice) ? numericPrice : 0}
            onBack={() => router.back()}
            onAdd={handleAdd}
        />
    );
};

export default AddItemRoute;