import { useState } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AddItemScreen from '../components/pos/AddItem';
import { savePersistedCartItems } from '../components/pos/cartStore';
import { ProductScope, ProductUnit, deleteProductRecord, isProductUnit, updateProductRecord } from '../components/pos/productsStore';
import { AddCartItemPayload } from '../lib/types';
import { parseCart } from '../lib/utils';
import { useAuthSession } from '../lib/authSession';
import { useBusinessOperatingStatus } from '../lib/businessOperatingStatus';

export default function AddItemRoute() {
    const router = useRouter();
    const { currentUser } = useAuthSession();
    const { isOpen } = useBusinessOperatingStatus();
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
        if (isOpen !== true) {
            Alert.alert('Stall closed', 'Open the stall before starting a sale.');
            return;
        }
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
        if (isOpen !== true) {
            Alert.alert('Stall closed', 'Open the stall before changing products.');
            return { product: null, localSaved: false, synced: false, syncState: 'error' as const, error: 'Open the stall before changing products.' };
        }
        if (!scope) return { product: null, localSaved: false, synced: false, syncState: 'error' as const, error: 'Select an authorized stall before changing products.' };
        const result = await deleteProductRecord(scope, product.id);
        if (result.synced) router.replace({ pathname: '/category', params: { categoryId: product.categoryId, cart: typeof params.cart === 'string' ? params.cart : '[]' } });
        return result;
    };
    const update = async ({ pricePerUnit, unit }: { pricePerUnit: number; unit: ProductUnit }) => {
        if (isOpen !== true) {
            Alert.alert('Stall closed', 'Open the stall before changing products.');
            return { product: null, localSaved: false, synced: false, syncState: 'error' as const, error: 'Open the stall before changing products.' };
        }
        if (!scope) return { product: null, localSaved: false, synced: false, syncState: 'error' as const, error: 'Select an authorized stall before changing products.' };
        const result = await updateProductRecord(scope, product.id, pricePerUnit, unit);
        if (result.product) setProduct((current) => ({ ...current, pricePerUnit: result.product!.pricePerUnit, unit: result.product!.unit }));
        return result;
    };
    return <AddItemScreen productName={product.name} categoryId={product.categoryId} categoryLabel={product.categoryLabel}
        productId={product.id} catalogProductId={product.catalogProductId} pricePerUnit={product.pricePerUnit} unit={product.unit}
        disabled={isOpen !== true} onBack={() => router.back()} onAdd={add} onDeleteProduct={remove} onUpdateProduct={update} />;
}
