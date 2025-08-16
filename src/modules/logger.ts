import pino from "pino";

const { LOG_LEVEL } = process.env;

const pinoOptions: pino.LoggerOptions = {
  level: LOG_LEVEL ?? "info",
  timestamp: pino.stdTimeFunctions.isoTime,
};

if (process.env.NODE_ENV !== "production") {
  pinoOptions.transport = {
    target: "pino-pretty",
    options: {
      translateTime: true,
      colorize: true,
    },
  };
}

export const logger = pino(pinoOptions);
