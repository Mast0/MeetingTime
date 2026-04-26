import { IsNotEmpty, IsString } from "class-validator";

export class JoinChannelDto {
    @IsNotEmpty()
    @IsString()
    roomId: string;

    @IsNotEmpty()
    @IsString()
    peerId: string;

    @IsString()
    displayName?: string;

    @IsString()
    userId?: string;
}