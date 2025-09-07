import pino from "pino";

export type LogTransport = "pretty" | "syslog";

class LoggerManager {
  private static instance: pino.Logger;
  private static transport: LogTransport = "pretty";

  static configure(transport: LogTransport) {
    this.transport = transport;
    this.instance = this.createLogger(transport);
  }

  static getInstance(): pino.Logger {
    if (!this.instance) {
      this.instance = this.createLogger(this.transport);
    }
    return this.instance;
  }

  private static createLogger(transport: LogTransport) {
    const pinoOptions: pino.LoggerOptions = {
      level: process.env.LOG_LEVEL ?? "info",
    };

    if (transport === "syslog") {
      pinoOptions.transport = {
        target: "pino-syslog",
        options: {
          enablePipelining: false,
          destination: 1,
          newline: true,
        },
      };
    } else {
      pinoOptions.timestamp = pino.stdTimeFunctions.isoTime;
      pinoOptions.transport = {
        target: "pino-pretty",
        options: {
          translateTime: true,
          colorize: true,
        },
      };
    }

    return pino(pinoOptions);
  }
}

// Proxyを使って動的にloggerインスタンスを取得
export const logger = new Proxy({} as pino.Logger, {
  get(_, prop) {
    const currentLogger = LoggerManager.getInstance();
    const value = currentLogger[prop as keyof pino.Logger];
    if (typeof value === "function") {
      return value.bind(currentLogger);
    }
    return value;
  },
});

export const configureLogger = (transport: LogTransport) => {
  LoggerManager.configure(transport);
};
