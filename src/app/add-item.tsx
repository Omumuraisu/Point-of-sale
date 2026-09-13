import { useState } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AddItemScreen from '../components/pos/AddItem';
import { savePersistedCartItems } from '../components/pos/cartStore';
import { ProductScope, ProductUnit, deleteProductRecord, isProductUnit, updateProductRecord } from '../components/pos/productsStore';
import { AddCartItemPayload } from '../lib/types';
import { parseCart } from '../lib/utils';
import { useAuthSession } from '../lib/authSession';

export default function AddItemRoute() {
    const router = useRouter();
    const { currentUser } = useAuthSession();
    const params = useLocalSearchParams();
    const parsedPrice = Number.parseFloat(typeof params.pricePerUnit === 'string' ? params.pricePerUnit : '0');
    const parsedUnit = isProductUnit(params.unit) ? params.unit : 'pieces';
    const [product, setProduct] = useState({
        id: typeof params.productId === 'string' ? params.productId : '',
        catalogProductId: typeof params.catalogProductId === 'string' && params.catalogProductId ? params.catalogProductId : undefined,
        name: typeof params.productName === 'string' ? params.productName : 'Product',
        categoryId: typeof params.categoryId === 'string' ? params.categoryId : '',
        categoryLabel: typeof params.categoryLabel === 'string' ? params.categoryLabel : 'Category',
        pricePerUnit: Number.isFinite(parsedPrice) ? parsedPrice : 0,
        unit: parsedUnit as ProductUnit,
    });
    const scope: ProductScope | null = currentUser?.stallNumber
        ? { accountId: currentUser.accountId, stallNumber: currentUser.stallNumber } : null;

    const add = async (payload: AddCartItemPayload) => {
        if (!scope || !Number.isFinite(payload.pricePerUnit) || payload.pricePerUnit <= 0) {
            Alert.alert('Price required', 'Set a positive selling price before adding this product.');
            return;
        }
        const previous = parseCart(typeof params.cart === 'string' ? params.cart : '');
        const updated = [...previous, { id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`, ...payload, createdAt: Date.now() }];
        await savePersistedCartItems(scope, updated);
        router.replace({ pathname: '/(tabs)/pos', params: { cart: JSON.stringify(updated), updatedAt: Date.now().toString() } });
    };
    const remove = async () => {
        if (!scope) return;
        await deleteProductRecord(scope, product.id);
        router.replace({ pathname: '/category', params: { categoryId: product.categoryId, cart: typeof params.cart === 'string' ? params.cart : '[]' } });
    };
    const update = async ({ pricePerUnit, unit }: { pricePerUnit: number; unit: ProductUnit }) => {
        if (!scope) return;
        const saved = await updateProductRecord(scope, product.id, pricePerUnit, unit);
        if (saved) setProduct((current) => ({ ...current, pricePerUnit: saved.pricePerUnit, unit: saved.unit }));
    };
    return <AddItemScreen productName={product.name} categoryId={product.categoryId} categoryLabel={product.categoryLabel}
        productId={product.id} catalogProductId={product.catalogProductId} pricePerUnit={product.pricePerUnit} unit={product.unit}
        onBack={() => router.back()} onAdd={add} onDeleteProduct={remove} onUpdateProduct={update} />;
}
