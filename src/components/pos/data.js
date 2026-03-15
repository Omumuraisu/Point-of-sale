export const CATEGORY_ITEMS = [
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
        bgColor: '#f2e4a8',
        borderColor: '#ebcb50',
        textColor: '#edca45',
    },
    {
        id: 'meat',
        label: 'Meat',
        icon: 'food-steak',
        bgColor: '#f0e0e2',
        borderColor: '#d86a65',
        textColor: '#d05c57',
    },
    {
        id: 'veggies',
        label: 'Veggies',
        icon: 'food-apple-outline',
        bgColor: '#bfe6c5',
        borderColor: '#67c774',
        textColor: '#4ea25a',
    },
    {
        id: 'fruits',
        label: 'Fruits',
        icon: 'fruit-cherries',
        bgColor: '#f1d8b3',
        borderColor: '#f0a548',
        textColor: '#f09f3d',
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
        bgColor: '#ece7b9',
        borderColor: '#ccc07e',
        textColor: '#b9ac69',
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

export const CATEGORY_PRODUCTS = {
    frozen: ['Ice Cream', 'Frozen Peas', 'Frozen Corn'],
    'dry-goods': ['Rice', 'Pasta', 'Oats'],
    meat: ['Chicken', 'Pork', 'Beef'],
    veggies: ['Whole Chicken', 'Chicken Thigh', 'Chicken Wings'],
    fruits: ['Apple', 'Orange', 'Banana'],
    eggs: ['Small Eggs', 'Medium Eggs', 'Large Eggs'],
    grains: ['Corn Grits', 'Barley', 'Millet'],
    seafood: ['Tilapia', 'Shrimp', 'Crab'],
};

export const getCategoryById = (categoryId) =>
    CATEGORY_ITEMS.find((item) => item.id === categoryId);