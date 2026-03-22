import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../middleware/errorHandler.js";
import { listCatalogProductNames } from "../services/catalog.service.js";
import { safeJson } from "../utils/safeJson.js";

const listCatalogProductsSchema = z.object({
    categoryId: z.string().optional(),
    category_id: z.string().optional(),
    businessId: z.union([z.string(), z.number(), z.bigint()]).optional(),
    business_id: z.union([z.string(), z.number(), z.bigint()]).optional(),
    limit: z.coerce.number().int().positive().max(200).optional()
}).transform((value) => ({
    categoryId: value.categoryId ?? value.category_id,
    businessId: value.businessId ?? value.business_id,
    limit: value.limit
}));

export const catalogRouter = Router();

catalogRouter.get("/catalog/products", async (req, res, next) => {
    try {
        const parsed = listCatalogProductsSchema.safeParse(req.query);
        if (!parsed.success) {
            throw new HttpError(400, "Invalid query parameters");
        }

        const productNames = await listCatalogProductNames({
            categoryId: parsed.data.categoryId,
            businessId:
                parsed.data.businessId !== undefined
                    && /^\d+$/.test(String(parsed.data.businessId))
                    ? BigInt(parsed.data.businessId)
                    : undefined,
            limit: parsed.data.limit
        });

        res.json(safeJson(productNames));
    } catch (error) {
        next(error);
    }
});
