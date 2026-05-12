// @ts-ignore: suppress missing declaration file for 'react' in some environments
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import AddProductScreen from '../components/pos/addProduct';
import { loadCustomCategories, loadMergedCategories, saveCustomCategories } from '../components/pos/categoriesStore';
import { categoryExistsByLabel, createCustomCategory, getCategoryByLabel } from '../components/pos/data';
import { ProductUnit, saveProductRecord } from '../components/pos/productsStore';
import { CategoryType } from '../lib/types';

interface AddProductPayload {
    name: string;
    category: string;
    pricePerUnit: number;
    unit: ProductUnit;
}

const AddProductRoute = () => {
    const router = useRouter();
    const [categoryOptions, setCategoryOptions] = useState<string[]>([]);

    useEffect(() => {
        let isMounted = true;

        const hydrateCategories = async () => {
            const mergedCategories = await loadMergedCategories();

            if (isMounted) {
                setCategoryOptions(mergedCategories.map((category) => category.label));
            }
        };

        void hydrateCategories();

        return () => {
            isMounted = false;
        };
    }, []);

    const fallbackCategories = useMemo(
        () => ['Frozen', 'Dry Goods', 'Meat', 'Veggies', 'Fruits', 'Eggs', 'Grains', 'Seafood'],
        [],
    );

    const handleSave = async (payload: AddProductPayload) => {
        console.log('Save product payload:', payload);

        const mergedCategories = await loadMergedCategories();
        let resolvedCategory = getCategoryByLabel(mergedCategories, payload.category);

        if (!categoryExistsByLabel(mergedCategories, payload.category)) {
            const customCategories = await loadCustomCategories();
            const newCategory: CategoryType = createCustomCategory(payload.category);

            await saveCustomCategories([newCategory, ...customCategories]);
            resolvedCategory = newCategory;
        }

        if (resolvedCategory) {
            await saveProductRecord({
                name: payload.name,
                categoryId: resolvedCategory.id,
                categoryLabel: resolvedCategory.label,
                pricePerUnit: payload.pricePerUnit,
                unit: payload.unit,
            });
        }

        router.back();
    };

    return (
        <AddProductScreen
            onCancel={() => router.back()}
            onSave={handleSave}
            categoryOptions={categoryOptions.length > 0 ? categoryOptions : fallbackCategories}
        />
    );
};

export default AddProductRoute;
