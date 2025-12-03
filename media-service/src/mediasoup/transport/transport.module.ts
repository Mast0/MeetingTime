import { Module } from "@nestjs/common";
import { RoomModule } from "../room/room.module";
import { TransportService } from "./transport.service";

@Module({
    imports: [RoomModule],
    providers: [TransportService],
    exports: [TransportService],
})
export class TransportModule {}