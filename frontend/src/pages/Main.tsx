import '../styles/Main.css';
import React, { useEffect, useState, useContext, useCallback } from "react";
import { getRooms, createRoom } from "../api/room";
import { AuthContext } from "../context/AuthContext";
import RoomSidebar from '../components/RoomSidebar';
import { Modal } from 'bootstrap';
import CreateRoomModal from '../components/CreateRoomModal';
import ChatComponent from '../components/ChatComponent';

interface Room {
    roomId: string;
    name: string;
}

const Main: React.FC = () => {
    const { token, logout } = useContext(AuthContext);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [roomId, setRoomId] = useState('');
    const [roomName, setRoomName] = useState('');
    const [sidebarWidth, setSidebarWidth] = useState(260);
    const [isResizing, setIsResizing] = useState(false);

    useEffect(() => {
        if (!token) return;

        let cancelled = false;

        const fetchRooms = async () => {
            try {
                const res = await getRooms();
                if (!cancelled) setRooms(res.rooms);
            } catch {
                logout();
            }
        };

        fetchRooms();

        return () => { cancelled = true; };
    }, [token, logout]);

    // Sidebar resize via proper event handlers
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const newWidth = Math.min(Math.max(e.clientX, 180), 500);
            setSidebarWidth(newWidth);
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            setIsResizing(false);
        };

        const handleMouseDown = () => {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            setIsResizing(true);
        };

        (window as any).startSidebarResize = handleMouseDown;

        return () => {
            delete (window as any).startSidebarResize;
        };
    }, []);

    const handleCreate = useCallback(async (name: string, maxParticipiants: number, password: string) => {
        try {
            const newRoom = await createRoom({ name, maxParticipiants, password });
            setRooms(prev => [...prev, newRoom]);
        } catch (err) {
            console.error("Failed to create room:", err);
        }
    }, []);

    const handleOpenModal = useCallback(() => {
        const modalEl = document.getElementById("createRoomModal");
        if (modalEl) {
            const modal = new Modal(modalEl);
            modal.show();
        }
    }, []);

    const handleRoomClick = useCallback((id: string, name: string) => {
        setRoomId(id);
        setRoomName(name);
    }, []);

    return (
        <div className='main-layout d-flex' style={{ userSelect: isResizing ? 'none' : 'auto' }}>
            <RoomSidebar
                rooms={rooms}
                onRoomClick={handleRoomClick}
                onAddRoomClick={handleOpenModal}
                width={sidebarWidth}
                activeRoomId={roomId}
            />
            <div className='room-container'>
                {roomId
                    ? <ChatComponent roomId={roomId} roomName={roomName} />
                    : (
                        <div className="room-empty-state">
                            <div className="room-empty-icon">💬</div>
                            <p className="room-empty-text">Select a room to start chatting</p>
                        </div>
                    )
                }
            </div>
            <CreateRoomModal onCreate={handleCreate} />
        </div>
    );
}

export default Main;