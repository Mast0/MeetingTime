import { Module } from "@nestjs/common";
import { RoomModule } from "../room/room.module";
import { ProducerConsumerService } from "./producer-consumer.service";

@Module({
    imports: [RoomModule],
    providers: [ProducerConsumerService],
    exports: [ProducerConsumerService]
})
export class ProducerConsumerModule {}