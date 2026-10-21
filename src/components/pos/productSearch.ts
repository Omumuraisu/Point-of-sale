import type { CartItem, CategoryType } from '../../lib/types';
import type { SavedProductRecord } from './productsStore';
import { createCustomCategory, getCanonicalCategoryLabel, getCategoryStyleByLabel } from './data';

const normalizeSearchText = (value: string): string => value.trim().toLocaleLowerCase();

export const buildListingCategories = (products: SavedProductRecord[]): CategoryType[] => {
    const categories = new Map<string, CategoryType>();

    products.filter((product) => !product.archivedAt).forEach((product) => {
        const label = getCanonicalCategoryLabel(product.categoryLabel);
        const key = label.toLowerCase();
        if (categories.has(key)) return;

        const style = getCategoryStyleByLabel(label);
        categories.set(key, style
            ? { ...style, label }
            : { ...createCustomCategory(label), id: product.categoryId });
    });

    return Array.from(categories.values());
};

export const filterProductsByCategoryLabel = (
    products: SavedProductRecord[],
    categoryLabel: string,
): SavedProductRecord[] => {
    const canonicalLabel = getCanonicalCategoryLabel(categoryLabel).toLowerCase();
    return products.filter((product) => (
        !product.archivedAt
        && getCanonicalCategoryLabel(product.categoryLabel).toLowerCase() === canonicalLabel
    ));
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
