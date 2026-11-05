import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";

async function startServer(): Promise<void> {
  await prisma.$connect();
  console.log("Database connected successfully");

  const server = app.listen(env.PORT, () => {
    console.log(`Server listening on port ${env.PORT}`);
  });

  const shutdown = (signal: NodeJS.Signals): void => {
    console.log(`${signal} received; shutting down`);
    server.close((error) => {
      if (error) {
        console.error("Failed to close the HTTP server", error);
        process.exitCode = 1;
      }

      void prisma
        .$disconnect()
        .catch((disconnectError: unknown) => {
          console.error("Failed to disconnect Prisma", disconnectError);
          process.exitCode = 1;
        });
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

startServer().catch(async (error: unknown) => {
  console.error("Failed to start the server", error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
