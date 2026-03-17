export type CategoryType = {
    id: string;
    label: string;
    icon: string;
    bgColor: string;
    borderColor: string;
    textColor: string;
};

export type CategoryProductsMap = Record<string, string[]>;

export type TransactionCategoryType = {
    key: string;
    label: string;
};
