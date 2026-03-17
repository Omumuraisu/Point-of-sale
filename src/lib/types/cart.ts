export type UnitType = string;

export interface CartItem {
    id: string;
    name: string;
    category: string;
    quantity: number;
    unit: UnitType;
    pricePerKg: number;
    total: number;
    createdAt: number;
}

export interface AddCartItemPayload {
    name: string;
    category: string;
    quantity: number;
    unit: UnitType;
    pricePerKg: number;
    total: number;
}
