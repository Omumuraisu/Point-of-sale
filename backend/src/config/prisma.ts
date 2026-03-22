import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "./env.js";

const globalForPrisma = globalThis as unknown as {
    prisma?: PrismaClient;
};

const appendQueryParam = (url: string, key: string, value: string): string => {
    if (new RegExp(`[?&]${key}=`).test(url)) {
        return url;
    }

    return `${url}${url.includes("?") ? "&" : "?"}${key}=${value}`;
};

const isSupabasePooler = /pooler\.supabase\.com/i.test(env.DATABASE_URL);

let datasourceUrl = env.ALLOW_INSECURE_DB_SSL
    ? appendQueryParam(env.DATABASE_URL, "sslmode", "require")
    : env.DATABASE_URL;

if (isSupabasePooler) {
    // Supabase transaction poolers require PgBouncer-safe Prisma settings.
    datasourceUrl = appendQueryParam(datasourceUrl, "pgbouncer", "true");
    datasourceUrl = appendQueryParam(datasourceUrl, "connection_limit", "1");
}

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        datasources: {
            db: {
                url: datasourceUrl
            }
        }
    });

if (env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}