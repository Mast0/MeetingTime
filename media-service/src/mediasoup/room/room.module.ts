import { forwardRef, Module } from "@nestjs/common";
import { MediasoupModule } from "../mediasoup.module";
import { RoomService } from "./room.service";

@Module({
    imports: [forwardRef(() => MediasoupModule)],
    providers: [RoomService],
    exports: [RoomService],
})
export class RoomModule {}