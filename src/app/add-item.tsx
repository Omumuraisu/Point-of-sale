import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AddItemScreen from '../components/pos/AddItem';
import { savePersistedCartItems } from '../components/pos/cartStore';
import { loadMergedCategories } from '../components/pos/categoriesStore';
import {
    ProductUnit,
    deleteProductRecord,
    updateProductRecord,
} from '../components/pos/productsStore';
import { AddCartItemPayload } from '../lib/types';
import { parseCart } from '../lib/utils';

const PRODUCT_UNITS: ProductUnit[] = ['pieces', 'kg', 'g', 'mg', 'L', 'mL'];

const isProductUnit = (value: string): value is ProductUnit =>
    PRODUCT_UNITS.includes(value as ProductUnit);

const AddItemRoute = () => {
    const router = useRouter();
    const {
        productName,
        categoryId,
        categoryLabel,
        productId,
        productSource,
        defaultKey,
        originalProductName,
        pricePerKg,
        pricePerUnit,
        unit,
        cart,
    } = useLocalSearchParams();

    const resolvedPrice = Number.parseFloat(
        typeof pricePerUnit === 'string'
            ? pricePerUnit
            : (typeof pricePerKg === 'string' ? pricePerKg : '0'),
    );
    const resolvedUnit = typeof unit === 'string' && unit.trim().length > 0 ? unit : 'kg';
    const [categoryOptions, setCategoryOptions] = useState<Array<{ id: string; label: string }>>([]);
    const [currentProduct, setCurrentProduct] = useState({
        name: typeof productName === 'string' ? productName : 'Product',
        categoryId: typeof categoryId === 'string' ? categoryId : '',
        categoryLabel: typeof categoryLabel === 'string' ? categoryLabel : 'Category',
        pricePerUnit: Number.isFinite(resolvedPrice) ? resolvedPrice : 0,
        unit: isProductUnit(resolvedUnit) ? resolvedUnit : 'kg',
    });
    const [productMeta, setProductMeta] = useState({
        source: productSource === 'saved' ? 'saved' as const : 'default' as const,
        productId: typeof productId === 'string' ? productId : '',
        defaultKey: typeof defaultKey === 'string' ? defaultKey : '',
    });

    useEffect(() => {
        let isMounted = true;

        const hydrateCategories = async () => {
            const categories = await loadMergedCategories();

            if (isMounted) {
                setCategoryOptions(categories.map((category) => ({
                    id: category.id,
                    label: category.label,
                })));
            }
        };

        void hydrateCategories();

        return () => {
            isMounted = false;
        };
    }, []);

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

    const handleDeleteProduct = async () => {
        await deleteProductRecord({
            source: productMeta.source,
            productId: productMeta.productId || undefined,
            defaultKey: productMeta.defaultKey || undefined,
        });

        router.replace({
            pathname: '/category',
            params: {
                categoryId: currentProduct.categoryId,
                cart: typeof cart === 'string' ? cart : JSON.stringify([]),
                updatedAt: Date.now().toString(),
            },
        });
    };

    const handleUpdateProduct = async (payload: {
        name: string;
        categoryId: string;
        categoryLabel: string;
        pricePerUnit: number;
        unit: ProductUnit;
    }) => {
        const savedProduct = await updateProductRecord({
            ...payload,
            source: productMeta.source,
            productId: productMeta.productId || undefined,
            defaultKey: productMeta.defaultKey || undefined,
        });

        setCurrentProduct({
            name: savedProduct?.name ?? payload.name,
            categoryId: savedProduct?.categoryId ?? payload.categoryId,
            categoryLabel: savedProduct?.categoryLabel ?? payload.categoryLabel,
            pricePerUnit: savedProduct?.pricePerUnit ?? payload.pricePerUnit,
            unit: savedProduct?.unit ?? payload.unit,
        });

        if (savedProduct) {
            setProductMeta({
                source: 'saved',
                productId: savedProduct.id,
                defaultKey: productMeta.defaultKey,
            });
        }
    };

    return (
        <AddItemScreen
            productName={currentProduct.name}
            categoryId={currentProduct.categoryId}
            categoryLabel={currentProduct.categoryLabel}
            productId={productMeta.productId}
            defaultKey={productMeta.defaultKey}
            originalProductName={typeof originalProductName === 'string' ? originalProductName : currentProduct.name}
            pricePerUnit={currentProduct.pricePerUnit}
            unit={currentProduct.unit}
            categoryOptions={categoryOptions}
            onBack={() => router.back()}
            onAdd={handleAdd}
            onDeleteProduct={handleDeleteProduct}
            onUpdateProduct={handleUpdateProduct}
        />
    );
};

export default AddItemRoute;
