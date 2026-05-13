import { CategoryProductsMap, CategoryType } from '../../lib/types';

export const CATEGORY_ITEMS: CategoryType[] = [
    {
        id: 'frozen',
        label: 'Frozen',
        icon: 'snowflake',
        bgColor: '#bdc9eb',
        borderColor: '#2f60eb',
        textColor: '#2346a8',
    },
    {
        id: 'dry-goods',
        label: 'Dry Goods',
        icon: 'archive',
        bgColor: '#e8d27a',
        borderColor: '#b98718',
        textColor: '#6f4a08',
    },
    {
        id: 'meat',
        label: 'Meat',
        icon: 'food-steak',
        bgColor: '#e8c7ca',
        borderColor: '#bc4b47',
        textColor: '#8f2e2b',
    },
    {
        id: 'veggies',
        label: 'Veggies',
        icon: 'food-apple-outline',
        bgColor: '#acdcb5',
        borderColor: '#4ea75a',
        textColor: '#2f7539',
    },
    {
        id: 'fruits',
        label: 'Fruits',
        icon: 'fruit-cherries',
        bgColor: '#eac38d',
        borderColor: '#c97922',
        textColor: '#895015',
    },
    {
        id: 'eggs',
        label: 'Eggs',
        icon: 'egg',
        bgColor: '#ececec',
        borderColor: '#9e9ea3',
        textColor: '#25282e',
    },
    {
        id: 'grains',
        label: 'Grains',
        icon: 'grain',
        bgColor: '#dcd49a',
        borderColor: '#a19346',
        textColor: '#675d24',
    },
    {
        id: 'seafood',
        label: 'Seafood',
        icon: 'fish',
        bgColor: '#bdabe7',
        borderColor: '#8d66e9',
        textColor: '#7347e5',
    },
];

export const CATEGORY_PRODUCTS: CategoryProductsMap = {
    frozen: ['Ice Cream', 'Frozen Peas', 'Frozen Corn'],
    'dry-goods': ['Rice', 'Pasta', 'Oats'],
    meat: ['Chicken', 'Pork', 'Beef'],
    veggies: ['Carrots', 'Broccoli', 'Spinach'],
    fruits: ['Apple', 'Orange', 'Banana'],
    eggs: ['Small Eggs', 'Medium Eggs', 'Large Eggs'],
    grains: ['Corn Grits', 'Barley', 'Millet'],
    seafood: ['Tilapia', 'Shrimp', 'Crab'],
};

const DEFAULT_CUSTOM_CATEGORY_STYLE = {
    icon: 'shape-outline',
    bgColor: '#e2e6ef',
    borderColor: '#a6afc0',
    textColor: '#2f3746',
} as const;

export const normalizeCategoryLabel = (label: string): string =>
    label
        .trim()
        .replace(/\s+/g, ' ');

export const createCategoryIdFromLabel = (label: string): string => {
    const normalizedLabel = normalizeCategoryLabel(label).toLowerCase();
    const slug = normalizedLabel
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    return slug || 'custom-category';
};

export const createCustomCategory = (label: string): CategoryType => {
    const normalizedLabel = normalizeCategoryLabel(label);

    return {
        id: createCategoryIdFromLabel(normalizedLabel),
        label: normalizedLabel,
        ...DEFAULT_CUSTOM_CATEGORY_STYLE,
    };
};

export const categoryExistsByLabel = (categories: CategoryType[], label: string): boolean => {
    const normalizedLabel = normalizeCategoryLabel(label).toLowerCase();

    return categories.some((category) => category.label.toLowerCase() === normalizedLabel);
};

export const getCategoryByLabel = (
    categories: CategoryType[],
    label: string,
): CategoryType | undefined => {
    const normalizedLabel = normalizeCategoryLabel(label).toLowerCase();

    return categories.find((category) => category.label.toLowerCase() === normalizedLabel);
};

export const mergeCategoriesWithDefaults = (customCategories: CategoryType[]): CategoryType[] => {
    const mergedById = new Map<string, CategoryType>();

    CATEGORY_ITEMS.forEach((item) => {
        mergedById.set(item.id, item);
    });

    customCategories.forEach((item) => {
        if (!mergedById.has(item.id)) {
            mergedById.set(item.id, item);
        }
    });

    return Array.from(mergedById.values());
};

export const getCategoryById = (
    categoryId: string,
    categories: CategoryType[] = CATEGORY_ITEMS,
): CategoryType | undefined => categories.find((item) => item.id === categoryId);
