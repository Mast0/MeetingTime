import React, { useState, useEffect, useContext, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { Device } from "mediasoup-client";
import '../styles/CallPage.css';
import { io, Socket } from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";
import type { Producer, Transport, TransportOptions } from "mediasoup-client/types";

const CallPage: React.FC = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [device, setDevice] = useState<Device | null>(null);
    const [sendTransport, setSendTransport] = useState<Transport | null>(null);
    const [recvTransport, setRecvTransport] = useState<Transport | null>(null);
    const [joined, setJoined] = useState(false);
    const [roomId, setRoomId] = useState("");
    const [peers, setPeers] = useState<any[]>([]);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [videoProducer, setVideoProducer] = useState<Producer | null>(null);
    const [audioProducer, setAudioProducer] = useState<Producer | null>(null);
    const [screenProducer, setScreenProducer] = useState<Producer | null>(null);
    const [micOn, setMicOn] = useState(false);
    const [camOn, setCamOn] = useState(false);
    const [screenOn, setScreenOn] = useState(false);
    const localVideoRef = useRef<any>(null);
    const deviceRef = useRef<Device>(null);
    const recvTransportRef = useRef<Transport>(null);

    useEffect(() => {
        const newSocket = io(import.meta.env.VITE_MEDIA_SERVER_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log("Connected to server:", newSocket.id);
        })

        newSocket.on("new-peer", ({ peerId }) => {
            setPeers((prevPeers) => [...prevPeers, peerId]);
        })

        newSocket.on("peer-left", ({ peerId }) => {
            setPeers((prevPeers) => prevPeers.filter((id) => id !== peerId));
        })

        return () => {
            newSocket.close();
        }
    }, []);

    const createDevice = async (rtpCapabilities: any) => {
        const newDevice = new mediasoupClient.Device();
        await newDevice.load({ routerRtpCapabilities: rtpCapabilities });
        setDevice(newDevice);
        deviceRef.current = newDevice;
        return newDevice;
    };

    const createSendTransport = (device: Device, transportOptions: TransportOptions) => {
        console.log(device);
        const newSendTransport = device.createSendTransport(transportOptions);
        newSendTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
            try {
                socket?.emit("connect-transport", {
                    transportId: newSendTransport.id,
                    dtlsParameters,
                    roomId,
                    peerId: socket.id,
                });
                callback();
            } catch (err: any) {
                errback(err);
            }
        });

        newSendTransport.on("produce", ({ kind, rtpParameters }, callback, errback) => {
            try {
                socket?.emit("produce", {
                    transportId: newSendTransport.id,
                    kind,
                    rtpParameters,
                    roomId,
                    peerId: socket.id
                },
                (producerId: string) => {
                    callback({ id: producerId });
                });
            } catch (err: any) {
                errback(err);
            }
        });

        setSendTransport(newSendTransport);
        return newSendTransport;
    };

    const createRecvTransport = (device: Device, transportOptions: TransportOptions) => {
        const newRecvTransport = device.createRecvTransport(transportOptions);

        newRecvTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
            try {
                socket?.emit("connect-transport", {
                    transportId: newRecvTransport.id,
                    dtlsParameters,
                    roomId,
                    peerId: socket.id
                });
                callback();
            } catch (err: any) {
                errback(err);
            }
        });

        setRecvTransport(newRecvTransport);
        recvTransportRef.current = newRecvTransport;
        return newRecvTransport;
    };

    const getLocalAudioStreamTrack = async () => {
        const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
        });
        const audioTrack = audioStream.getAudioTracks()[0];
        return audioTrack;
    };

    const joinRoom = () => {
        if (!socket || !roomId) return;

        socket.emit("join-room", {
            roomId, 
            peerId: socket.id
        },
        async (response: any) => {
            if (response.error) {
                console.error("Error joining room:", response.error);
                return;
            }

            const {
                sendTransportOptions,
                recvTransportOptions,
                rtpCapabilities,
                peerIds,
                existingProducers,
            } = response;
            const newDevice = await createDevice(rtpCapabilities);

            const newSendTransport = createSendTransport(
                newDevice,
                sendTransportOptions
            );

            const newRecvTransport = createRecvTransport(
                newDevice,
                recvTransportOptions
            );

            socket.on("new-producer", handleNewProducer);

            const audioTrack = await getLocalAudioStreamTrack();
            const newAudioProducer = await newSendTransport.produce({
                track: audioTrack,
            });

            setAudioProducer(newAudioProducer);

            setPeers(peerIds.filter((id: string) => id !== socket.id));

            for (const producerInfo of existingProducers) {
                await consume(producerInfo);
            }

            setJoined(true);
        });
    }

    const leaveRoom = () => {
        if (!socket) return;

        socket.emit("leave-room", (response: any) => {
            if (response && response.error) {
                console.error("Error leaving room:", response.error);
                return;
            }

            setJoined(false);
            setPeers([]);

            if (localStream) {
                localStream.getTracks().forEach((track) => track.stop());
                setLocalStream(null);
            }
            if (sendTransport) {
                sendTransport.close();
                setSendTransport(null);
            }
            if (recvTransport) {
                recvTransport.close();
                setRecvTransport(null);
            }
            if (device) {
                setDevice(null);
            }
            setMicOn(false);
            setCamOn(false);
            setScreenOn(false);

            socket.off("new-producer", handleNewProducer);
        });
    };

    const startCamera = async () => {
        if (!sendTransport) return;

        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
        });
        setLocalStream(stream);

        if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
        }

        const videoTrack = stream.getVideoTracks()[0];

        const newVideoProducer = await sendTransport.produce({ track: videoTrack });
        setVideoProducer(newVideoProducer);
    };

    const stopCamera = () => {
        if (localStream) {
            localStream.getTracks().forEach((track) => track.stop());
            setLocalStream(null);
        }
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }
        if (videoProducer) {
            videoProducer.close();
            setVideoProducer(null);
        }
        if (audioProducer) {
            audioProducer.close();
            setAudioProducer(null);
        }
    };

    const startScreenShare = async () => {
        if (!sendTransport) return;

        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
        });

        const screenTrack = stream.getVideoTracks()[0];

        const newScreenProducer = await sendTransport.produce({
            track: screenTrack
        });
        setScreenProducer(newScreenProducer);
        
        screenTrack.onended = () => {
            stopScreenShare();
        };
    };

    const stopScreenShare = () => {
        if (screenProducer) {
            screenProducer.close();
            setScreenProducer(null);
        }
    };

    const handleNewProducer = async ({ producerId, peerId, kind }: any) => {
        await consume({ producerId, peerId, kind });
    };

    const consume = async ({ producerId, peerId, kind }: any) => {
        const device = deviceRef.current;
        const recvTransport = recvTransportRef.current;
        if (!device || !recvTransport) {
            console.log("Device or Recvtransport not initialized");
            return;
        }

        socket?.emit("consume", {
            transportId: recvTransport?.id,
            producerId,
            roomId,
            peerId: socket.id,
            rtpCapabilities: device.rtpCapabilities,
        },
        async (response: any) => {
            if (response.error) {
                console.error("Error consuming", response.error);
                return;
            }

            const { consumerData } = response;

            const consumer = await recvTransport.consume({
                id: consumerData.id,
                producerId: consumerData.producerId,
                kind: consumerData.kind,
                rtpParameters: consumerData.rtpParameters,
            });

            await consumer.resume();

            const remoteStream = new MediaStream();
            remoteStream.addTrack(consumer.track);

            if (consumer.kind === "video") {
                const videoElemet = document.createElement("video");
                videoElemet.srcObject = remoteStream;
                videoElemet.autoplay = true;
                videoElemet.playsInline = true;
                videoElemet.width = 200;
                document.getElementById("remote-media")?.appendChild(videoElemet);
            } else if (consumer.kind === "audio") {
                const audioElement = document.createElement("audio");
                audioElement.srcObject = remoteStream;
                audioElement.autoplay = true;
                audioElement.controls = true;
                document.getElementById("remote-media")?.appendChild(audioElement);

                try {
                    await audioElement.play();
                } catch (err) {
                    console.error("Audio playback failed:", err);
                }
            }
        });
    };

    return (
        <div className="call-page d-flex flex-column vh-100 bg-dark text-white">
            <div className="call-header p-3 border-bottom border-secondary d-flex justify-content-between">
                <h5 className="mb-0 text-success">Call: {roomId ? roomId : "-"}</h5>
                <button className="btn btn-danger" onClick={leaveRoom}>End Call</button>
                <div>
                    <input
                        type="text"
                        placeholder="Room ID"
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value)}
                    />
                    <button className="btn btn-success" onClick={joinRoom}>Start Call</button>
                </div>
            </div>
            <div id="remote-media" className="call-videos flex-grow-1 d-flex flex-wrap justify-content-center align-items-center"></div>
            <video ref={localVideoRef} className="video-element local" autoPlay muted playsInline />
            <div className="call-controls p-3 d-flex justify-content-center">
                <button
                    className={"btn me-2 " + (micOn ? 'btn-success' : 'btn-outline-danger')}
                    onClick={() => {
                        setMicOn(!micOn);
                    }}
                >
                    {micOn ? 'Mic On' : 'Mic Off'}
                </button>
                <button
                    className={"btn " + (camOn ? 'btn-success' : 'btn-outline-danger')}
                    onClick={() => {
                        setCamOn(!camOn);
                        startCamera();
                    }}
                >
                    {camOn ? 'Cam On' : 'Cam Off'}
                </button>
                <button
                    className={"btn " + (screenOn ? 'btn-success' : 'btn-outline-danger')}
                    onClick={() => {
                        setScreenOn(!screenOn);
                        startScreenShare();
                    }}
                >
                    {screenOn ? 'Screen On' : 'Screen Off'}
                </button>
            </div>
        </div>
    );
};

export default CallPage;