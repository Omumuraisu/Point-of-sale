import type { CartItem, CategoryType } from '../../lib/types';
import type { SavedProductRecord } from './productsStore';
import { CATEGORY_ITEMS, createCustomCategory } from './data';

const normalizeSearchText = (value: string): string => value.trim().toLocaleLowerCase();

export const buildListingCategories = (products: SavedProductRecord[]): CategoryType[] => {
    const unique = new Map<string, string>();
    products
        .filter((product) => !product.archivedAt)
        .forEach((product) => unique.set(product.categoryId, product.categoryLabel));

    return Array.from(unique, ([id, label]) => {
        const style = CATEGORY_ITEMS.find((item) => item.label.toLowerCase() === label.toLowerCase());
        return style ? { ...style, id, label } : { ...createCustomCategory(label), id };
    });
};

export const filterProducts = (
    products: SavedProductRecord[],
    query: string,
): SavedProductRecord[] => {
    const normalizedQuery = normalizeSearchText(query);
    const availableProducts = products.filter((product) => !product.archivedAt);

    if (!normalizedQuery) return availableProducts;

    return availableProducts.filter((product) => (
        [product.name, product.variant, product.categoryLabel]
            .some((value) => normalizeSearchText(value).includes(normalizedQuery))
    ));
};

export const getProductDisplayName = (product: Pick<SavedProductRecord, 'name' | 'variant'>): string => (
    product.variant ? `${product.name} — ${product.variant}` : product.name
);

export const buildProductSelectionParams = (
    product: SavedProductRecord,
    cartItems: CartItem[],
) => ({
    categoryId: product.categoryId,
    categoryLabel: product.categoryLabel,
    productId: product.id,
    catalogProductId: product.catalogProductId ?? '',
    productName: getProductDisplayName(product),
    pricePerUnit: product.pricePerUnit.toString(),
    unit: product.unit,
    cart: JSON.stringify(cartItems),
});
