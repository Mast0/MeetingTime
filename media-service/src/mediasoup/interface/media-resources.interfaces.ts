import {
    Consumer,
    DtlsParameters,
    Producer,
    Router,
    WebRtcTransport,
    Worker,
} from 'mediasoup/node/lib/types'

export interface ITransportData {
    isConsumer?: boolean;
    roomId?: string;
    socketId: string;
    producerSocketId?: string;
}

export interface TransportConnectData {
    dtlsParameters: DtlsParameters;
    isConsumer: boolean;
}

export interface IWorker {
    worker: Worker;
    routers: Map<string, Router>;
}

export interface IRouter {
  router: Router;
}

export interface ITransport {
    transport: WebRtcTransport;
}

export interface IProducer {
    producer: Producer;
}

export interface IConsumer {
    consumer: Consumer;
}