import { prisma } from "../config/prisma.js";
import { DEFAULT_CATEGORY_PRODUCTS } from "./catalogDefaults.js";

type ListCatalogProductNamesInput = {
    categoryId?: string;
    businessId?: bigint;
    limit?: number;
};

export async function listCatalogProductNames(input: ListCatalogProductNamesInput) {
    const defaults = input.categoryId ? (DEFAULT_CATEGORY_PRODUCTS[input.categoryId] ?? []) : [];

    const dbProducts = await prisma.product.findMany({
        where: {
            business_id: input.businessId
        },
        select: {
            name: true
        },
        orderBy: {
            name: "asc"
        },
        take: input.limit
    });

    const merged = new Set<string>();

    for (const name of defaults) {
        merged.add(name);
    }

    for (const row of dbProducts) {
        const trimmed = row.name.trim();
        if (trimmed.length > 0) {
            merged.add(trimmed);
        }
    }

    return Array.from(merged);
}
