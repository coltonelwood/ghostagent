import pino from "pino";

const isDev = process.env.NODE_ENV === "development";
const isEdge = typeof process.env.NEXT_RUNTIME === "string" && process.env.NEXT_RUNTIME === "edge";

// Edge runtime doesn't support pino transports
const logger = isEdge
  ? pino({ level: "info" })
  : pino({
      level: process.env.LOG_LEVEL ?? "info",
      ...(isDev
        ? {
            transport: {
              target: "pino-pretty",
              options: { colorize: true, ignore: "pid,hostname" },
            },
          }
        : {
            // Production: JSON to stdout (Vercel captures this)
            formatters: {
              level(label) {
                return { level: label };
              },
            },
          }),
    });

export default logger;
export { logger };

// Scoped child loggers for each domain
export const apiLogger = logger.child({ module: "api" });
export const scanLogger = logger.child({ module: "scanner" });
export const authLogger = logger.child({ module: "auth" });
export const stripeLogger = logger.child({ module: "stripe" });
