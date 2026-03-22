import { prisma } from "../src/config/prisma.js";

async function main() {
    console.log("Seed script placeholder. Add initial records here when needed.");
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });