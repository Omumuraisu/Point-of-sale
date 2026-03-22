import type { NextFunction, Request, Response } from "express";

export class HttpError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
    next(new HttpError(404, "Route not found"));
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = status === 500 ? "Internal server error" : err.message;

    if (status === 500) {
        // Keep production responses generic while preserving server logs.
        console.error(err);
    }

    res.status(status).json({
        error: message
    });
}