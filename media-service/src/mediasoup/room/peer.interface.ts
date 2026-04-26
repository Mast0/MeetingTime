import { IConsumer, IProducer, ITransport } from "../interface/media-resources.interfaces";

export interface Peer {
    id: string;
    userId: string;
    displayName: string;
    transports: Map<string, ITransport>;
    producers: Map<string, IProducer>;
    consumers: Map<string, IConsumer>;
}