import {
    buildListingCategories,
    buildProductSelectionParams,
    filterProducts,
    filterProductsByCategoryLabel,
    getProductDisplayName,
} from '../src/components/pos/productSearch';
import { CATEGORY_ITEMS } from '../src/components/pos/data';
import type { SavedProductRecord } from '../src/components/pos/productsStore';
import type { CartItem } from '../src/lib/types';

const product = (overrides: Partial<SavedProductRecord> = {}): SavedProductRecord => ({
    id: 'listing-1',
    accountId: 1,
    businessId: 10,
    stallNumber: 'A-1',
    name: 'Premium Rice',
    categoryId: 'rice',
    categoryLabel: 'Rice',
    mainCategory: 'Food',
    section: 'Rice',
    variant: 'Dinorado',
    pricePerUnit: 65,
    unit: 'kg',
    createdAt: 1,
    updatedAt: 1,
    catalogProductId: 'catalog-1',
    syncState: 'synced',
    ...overrides,
});

describe('POS product search', () => {
    const products = [
        product(),
        product({ id: 'listing-2', name: 'Cooking Oil', variant: 'Canola', categoryId: 'dry-goods', categoryLabel: 'Dry Goods' }),
    ];

    test('uses the Add Product category names with their intended icons', () => {
        expect(CATEGORY_ITEMS.filter((category) => (
            ['Rice', 'Seafoods', 'Vegetables'].includes(category.label)
        )).map(({ label, icon }) => ({ label, icon }))).toEqual([
            { label: 'Vegetables', icon: 'food-apple-outline' },
            { label: 'Rice', icon: 'grain' },
            { label: 'Seafoods', icon: 'fish' },
        ]);
        expect(CATEGORY_ITEMS.some((category) => ['Grains', 'Veggies'].includes(category.label))).toBe(false);
    });

    test.each([
        ['premium', 'listing-1'],
        ['DINORADO', 'listing-1'],
        [' dry GOODS ', 'listing-2'],
    ])('matches %s against product fields', (query, expectedId) => {
        expect(filterProducts(products, query).map((item) => item.id)).toEqual([expectedId]);
    });

    test('returns available products for an empty query and excludes archived records', () => {
        const archived = product({ id: 'archived', archivedAt: 100 });
        expect(filterProducts([...products, archived], '  ').map((item) => item.id)).toEqual(['listing-1', 'listing-2']);
        expect(filterProducts([...products, archived], 'missing')).toEqual([]);
    });

    test('derives unique category cards from available products', () => {
        const categories = buildListingCategories([
            ...products,
            product({ id: 'listing-3', name: 'Brown Rice' }),
            product({ id: 'archived', categoryId: 'meat', categoryLabel: 'Meat', archivedAt: 100 }),
        ]);

        expect(categories.map((category) => category.id)).toEqual(['rice', 'dry-goods']);
    });

    test('coalesces legacy and current category labels under canonical icon cards', () => {
        const categories = buildListingCategories([
            product({ id: 'legacy-rice', categoryId: 'grains', categoryLabel: 'Grains' }),
            product({ id: 'current-rice', categoryId: 'rice-catalog-id', categoryLabel: 'Rice' }),
            product({ id: 'legacy-vegetable', categoryId: 'veggies', categoryLabel: 'Veggies' }),
            product({ id: 'current-vegetable', categoryId: 'vegetable-catalog-id', categoryLabel: 'Vegetables' }),
            product({ id: 'legacy-seafood', categoryId: 'seafood', categoryLabel: 'Seafood' }),
            product({ id: 'current-seafood', categoryId: 'seafoods-catalog-id', categoryLabel: 'Seafoods' }),
        ]);

        expect(categories.map(({ id, label, icon }) => ({ id, label, icon }))).toEqual([
            { id: 'rice', label: 'Rice', icon: 'grain' },
            { id: 'vegetables', label: 'Vegetables', icon: 'food-apple-outline' },
            { id: 'seafoods', label: 'Seafoods', icon: 'fish' },
        ]);
    });

    test('loads legacy and current labels into the same canonical category', () => {
        const productsToFilter = [
            product({ id: 'legacy', categoryId: 'grains', categoryLabel: 'Grains' }),
            product({ id: 'current', categoryId: 'rice-catalog-id', categoryLabel: 'Rice' }),
            product({ id: 'other', categoryId: 'seafood', categoryLabel: 'Seafood' }),
        ];

        expect(filterProductsByCategoryLabel(productsToFilter, 'Rice').map((item) => item.id))
            .toEqual(['legacy', 'current']);
    });

    test('keeps custom categories separate with the generic icon', () => {
        const categories = buildListingCategories([
            product({ categoryId: 'beverages-id', categoryLabel: 'Beverages' }),
        ]);

        expect(categories[0]).toMatchObject({
            id: 'beverages-id',
            label: 'Beverages',
            icon: 'shape-outline',
        });
    });

    test('builds direct add-item parameters with the current cart', () => {
        const cart: CartItem[] = [{
            id: 'cart-1',
            name: 'Eggs',
            category: 'Eggs',
            productListingId: 'eggs-1',
            quantity: 1,
            unit: 'pieces',
            pricePerUnit: 10,
            total: 10,
            createdAt: 1,
        }];

        expect(getProductDisplayName(products[0])).toBe('Premium Rice — Dinorado');
        expect(buildProductSelectionParams(products[0], cart)).toEqual({
            categoryId: 'rice',
            categoryLabel: 'Rice',
            productId: 'listing-1',
            catalogProductId: 'catalog-1',
            productName: 'Premium Rice — Dinorado',
            pricePerUnit: '65',
            unit: 'kg',
            cart: JSON.stringify(cart),
        });
    });
});
