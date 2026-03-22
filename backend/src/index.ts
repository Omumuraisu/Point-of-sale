import cors from "cors";
import express from "express";
import morgan from "morgan";
import { catalogRouter } from "./routes/catalog.routes.js";
import { categoriesRouter } from "./routes/categories.routes.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { optionalAuthGuard } from "./middleware/optionalAuthGuard.js";
import { productsRouter } from "./routes/products.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import { transactionsRouter } from "./routes/transactions.routes.js";

const app = express();

app.use(
    cors({
        origin: env.ADMIN_FRONTEND_URL ?? "*"
    })
);
app.use(express.json());
app.use(morgan("dev"));
app.use("/api", optionalAuthGuard);

app.use("/api", healthRouter);
app.use("/api", categoriesRouter);
app.use("/api", catalogRouter);
app.use("/api", productsRouter);
app.use("/api", transactionsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(env.PORT, () => {
    console.log(`Backend listening on port ${env.PORT}`);
});

const shutdown = async () => {
    await prisma.$disconnect();
    server.close(() => {
        process.exit(0);
    });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);