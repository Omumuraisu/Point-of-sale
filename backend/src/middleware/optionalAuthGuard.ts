import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { HttpError } from "./errorHandler.js";

const parseToken = (authHeader: string | undefined): string | null => {
    if (!authHeader) {
        return null;
    }

    const trimmed = authHeader.trim();
    if (trimmed.toLowerCase().startsWith("bearer ")) {
        return trimmed.slice(7).trim();
    }

    return trimmed.length > 0 ? trimmed : null;
};

export const optionalAuthGuard = (req: Request, _res: Response, next: NextFunction) => {
    if (!env.AUTH_GUARD_ENABLED) {
        next();
        return;
    }

    const expectedToken = env.AUTH_GUARD_TOKEN;
    if (!expectedToken) {
        next(new HttpError(500, "AUTH_GUARD_ENABLED requires AUTH_GUARD_TOKEN"));
        return;
    }

    // Allow health endpoint unauthenticated for uptime/infra probes.
    if (req.path === "/health") {
        next();
        return;
    }

    const headerToken = parseToken(req.header("authorization"));
    const appToken = req.header("x-app-token")?.trim() || null;
    const provided = headerToken ?? appToken;

    if (provided !== expectedToken) {
        next(new HttpError(401, "Unauthorized"));
        return;
    }

    next();
};
