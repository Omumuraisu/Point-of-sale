import {
    buildListingCategories,
    buildProductSelectionParams,
    filterProducts,
    getProductDisplayName,
} from '../src/components/pos/productSearch';
import type { SavedProductRecord } from '../src/components/pos/productsStore';
import type { CartItem } from '../src/lib/types';

const product = (overrides: Partial<SavedProductRecord> = {}): SavedProductRecord => ({
    id: 'listing-1',
    accountId: 1,
    stallNumber: 'A-1',
    name: 'Premium Rice',
    categoryId: 'grains',
    categoryLabel: 'Grains',
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

        expect(categories.map((category) => category.id)).toEqual(['grains', 'dry-goods']);
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
            categoryId: 'grains',
            categoryLabel: 'Grains',
            productId: 'listing-1',
            catalogProductId: 'catalog-1',
            productName: 'Premium Rice — Dinorado',
            pricePerUnit: '65',
            unit: 'kg',
            cart: JSON.stringify(cart),
        });
    });
});
