import { Router, Transport, Producer } from "mediasoup/node/lib/types";

export interface ITransportInfo {
    sendTransport?: Transport;
    recvTransport?: Map<string, Transport>;
}

export interface IProducerInfo {
    audio?: Producer;
    camera?: Producer;
    display?: Producer;
}

export interface IConsumerInfo {
    audio?: Producer;
    camera?: Producer;
    display?: Producer;
}

export interface IMediaResources {
    transports?: ITransportInfo;
    producers?: IProducerInfo;
    consumers?: Map<string, IConsumerInfo>
}

export type IMediaResourcesMap = Map<string, IMediaResources>;

export interface IRoom {
    router: Router;
    users: Set<string>;
}