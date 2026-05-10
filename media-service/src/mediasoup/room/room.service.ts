import { Inject, Injectable } from "@nestjs/common";
import { IRoom } from "./room.interface";
import { MediasoupService } from "../mediasoup.service";
import { mediaCodecs } from "../media.config";

@Injectable()
export class RoomService {
    private rooms: Map<string, IRoom> = new Map();
    constructor(private readonly mediasoupService: MediasoupService) {}

    public async createRoom(roomId: string): Promise<IRoom> {
        if (this.rooms.has(roomId)) {
            return this.rooms.get(roomId)!;
        }

        const worker = this.mediasoupService.getWorker();
        const router = await worker.createRouter({ mediaCodecs });
        const newRoom: IRoom = {
            id: roomId,
            router: { router },
            peers: new Map()
        };
        this.rooms.set(roomId, newRoom);

        console.log(`>> router created for room ${roomId}`);
        return newRoom;
    }

    public getRoom(roomId: string): IRoom | undefined {
        return this.rooms.get(roomId);
    }

    public removeRoom(roomId: string): void {
        this.rooms.delete(roomId);
    }

    public addPeerToRoom(roomId: string, peerId: string, displayName: string = 'Guest', userId: string = '') {
        const room = this.rooms.get(roomId);
        if (!room) {
            throw Error(`Room ${roomId} not found`);
        }

        if (!room.peers.has(peerId)) {
            room.peers.set(peerId, {
                id: peerId,
                userId,
                displayName,
                transports: new Map(),
                producers: new Map(),
                consumers: new Map(),
            });
        }
    }

    /**
     * Evict a stale peer that has the same userId.
     * Closes all transports, producers, and consumers for the old peer.
     * Returns the old peerId if found, null otherwise.
     */
    public evictPeerByUserId(roomId: string, userId: string, newPeerId: string): string | null {
        if (!userId) return null;
        const room = this.rooms.get(roomId);
        if (!room) return null;

        for (const [oldPeerId, peer] of room.peers) {
            if (peer.userId === userId && oldPeerId !== newPeerId) {
                // Close all mediasoup resources for the stale peer
                for (const producer of peer.producers.values()) {
                    producer.producer.close();
                }
                for (const consumer of peer.consumers.values()) {
                    consumer.consumer.close();
                }
                for (const transport of peer.transports.values()) {
                    transport.transport.close();
                }
                room.peers.delete(oldPeerId);
                console.log(`>> evicted stale peer ${oldPeerId} (userId=${userId}) from room ${roomId}`);
                return oldPeerId;
            }
        }
        return null;
    }

    public removePeerFromRoom(roomId, peerId) {
        const room = this.rooms.get(roomId);
        if (room) {
            room.peers.delete(peerId);
        }
    }
}