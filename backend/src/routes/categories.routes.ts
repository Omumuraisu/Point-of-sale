import { Router } from "express";
import { listCategories } from "../services/categories.service.js";
import { safeJson } from "../utils/safeJson.js";

export const categoriesRouter = Router();

categoriesRouter.get("/categories", async (_req, res, next) => {
    try {
        const categories = await listCategories();
        res.json(safeJson(categories));
    } catch (error) {
        next(error);
    }
});
