import '../styles/Main.css';
import React, {useEffect, useState, useContext} from "react";
import { getRooms, createRoom } from "../api/room";
import { AuthContext } from "../context/AuthContext";
import RoomSidebar from '../components/RoomSidebar';
import { Modal } from 'bootstrap';
import CreateRoomModal from '../components/CreateRoomModal';
import ChatPage from './ChatPage';

interface Room {
    id: string;
    name: string;
}

const Main: React.FC = () => {
    const { token, logout } = useContext(AuthContext);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [roomId, setRoomId] = useState('');
    const [sidebarWidth, setSidebarWidth] = useState(250);

    useEffect(() => {
        const fetchRooms = async () => {
            if (token) {
                try{
                    const res = await getRooms();
                    setRooms(res.rooms);
                } catch (err) {
                    logout();
                }
            }
        };

        fetchRooms();
    }, [token]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const newWidth = Math.min(Math.max(e.clientX, 150), 500);
            setSidebarWidth(newWidth);
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        const handleMouseDown = () => {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        };

        (window as any).startSidebarResize = handleMouseDown;
    }, []);

    const handleCreate = async (name: string, maxParticipiants: number, password: string) => {
        const newRoom = await createRoom({ name, maxParticipiants, password });
        setRooms(prev => [...prev, newRoom]);
    };

    return (
        <div className='d-flex'>
            <RoomSidebar 
                rooms={rooms}
                onRoomClick={(id) => setRoomId(id)}
                onAddRoomClick={() => {
                    const modalEl = document.getElementById("createRoomModal");
                    const modal = new Modal(modalEl!);
                    modal.show();
                }}
                width={sidebarWidth}
            />
            <div className='room-container flex-grow-1 text-white p-4'>
                <ChatPage roomId={roomId}></ChatPage>
            </div>
            <CreateRoomModal onCreate={handleCreate} />
        </div>
    );
}

export default Main;