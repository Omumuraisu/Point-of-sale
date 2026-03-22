import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../middleware/errorHandler.js";
import { getProductById, listProducts } from "../services/products.service.js";
import { safeJson } from "../utils/safeJson.js";

const listProductsSchema = z.object({
    businessId: z.union([z.string(), z.number(), z.bigint()]).optional(),
    business_id: z.union([z.string(), z.number(), z.bigint()]).optional(),
    search: z.string().optional(),
    limit: z.coerce.number().int().positive().max(200).optional()
}).transform((value) => ({
    businessId: value.businessId ?? value.business_id,
    search: value.search,
    limit: value.limit
}));

const productIdSchema = z.object({
    id: z.string().regex(/^\d+$/, "id must be a positive integer")
});

export const productsRouter = Router();

productsRouter.get("/products", async (req, res, next) => {
    try {
        const parsed = listProductsSchema.safeParse(req.query);
        if (!parsed.success) {
            throw new HttpError(400, "Invalid query parameters");
        }

        const products = await listProducts({
            businessId: parsed.data.businessId !== undefined ? BigInt(parsed.data.businessId) : undefined,
            search: parsed.data.search,
            limit: parsed.data.limit
        });

        res.json(safeJson(products));
    } catch (error) {
        next(error);
    }
});

productsRouter.get("/products/:id", async (req, res, next) => {
    try {
        const parsed = productIdSchema.safeParse(req.params);
        if (!parsed.success) {
            throw new HttpError(400, "Invalid product id");
        }

        const product = await getProductById(BigInt(parsed.data.id));
        if (!product) {
            throw new HttpError(404, "Product not found");
        }

        res.json(safeJson(product));
    } catch (error) {
        next(error);
    }
});
