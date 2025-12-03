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
        }

        @SubscribeMessage('join-room')
        async handleJoinChannel(
            @MessageBody() dto: JoinChannelDto,
            @ConnectedSocket() client: Socket,
        ) {
            const { roomId, peerId } = dto;

            try {
                const newRoom = await this.roomService.createRoom(roomId);
                const sendTransportOptions = 
                    await this.transportService.createWebRtcTransport(
                        roomId, peerId, 'send'
                    );

                const recvTransportOptions = 
                    await this.transportService.createWebRtcTransport(
                        roomId, peerId, 'recv'
                    );
                
                client.join(roomId);

                const room = this.roomService.getRoom(roomId)!;
                const peerIds = Array.from(room.peers.keys());

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

                client.emit('update-peer-list', { peerIds });

                client.to(roomId).emit('new-peer', { peerId });

                return {
                    sendTransportOptions,
                    recvTransportOptions,
                    rtpCapabilities: newRoom.router.router.rtpCapabilities,
                    peerIds,
                    existingProducers,
                };
            } catch (err) {
                console.error(err);
                client.emit('join-room-error', { error: err.message });
            }
        }

        @SubscribeMessage('leave-room')
        async handleLeaveRoom(@ConnectedSocket() client: Socket) {
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
            return { left: true };
        }

        @SubscribeMessage('connect-transport')
        async handleConnectTransport(
            @MessageBody() data,
            @ConnectedSocket() client: Socket,
        ) {
            const { roomId, peerId, dtlsParameters, transportId } = data;
            const room = this.roomService.getRoom(roomId);
            const peer = room?.peers.get(peerId);
            if (!peer) {
                return { error: 'Peer not found' };
            }
            const transportData = peer.transports.get(transportId);
            if (!transportData) {
                return { error: 'Transport not found' };
            }
            await transportData.transport.connect({ dtlsParameters });
            console.log('>> transport connected');

            return { connected: true };
        }

        @SubscribeMessage('produce')
        async handleProduce(
            @MessageBody() data,
            @ConnectedSocket() client: Socket
        ) {
            const { roomId, peerId, kind, transportId, rtpParameters } = data;

            try {
                const producerId = await this.producerConsumerService.createProducer({
                    roomId,
                    peerId,
                    transportId,
                    kind,
                    rtpParameters,
                });

                client.to(roomId).emit('new-producer', { producerId, peerId, kind });

                return { producerId };
            } catch (err) {
                console.error(err);
                client.emit('produce-error', { error: err.message });
            }
        }

        @SubscribeMessage('consume')
        async handleConsume(
            @MessageBody() data,
            @ConnectedSocket() client: Socket
        ) {
            const { roomId, peerId, producerId, rtpCapabilities, transportId } = data;

            try {
                const consumerData = await this.producerConsumerService.createConsumer({
                    roomId,
                    peerId,
                    transportId,
                    producerId,
                    rtpCapabilities,
                });

                return { consumerData };
            } catch (err) {
                console.error(err);
                client.emit('consume-error', { error: err.message });
            }
        }
    }