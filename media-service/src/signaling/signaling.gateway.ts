import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JoinChannelDto } from './dto/join-channel.dto';
import { RoomService } from 'src/mediasoup/room/room.service';
import { TransportService } from 'src/mediasoup/transport/transport.service';
import { ProducerConsumerService } from 'src/mediasoup/producer-consumer/producer-consumer.service';

@WebSocketGateway({
    cors: {
        origin: 'http://localhost:5173',
        credentials: true,
    },
})
export class SignalingGateway 
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
        @WebSocketServer()
        server: Server;

        constructor (
            private readonly roomService: RoomService,
            private readonly transportService: TransportService,
            private readonly producerConsumerService: ProducerConsumerService,
        ) {}

        afterInit() {
            console.log(`Server initialized`);
        }

        handleConnection(client: Socket) {
            console.log(`Client connected: ${client.id}`);
        }

        async handleDisconnect(client: Socket) {
            console.log(`Client disconnected ${client.id}`);
            await this.cleanupPeer(client);
        }

        private async cleanupPeer(client: Socket) {
            const rooms = Array.from(client.rooms);

            for (const roomId of rooms) {
                if (roomId !== client.id) {
                    const room = this.roomService.getRoom(roomId);
                    if (room) {
                        const peer = room.peers.get(client.id);
                        if (peer) {
                            for (const producer of peer.producers.values()) {
                                producer.producer.close();
                            }
                            for (const consumer of peer.consumers.values()) {
                                consumer.consumer.close();
                            }
                            for (const transport of peer.transports.values()) {
                                transport.transport.close();
                            }
                            room.peers.delete(client.id);
                        }
                        client.leave(roomId);
                        client.to(roomId).emit('peer-left', { peerId: client.id });
                        if (room.peers.size === 0) {
                            this.roomService.removeRoom(roomId);
                        }
                    }
                }
            }
        }

        // Using raw socket handlers with manual ack callbacks to avoid
        // any NestJS response wrapping. This ensures the client receives
        // exactly what we send, not { event, data } wrappers.
        @SubscribeMessage('join-room')
        async handleJoinChannel(
            @MessageBody() dto: JoinChannelDto,
            @ConnectedSocket() client: Socket,
        ) {
            const { roomId, peerId, displayName, userId } = dto;

            try {
                const newRoom = await this.roomService.createRoom(roomId);

                // Evict any stale peer with the same userId (handles page reloads)
                const evictedPeerId = this.roomService.evictPeerByUserId(roomId, userId || '', peerId);
                if (evictedPeerId) {
                    // Notify others that the old peer is gone
                    client.to(roomId).emit('peer-left', { peerId: evictedPeerId });
                }

                this.roomService.addPeerToRoom(roomId, peerId, displayName || 'Guest', userId || '');

                const sendTransportOptions = 
                    await this.transportService.createWebRtcTransport(
                        roomId, peerId, 'send'
                    );
                console.log(`>> send transport created: ${sendTransportOptions.id}`);

                const recvTransportOptions = 
                    await this.transportService.createWebRtcTransport(
                        roomId, peerId, 'recv'
                    );
                console.log(`>> recv transport created: ${recvTransportOptions.id}`);
                
                client.join(roomId);

                const room = this.roomService.getRoom(roomId)!;

                // Build peer info list with displayName
                const peerInfos: { peerId: string; displayName: string }[] = [];
                for (const [id, peer] of room.peers) {
                    peerInfos.push({ peerId: id, displayName: peer.displayName });
                }

                const existingProducers: any[] = [];
                for (const [otherPeerId, peer] of room.peers) {
                    if (otherPeerId !== peerId) {
                        for (const producer of peer.producers.values()) {
                            existingProducers.push({
                                producerId: producer.producer.id,
                                peerId: otherPeerId,
                                kind: producer.producer.kind,
                            });
                        }
                    }
                }

                client.emit('update-peer-list', { peerInfos });
                client.to(roomId).emit('new-peer', { peerId, displayName: displayName || 'Guest' });

                return {
                    sendTransportOptions,
                    recvTransportOptions,
                    rtpCapabilities: newRoom.router.router.rtpCapabilities,
                    peerInfos,
                    existingProducers,
                };
            } catch (err) {
                console.error(err);
                return { error: err.message };
            }
        }

        @SubscribeMessage('leave-room')
        async handleLeaveRoom(@ConnectedSocket() client: Socket) {
            await this.cleanupPeer(client);
            return { left: true };
        }

        @SubscribeMessage('connect-transport')
        async handleConnectTransport(
            @MessageBody() data,
            @ConnectedSocket() client: Socket,
        ) {
            const { roomId, peerId, dtlsParameters, transportId } = data;
            console.log(`>> connect-transport request: transport=${transportId}, peer=${peerId}`);
            const room = this.roomService.getRoom(roomId);
            const peer = room?.peers.get(peerId);
            if (!peer) {
                console.error(`>> connect-transport: peer ${peerId} not found`);
                return { error: 'Peer not found' };
            }
            const transportData = peer.transports.get(transportId);
            if (!transportData) {
                console.error(`>> connect-transport: transport ${transportId} not found`);
                return { error: 'Transport not found' };
            }
            try {
                await transportData.transport.connect({ dtlsParameters });
                console.log(`>> transport connected successfully: ${transportId}`);
                return { connected: true };
            } catch (err) {
                console.error(`>> transport connect FAILED: ${transportId}`, err);
                return { error: err.message };
            }
        }

        @SubscribeMessage('produce')
        async handleProduce(
            @MessageBody() data,
            @ConnectedSocket() client: Socket,
        ) {
            const { roomId, peerId, kind, transportId, rtpParameters } = data;
            console.log(`>> produce request: kind=${kind}, transport=${transportId}, peer=${peerId}`);

            try {
                const producerId = await this.producerConsumerService.createProducer({
                    roomId,
                    peerId,
                    transportId,
                    kind,
                    rtpParameters,
                });

                console.log(`>> producer created: ${producerId}, kind=${kind}`);
                client.to(roomId).emit('new-producer', { producerId, peerId, kind });

                // Return raw producerId string for the ack callback
                return producerId;
            } catch (err) {
                console.error('>> produce FAILED:', err);
                return { error: err.message };
            }
        }

        @SubscribeMessage('consume')
        async handleConsume(
            @MessageBody() data,
            @ConnectedSocket() client: Socket,
        ) {
            const { roomId, peerId, producerId, rtpCapabilities, transportId } = data;
            console.log(`>> consume request: producerId=${producerId}, peer=${peerId}`);

            try {
                const consumerData = await this.producerConsumerService.createConsumer({
                    roomId,
                    peerId,
                    transportId,
                    producerId,
                    rtpCapabilities,
                });

                console.log(`>> consumer created: ${consumerData.id}, kind=${consumerData.kind}`);
                return { consumerData };
            } catch (err) {
                console.error('>> consume FAILED:', err);
                return { error: err.message };
            }
        }

        @SubscribeMessage('close-producer')
        async handleCloseProducer(
            @MessageBody() data,
            @ConnectedSocket() client: Socket,
        ) {
            const { roomId, producerId } = data;
            console.log(`>> close-producer: ${producerId}`);

            try {
                const room = this.roomService.getRoom(roomId);
                if (!room) return { error: 'Room not found' };

                const peer = room.peers.get(client.id);
                if (!peer) return { error: 'Peer not found' };

                const producerData = peer.producers.get(producerId);
                if (producerData) {
                    producerData.producer.close();
                    peer.producers.delete(producerId);
                }

                client.to(roomId).emit('producer-closed', { producerId });

                return { closed: true };
            } catch (err) {
                console.error(err);
                return { error: err.message };
            }
        }

        @SubscribeMessage('resume-consumer')
        async handleResumeConsumer(
            @MessageBody() data,
            @ConnectedSocket() client: Socket,
        ) {
            const { consumerId } = data;
            console.log(`>> resume-consumer request: ${consumerId}`);

            // Find the consumer across all rooms this client is in
            const rooms = Array.from(client.rooms);
            for (const roomId of rooms) {
                if (roomId === client.id) continue;
                const room = this.roomService.getRoom(roomId);
                if (!room) continue;
                const peer = room.peers.get(client.id);
                if (!peer) continue;
                const consumerData = peer.consumers.get(consumerId);
                if (consumerData) {
                    await consumerData.consumer.resume();
                    console.log(`>> consumer resumed on server: ${consumerId}`);
                    return { resumed: true };
                }
            }
            console.error(`>> resume-consumer: consumer ${consumerId} not found`);
            return { error: 'Consumer not found' };
        }
    }