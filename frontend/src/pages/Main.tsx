import '../styles/Main.css';
import React, {useEffect, useState, useContext} from "react";
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
    const [sidebarWidth, setSidebarWidth] = useState(250);
    const [isUserSelect, setIsUserSelect] = useState(true);

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
            setIsUserSelect(true);
        };

        const handleMouseDown = () => {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            setIsUserSelect(false);
        };

        (window as any).startSidebarResize = handleMouseDown;
    }, []);

    const handleCreate = async (name: string, maxParticipiants: number, password: string) => {
        const newRoom = await createRoom({ name, maxParticipiants, password });
        setRooms(prev => [...prev, newRoom]);
    };

    return (
        <div className='d-flex' style={{ height: '100vh', userSelect: isUserSelect ? 'auto' : 'none'}}>
            <RoomSidebar 
                rooms={rooms}
                onRoomClick={(id, name) => {
                    setRoomId(id);
                    setRoomName(name);
                }}
                onAddRoomClick={() => {
                    const modalEl = document.getElementById("createRoomModal");
                    const modal = new Modal(modalEl!);
                    modal.show();
                }}
                width={sidebarWidth}
            />
            <div className='room-container flex-grow-1 d-flex flex-column'>
                {roomId ? <ChatComponent roomId={roomId} roomName={roomName}></ChatComponent> : <p className="text-white">Hello to Meeting Time</p> }
            </div>
            <CreateRoomModal onCreate={handleCreate} />
        </div>
    );
}

export default Main;