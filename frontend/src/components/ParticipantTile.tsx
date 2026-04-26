import React, { useRef, useEffect, useState } from 'react';

interface ParticipantTileProps {
    peerId: string;
    displayName: string;
    isLocal: boolean;
    isSpeaking: boolean;
    videoStream: MediaStream | null;
    audioStream: MediaStream | null;
}

// Generate a consistent color from a string
function stringToColor(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 55%, 45%)`;
}

const ParticipantTile: React.FC<ParticipantTileProps> = ({
    peerId,
    displayName,
    isLocal,
    isSpeaking,
    videoStream,
    audioStream,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [showName, setShowName] = useState(false);

    const firstLetter = (displayName || '?')[0].toUpperCase();
    const avatarColor = stringToColor(displayName || peerId);

    // Attach video stream
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = videoStream;
        }
    }, [videoStream]);

    // Attach audio stream (only for remote peers)
    useEffect(() => {
        if (audioRef.current && !isLocal) {
            audioRef.current.srcObject = audioStream;
        }
    }, [audioStream, isLocal]);

    return (
        <div
            className={`participant-tile ${isSpeaking ? 'speaking' : ''} ${isLocal ? 'is-local' : ''}`}
            onMouseEnter={() => setShowName(true)}
            onMouseLeave={() => setShowName(false)}
        >
            {videoStream ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={isLocal}
                    className="tile-video"
                />
            ) : (
                <div className="tile-avatar" style={{ backgroundColor: avatarColor }}>
                    <span className="tile-avatar-letter">{firstLetter}</span>
                </div>
            )}

            {/* Hidden audio element for remote peers */}
            {!isLocal && audioStream && (
                <audio ref={audioRef} autoPlay />
            )}

            {/* Name overlay on hover */}
            <div className={`tile-name-overlay ${showName ? 'visible' : ''}`}>
                <span className="tile-name-text">
                    {displayName}{isLocal ? ' (You)' : ''}
                </span>
            </div>

            {/* Mic indicator */}
            {isLocal && (
                <div className="tile-local-badge">You</div>
            )}
        </div>
    );
};

export default ParticipantTile;
