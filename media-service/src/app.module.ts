import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { MediasoupModule } from './mediasoup/mediasoup.module';
import { ProducerConsumerModule } from './mediasoup/producer-consumer/producer-consumer.module';
import { SignalingModule } from './signaling/signaling.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HttpModule,
    MediasoupModule,
    SignalingModule,
    ProducerConsumerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
