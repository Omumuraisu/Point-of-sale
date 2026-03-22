import { prisma } from "../config/prisma.js";

type ListProductsInput = {
    businessId?: bigint;
    search?: string;
    limit?: number;
};

export async function listProducts(input: ListProductsInput) {
    const query = input.search?.trim();

    return prisma.product.findMany({
        where: {
            business_id: input.businessId,
            name: query
                ? {
                    contains: query,
                    mode: "insensitive"
                }
                : undefined
        },
        include: {
            tariff: true
        },
        orderBy: {
            name: "asc"
        },
        take: input.limit
    });
}

export async function getProductById(productId: bigint) {
    return prisma.product.findUnique({
        where: {
            product_id: productId
        },
        include: {
            tariff: true,
            business: true
        }
    });
}
