import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { winstonLogger } from './common/logger/winston.util';
import * as passport from 'passport';
import * as cookieParser from 'cookie-parser';

class Application {
  private logger = new Logger(Application.name);
  private DEV_MODE: boolean;
  private PORT: string;
  private corsOriginList: string[];
  private Domain: string;

  constructor(private server: NestExpressApplication) {
    this.server = server;

    if (!process.env.SECRET_KEY) this.logger.error('Set "SECRET" env');
    this.DEV_MODE = process.env.NODE_ENV === 'production' ? false : true;
    this.PORT = process.env.PORT || '5000';
    this.corsOriginList = process.env.CORS_ORIGIN_LIST
      ? process.env.CORS_ORIGIN_LIST.split(',').map((origin) => origin.trim())
      : ['*'];
    this.Domain = process.env.DOMAIN || 'http://localhost';
  }
  private setUpOpenAPIMidleware() {
    SwaggerModule.setup(
      'api-docs',
      this.server,
      SwaggerModule.createDocument(
        this.server,
        new DocumentBuilder()
          .setTitle('API DOCS')
          .setDescription('nestJS boilerplate')
          .setVersion('1.0')
          .build(),
      ),
    );
  }

  private async setUpGlobalMiddleware() {
    this.server.enableCors({
      origin: this.corsOriginList,
      credentials: true,
    });
    this.server.use(cookieParser());
    this.setUpOpenAPIMidleware();
    this.server.useGlobalPipes(
      new ValidationPipe({
        transform: true,
      }),
    );
    this.server.use(passport.initialize());
    this.server.useGlobalInterceptors(
      new ClassSerializerInterceptor(this.server.get(Reflector)),
    );
  }

  async bootstrap() {
    await this.setUpGlobalMiddleware();
    await this.server.listen(this.PORT);
  }

  startLog() {
    if (this.DEV_MODE) {
      this.logger.log(`✅ Server on ${this.Domain}:${this.PORT}`);
    } else {
      this.logger.log(`✅ Server on port ${this.PORT}...`);
    }
  }

  errorLog(error: string) {
    this.logger.error(`🆘 Server error ${error}`);
  }
}

async function init(): Promise<void> {
  const server = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: winstonLogger,
  });
  const app = new Application(server);
  await app.bootstrap();
  app.startLog();
}

init().catch((error) => {
  new Logger('init').error(error);
});

