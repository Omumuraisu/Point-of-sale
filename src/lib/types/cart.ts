export type UnitType = string;

export interface CartItem {
    id: string;
    name: string;
    category: string;
    productListingId: string;
    catalogProductId?: string;
    quantity: number;
    unit: UnitType;
    pricePerUnit: number;
    /** Legacy persisted field; read-only compatibility. */
    pricePerKg?: number;
    total: number;
    createdAt: number;
}

export interface AddCartItemPayload {
    name: string;
    category: string;
    productListingId: string;
    catalogProductId?: string;
    quantity: number;
    unit: UnitType;
    pricePerUnit: number;
    total: number;
}
