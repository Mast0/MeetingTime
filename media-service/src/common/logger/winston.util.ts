import * as winston from 'winston';
import {
  utilities as nestWinstonModuleUtilities,
  WinstonModule,
} from 'nest-winston';
import * as winstonDaily from 'winston-daily-rotate-file';

import { SeqTransport } from '@datalust/winston-seq';

const SERVICE_NAME = 'media-service';

// ─── Seq URL (falls back gracefully if Seq is not running) ───────────────────
const seqUrl =
  process.env.SEQ_URL ||
  (process.env.NODE_ENV === 'production' ? 'http://seq:5341' : 'http://localhost:5341');

const dailyOption = (level: string) => {
  return {
    level,
    datePattern: 'YYYY-MM-DD',
    dirname: `./logs/${level}`,
    filename: `%DATE%.${level}.log`,
    maxFiles: 30,
    zippedArchive: true,
    format: winston.format.combine(
      winston.format.timestamp(),
      nestWinstonModuleUtilities.format.nestLike(SERVICE_NAME, {
        colors: false,
        prettyPrint: true,
      }),
    ),
  };
};

export const winstonLogger = WinstonModule.createLogger({
  defaultMeta: { app: SERVICE_NAME },
  transports: [
    // ── Console — pretty colored output for local development ───────────────
    new winston.transports.Console({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'silly',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        nestWinstonModuleUtilities.format.nestLike(SERVICE_NAME, {
          prettyPrint: true,
        }),
      ),
    }),

    // ── Seq — structured JSON for centralized log aggregation ───────────────
    new SeqTransport({
      serverUrl: seqUrl,
      onError: (err: Error) => {
        // Don't crash the service if Seq is unreachable
        console.error('[winston-seq] Failed to ship log to Seq:', err.message);
      },
    }),

    // ── Daily rotating files (warn + error persist to disk) ─────────────────
    new winstonDaily(dailyOption('warn')),
    new winstonDaily(dailyOption('error')),
  ],
});
