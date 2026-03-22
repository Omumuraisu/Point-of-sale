import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    DIRECT_URL: z.string().min(1, "DIRECT_URL is required"),
    ADMIN_FRONTEND_URL: z.string().optional(),
    AUTH_GUARD_ENABLED: z
        .string()
        .optional()
        .transform((val) => val === "true"),
    AUTH_GUARD_TOKEN: z.string().optional(),
    TX_SYNC_DEBUG: z
        .string()
        .optional()
        .transform((val) => val === "true"),
    ALLOW_INSECURE_DB_SSL: z
        .string()
        .optional()
        .transform((val) => val === "true")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    const message = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
        .join("; ");
    throw new Error(`Invalid environment variables: ${message}`);
}

export const env = parsed.data;