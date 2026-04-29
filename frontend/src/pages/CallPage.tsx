import React, { useState, useEffect, useRef, useCallback, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Device } from "mediasoup-client";
import '../styles/CallPage.css';
import { io, Socket } from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";
import type { Consumer, Producer, Transport, TransportOptions } from "mediasoup-client/types";
import { AuthContext } from "../context/AuthContext";
import ParticipantTile from "../components/ParticipantTile";

// ─── Types ───

interface PeerInfo {
    peerId: string;
    displayName: string;
}

interface PeerMediaState {
    videoStream: MediaStream | null;
    audioStream: MediaStream | null;
}

interface ConsumerEntry {
    consumer: Consumer;
    peerId: string;
    producerId: string;
    kind: 'audio' | 'video';
}

// ─── Speaking Detection Helper ───

function createSpeakingDetector(
    stream: MediaStream,
    onSpeakingChange: (speaking: boolean) => void,
    threshold = 15,
): () => void {
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let wasSpeaking = false;
    let rafId: number;

    const check = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const isSpeaking = avg > threshold;

        if (isSpeaking !== wasSpeaking) {
            wasSpeaking = isSpeaking;
            onSpeakingChange(isSpeaking);
        }
        rafId = requestAnimationFrame(check);
    };

    check();

    return () => {
        cancelAnimationFrame(rafId);
        source.disconnect();
        audioCtx.close();
    };
}

// ─── Component ───

const CallPage: React.FC = () => {
    const { roomId: urlRoomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();
    const { userName, userId } = useContext(AuthContext);

    // ─── State ───
    const [socket, setSocket] = useState<Socket | null>(null);
    const [joined, setJoined] = useState(false);
    const [roomId, setRoomId] = useState(urlRoomId ?? "");
    const [peers, setPeers] = useState<Map<string, PeerInfo>>(new Map());
    const [peerMedia, setPeerMedia] = useState<Map<string, PeerMediaState>>(new Map());
    const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(null);
    const [localAudioStream, setLocalAudioStream] = useState<MediaStream | null>(null);
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
    const [videoProducer, setVideoProducer] = useState<Producer | null>(null);
    const [audioProducer, setAudioProducer] = useState<Producer | null>(null);
    const [screenProducer, setScreenProducer] = useState<Producer | null>(null);
    const [micOn, setMicOn] = useState(false);
    const [camOn, setCamOn] = useState(false);
    const [screenOn, setScreenOn] = useState(false);
    const [speakingPeers, setSpeakingPeers] = useState<Set<string>>(new Set());
    const [localSpeaking, setLocalSpeaking] = useState(false);

    // ─── Refs ───
    const deviceRef = useRef<Device | null>(null);
    const recvTransportRef = useRef<Transport | null>(null);
    const sendTransportRef = useRef<Transport | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const roomIdRef = useRef(roomId);
    const consumersRef = useRef<Map<string, ConsumerEntry>>(new Map());
    const speakingCleanupRef = useRef<Map<string, () => void>>(new Map());

    // Keep roomIdRef in sync
    useEffect(() => {
        roomIdRef.current = roomId;
    }, [roomId]);

    // ─── Peer Media Helpers ───

    const updatePeerMedia = useCallback((peerId: string, kind: 'audio' | 'video', stream: MediaStream | null) => {
        setPeerMedia(prev => {
            const next = new Map(prev);
            const existing = next.get(peerId) || { videoStream: null, audioStream: null };
            if (kind === 'video') {
                next.set(peerId, { ...existing, videoStream: stream });
            } else {
                next.set(peerId, { ...existing, audioStream: stream });
            }
            return next;
        });
    }, []);

    // ─── Consumer Helpers ───

    const removeConsumer = useCallback((consumerId: string) => {
        const entry = consumersRef.current.get(consumerId);
        if (entry) {
            entry.consumer.close();
            consumersRef.current.delete(consumerId);

            // Check if peer still has other consumers of this kind
            let hasOtherOfKind = false;
            for (const [, e] of consumersRef.current) {
                if (e.peerId === entry.peerId && e.kind === entry.kind) {
                    hasOtherOfKind = true;
                    break;
                }
            }
            if (!hasOtherOfKind) {
                updatePeerMedia(entry.peerId, entry.kind, null);
            }

            // Clean up speaking detector for audio
            if (entry.kind === 'audio') {
                const cleanup = speakingCleanupRef.current.get(entry.peerId);
                if (cleanup) {
                    cleanup();
                    speakingCleanupRef.current.delete(entry.peerId);
                }
                setSpeakingPeers(prev => {
                    const next = new Set(prev);
                    next.delete(entry.peerId);
                    return next;
                });
            }
        }
    }, [updatePeerMedia]);

    const removeConsumerByProducerId = useCallback((producerId: string) => {
        for (const [consumerId, entry] of consumersRef.current) {
            if (entry.producerId === producerId) {
                removeConsumer(consumerId);
            }
        }
    }, [removeConsumer]);

    const removeConsumersForPeer = useCallback((peerId: string) => {
        for (const [consumerId, entry] of consumersRef.current) {
            if (entry.peerId === peerId) {
                entry.consumer.close();
                consumersRef.current.delete(consumerId);
            }
        }
        // Clear media state for this peer
        setPeerMedia(prev => {
            const next = new Map(prev);
            next.delete(peerId);
            return next;
        });
        // Clean up speaking detector
        const cleanup = speakingCleanupRef.current.get(peerId);
        if (cleanup) {
            cleanup();
            speakingCleanupRef.current.delete(peerId);
        }
        setSpeakingPeers(prev => {
            const next = new Set(prev);
            next.delete(peerId);
            return next;
        });
    }, []);

    // ─── Socket connection ───

    useEffect(() => {
        const newSocket = io(import.meta.env.VITE_MEDIA_SERVER_URL);
        setSocket(newSocket);
        socketRef.current = newSocket;

        newSocket.on('connect', () => {
            console.log("Connected to server:", newSocket.id);
        });

        newSocket.on("new-peer", ({ peerId, displayName }: { peerId: string; displayName: string }) => {
            setPeers(prev => {
                const next = new Map(prev);
                next.set(peerId, { peerId, displayName });
                return next;
            });
        });

        newSocket.on("peer-left", ({ peerId }: { peerId: string }) => {
            setPeers(prev => {
                const next = new Map(prev);
                next.delete(peerId);
                return next;
            });
            removeConsumersForPeer(peerId);
        });

        newSocket.on("producer-closed", ({ producerId }: { producerId: string }) => {
            console.log(`Remote producer closed: ${producerId}`);
            removeConsumerByProducerId(producerId);
        });

        return () => {
            newSocket.off("producer-closed");
            newSocket.close();
            socketRef.current = null;
        };
    }, [removeConsumersForPeer, removeConsumerByProducerId]);

    // ─── Consume ───

    const consume = useCallback(async ({ producerId, peerId }: any) => {
        const device = deviceRef.current;
        const recvTransport = recvTransportRef.current;
        const sock = socketRef.current;

        if (!device || !recvTransport || !sock) {
            console.log("Device, RecvTransport, or Socket not initialized");
            return;
        }

        sock.emit("consume", {
            transportId: recvTransport.id,
            producerId,
            roomId: roomIdRef.current,
            peerId: sock.id,
            rtpCapabilities: device.rtpCapabilities,
        },
            async (rawResponse: any) => {
                console.log(">> consume ack received:", JSON.stringify(rawResponse).substring(0, 200));
                const response = rawResponse?.data ?? rawResponse;
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

                console.log(`>> consumer created: id=${consumer.id}, kind=${consumer.kind}`);

                const remoteStream = new MediaStream();
                remoteStream.addTrack(consumer.track);

                // Store consumer entry
                consumersRef.current.set(consumer.id, {
                    consumer,
                    peerId,
                    producerId: consumerData.producerId,
                    kind: consumer.kind as 'audio' | 'video',
                });

                // Update peer media state (triggers React re-render with video/audio)
                updatePeerMedia(peerId, consumer.kind as 'audio' | 'video', remoteStream);

                // Set up speaking detection for remote audio
                if (consumer.kind === 'audio') {
                    // Clean up any existing detector for this peer
                    const existingCleanup = speakingCleanupRef.current.get(peerId);
                    if (existingCleanup) existingCleanup();

                    const cleanup = createSpeakingDetector(remoteStream, (speaking) => {
                        setSpeakingPeers(prev => {
                            const next = new Set(prev);
                            if (speaking) next.add(peerId);
                            else next.delete(peerId);
                            return next;
                        });
                    });
                    speakingCleanupRef.current.set(peerId, cleanup);
                }

                // Resume consumer on server
                sock.emit('resume-consumer', { consumerId: consumer.id }, (res: any) => {
                    console.log(`>> resume-consumer ack: ${JSON.stringify(res)}`);
                });

                consumer.on('trackended', () => {
                    console.log(`Track ended for consumer ${consumer.id}`);
                    removeConsumer(consumer.id);
                });

                consumer.on('transportclose', () => {
                    console.log(`Transport closed for consumer ${consumer.id}`);
                    removeConsumer(consumer.id);
                });
            });
    }, [removeConsumer, updatePeerMedia]);

    const handleNewProducer = useCallback(async ({ producerId, peerId }: any) => {
        await consume({ producerId, peerId });
    }, [consume]);

    // ─── Transport Setup ───

    const createDevice = async (rtpCapabilities: any) => {
        const newDevice = new mediasoupClient.Device();
        await newDevice.load({ routerRtpCapabilities: rtpCapabilities });
        deviceRef.current = newDevice;
        return newDevice;
    };

    const createSendTransport = (device: Device, transportOptions: TransportOptions) => {
        const options = {
            ...transportOptions,
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        const transport = device.createSendTransport(options);
        const sock = socketRef.current;

        transport.on("connect", ({ dtlsParameters }, callback, errback) => {
            sock?.emit("connect-transport", {
                transportId: transport.id,
                dtlsParameters,
                roomId: roomIdRef.current,
                peerId: sock.id,
            }, (response: any) => {
                console.log(">> connect-transport ack:", JSON.stringify(response));
                if (response?.error) {
                    errback(new Error(response.error));
                } else if (response?.data?.error) {
                    errback(new Error(response.data.error));
                } else {
                    callback();
                }
            });
        });

        transport.on("produce", ({ kind, rtpParameters }, callback, errback) => {
            sock?.emit("produce", {
                transportId: transport.id,
                kind,
                rtpParameters,
                roomId: roomIdRef.current,
                peerId: sock?.id,
            },
                (response: any) => {
                    console.log(">> produce ack received:", JSON.stringify(response));
                    let producerId: string;
                    if (typeof response === 'string') {
                        producerId = response;
                    } else if (response?.data) {
                        producerId = response.data;
                    } else if (response?.producerId) {
                        producerId = response.producerId;
                    } else {
                        console.error(">> unexpected produce response:", response);
                        errback(new Error("Invalid produce response"));
                        return;
                    }
                    callback({ id: producerId });
                });
        });

        sendTransportRef.current = transport;
        return transport;
    };

    const createRecvTransport = (device: Device, transportOptions: TransportOptions) => {
        const options = {
            ...transportOptions,
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        const transport = device.createRecvTransport(options);
        const sock = socketRef.current;

        transport.on("connect", ({ dtlsParameters }, callback, errback) => {
            sock?.emit("connect-transport", {
                transportId: transport.id,
                dtlsParameters,
                roomId: roomIdRef.current,
                peerId: sock.id,
            }, (response: any) => {
                console.log(">> recv connect-transport ack:", JSON.stringify(response));
                if (response?.error) {
                    errback(new Error(response.error));
                } else if (response?.data?.error) {
                    errback(new Error(response.data.error));
                } else {
                    callback();
                }
            });
        });

        recvTransportRef.current = transport;
        return transport;
    };

    // ─── Producer Helpers ───

    const closeProducer = useCallback((producer: Producer) => {
        const sock = socketRef.current;
        const producerId = producer.id;
        producer.close();

        if (sock) {
            sock.emit('close-producer', {
                roomId: roomIdRef.current,
                producerId,
            });
        }
    }, []);

    // ─── Join/Leave ───

    const joinRoom = () => {
        const sock = socketRef.current;
        if (!sock || !roomId) return;

        sock.emit("join-room", {
            roomId,
            peerId: sock.id,
            displayName: userName || 'Guest',
            userId: userId || '',
        },
            async (rawResponse: any) => {
                console.log(">> join-room ack received:", JSON.stringify(rawResponse).substring(0, 200));
                const response = rawResponse?.data ?? rawResponse;
                if (response.error) {
                    console.error("Error joining room:", response.error);
                    return;
                }

                const {
                    sendTransportOptions,
                    recvTransportOptions,
                    rtpCapabilities,
                    peerInfos,
                    existingProducers,
                } = response;

                const newDevice = await createDevice(rtpCapabilities);
                const newSendTransport = createSendTransport(newDevice, sendTransportOptions);
                createRecvTransport(newDevice, recvTransportOptions);

                sock.on("new-producer", handleNewProducer);

                // Start with audio
                try {
                    const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    const audioTrack = audioStream.getAudioTracks()[0];
                    const newAudioProducer = await newSendTransport.produce({ track: audioTrack });
                    setAudioProducer(newAudioProducer);
                    setLocalAudioStream(audioStream);
                    setMicOn(true);

                    // Local speaking detection
                    const cleanup = createSpeakingDetector(audioStream, (speaking) => {
                        setLocalSpeaking(speaking);
                    });
                    speakingCleanupRef.current.set('__local__', cleanup);
                } catch (err) {
                    console.error("Failed to get audio:", err);
                }

                // Build peer map (exclude self)
                const peerMap = new Map<string, PeerInfo>();
                for (const info of peerInfos) {
                    if (info.peerId !== sock.id) {
                        peerMap.set(info.peerId, info);
                    }
                }
                setPeers(peerMap);

                for (const producerInfo of existingProducers) {
                    await consume(producerInfo);
                }

                setJoined(true);
            });
    };

    // Auto-join when socket connects if we have a room from URL
    const joinedRef = useRef(false);
    useEffect(() => {
        const sock = socketRef.current;
        if (!sock || !urlRoomId || joinedRef.current || joined) return;

        const onConnect = () => {
            if (!joinedRef.current) {
                joinedRef.current = true;
                joinRoom();
            }
        };

        if (sock.connected) {
            onConnect();
        } else {
            sock.on('connect', onConnect);
            return () => {
                sock.off('connect', onConnect);
            };
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socket, urlRoomId]);

    const leaveRoom = () => {
        const sock = socketRef.current;
        if (!sock) return;

        sock.emit("leave-room", (response: any) => {
            if (response?.error) {
                console.error("Error leaving room:", response.error);
                return;
            }

            setJoined(false);
            setPeers(new Map());
            setPeerMedia(new Map());

            if (localVideoStream) {
                localVideoStream.getTracks().forEach((track) => track.stop());
                setLocalVideoStream(null);
            }
            if (localAudioStream) {
                localAudioStream.getTracks().forEach((track) => track.stop());
                setLocalAudioStream(null);
            }
            if (screenStream) {
                screenStream.getTracks().forEach((t) => t.stop());
                setScreenStream(null);
            }

            // Close all consumers
            for (const [, entry] of consumersRef.current) {
                entry.consumer.close();
            }
            consumersRef.current.clear();

            // Clean up all speaking detectors
            for (const [, cleanup] of speakingCleanupRef.current) {
                cleanup();
            }
            speakingCleanupRef.current.clear();
            setSpeakingPeers(new Set());
            setLocalSpeaking(false);

            if (sendTransportRef.current) {
                sendTransportRef.current.close();
                sendTransportRef.current = null;
            }
            if (recvTransportRef.current) {
                recvTransportRef.current.close();
                recvTransportRef.current = null;
            }
            deviceRef.current = null;

            setVideoProducer(null);
            setAudioProducer(null);
            setScreenProducer(null);
            setMicOn(false);
            setCamOn(false);
            setScreenOn(false);

            sock.off("new-producer", handleNewProducer);
            navigate('/');
        });
    };

    // ─── Toggle Camera ───

    const toggleCamera = async () => {
        if (camOn) {
            if (videoProducer) {
                closeProducer(videoProducer);
                setVideoProducer(null);
            }
            if (localVideoStream) {
                localVideoStream.getVideoTracks().forEach((t) => t.stop());
                setLocalVideoStream(null);
            }
            setCamOn(false);
        } else {
            const sendTransport = sendTransportRef.current;
            if (!sendTransport) return;

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                setLocalVideoStream(stream);
                const videoTrack = stream.getVideoTracks()[0];
                const newVideoProducer = await sendTransport.produce({ track: videoTrack });
                setVideoProducer(newVideoProducer);
                setCamOn(true);
            } catch (err) {
                console.error("Camera access failed:", err);
            }
        }
    };

    // ─── Toggle Mic ───

    const toggleMic = () => {
        if (audioProducer) {
            if (micOn) {
                audioProducer.pause();
            } else {
                audioProducer.resume();
            }
            setMicOn(!micOn);
        }
    };

    // ─── Toggle Screen Share ───

    const toggleScreenShare = async () => {
        if (screenOn) {
            if (screenProducer) {
                closeProducer(screenProducer);
                setScreenProducer(null);
            }
            if (screenStream) {
                screenStream.getTracks().forEach((t) => t.stop());
                setScreenStream(null);
            }
            setScreenOn(false);
        } else {
            const sendTransport = sendTransportRef.current;
            if (!sendTransport) return;

            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const screenTrack = stream.getVideoTracks()[0];

                const newScreenProducer = await sendTransport.produce({ track: screenTrack });
                setScreenProducer(newScreenProducer);
                setScreenStream(stream);
                setScreenOn(true);

                screenTrack.onended = () => {
                    closeProducer(newScreenProducer);
                    setScreenProducer(null);
                    setScreenStream(null);
                    setScreenOn(false);
                };
            } catch (err) {
                console.error("Screen share failed:", err);
            }
        }
    };

    // ─── Render ───

    // Build remote peer tiles
    const remoteTiles = Array.from(peers.entries()).map(([peerId, info]) => {
        const media = peerMedia.get(peerId);
        return (
            <ParticipantTile
                key={peerId}
                peerId={peerId}
                displayName={info.displayName}
                isLocal={false}
                isSpeaking={speakingPeers.has(peerId)}
                videoStream={media?.videoStream || null}
                audioStream={media?.audioStream || null}
            />
        );
    });

    return (
        <div className="call-page d-flex flex-column vh-100 text-white">
            {/* Header */}
            <div className="call-header p-3 d-flex justify-content-between align-items-center">
                <h5 className="mb-0" style={{ color: '#4ade80' }}>
                    {joined ? `Room: ${roomId}` : 'Join a Room'}
                </h5>
                <div className="d-flex align-items-center gap-2">
                    {!joined && (
                        <>
                            <input
                                type="text"
                                className="form-control form-control-sm"
                                style={{
                                    width: '200px',
                                    background: '#2d3748',
                                    border: '1px solid #4a5568',
                                    color: '#fff'
                                }}
                                placeholder="Room ID"
                                value={roomId}
                                onChange={(e) => setRoomId(e.target.value)}
                            />
                            <button
                                className="btn btn-sm"
                                style={{ background: '#4ade80', color: '#000', fontWeight: 600 }}
                                onClick={joinRoom}
                            >
                                Join
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Main content area */}
            <div className="call-content">
                {/* Screen share area (separate from grid) */}
                {joined && screenStream && (
                    <div className="screen-share-container">
                        <div className="screen-share-tile">
                            <video
                                autoPlay
                                playsInline
                                muted
                                className="tile-video"
                                ref={(el) => {
                                    if (el) el.srcObject = screenStream;
                                }}
                            />
                            <div className="tile-name-overlay visible">
                                <span className="tile-name-text">Your Screen</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Participant Grid */}
                <div className={`participants-grid ${screenStream ? 'with-screen-share' : ''}`}>
                    {joined && (
                        <>
                            {/* Local user tile */}
                            <ParticipantTile
                                peerId={socketRef.current?.id || 'local'}
                                displayName={userName || 'You'}
                                isLocal={true}
                                isSpeaking={localSpeaking}
                                videoStream={localVideoStream}
                                audioStream={null}
                            />

                            {/* Remote peer tiles */}
                            {remoteTiles}
                        </>
                    )}
                </div>
            </div>

            {/* Controls */}
            {joined && (
                <div className="call-controls d-flex justify-content-center align-items-center gap-4">
                    <div className="ctrl-wrapper">
                        <button
                            className={`ctrl-btn ${micOn ? 'on' : 'off'}`}
                            onClick={toggleMic}
                            title={micOn ? 'Mute' : 'Unmute'}
                        >
                            {micOn ? '🎤' : '🔇'}
                        </button>
                        <span className="ctrl-label">{micOn ? 'Mute' : 'Unmute'}</span>
                    </div>
                    <div className="ctrl-wrapper">
                        <button
                            className={`ctrl-btn ${camOn ? 'on' : 'off'}`}
                            onClick={toggleCamera}
                            title={camOn ? 'Turn off camera' : 'Turn on camera'}
                        >
                            {camOn ? '📹' : '📷'}
                        </button>
                        <span className="ctrl-label">{camOn ? 'Stop' : 'Camera'}</span>
                    </div>
                    <div className="ctrl-wrapper">
                        <button
                            className={`ctrl-btn ${screenOn ? 'screen-on' : 'on'}`}
                            onClick={toggleScreenShare}
                            title={screenOn ? 'Stop sharing' : 'Share screen'}
                        >
                            🖥️
                        </button>
                        <span className="ctrl-label">{screenOn ? 'Stop' : 'Share'}</span>
                    </div>
                    <div className="ctrl-wrapper">
                        <button
                            className="ctrl-btn end-call"
                            onClick={leaveRoom}
                            title="Leave call"
                        >
                            📞
                        </button>
                        <span className="ctrl-label">Leave</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CallPage;