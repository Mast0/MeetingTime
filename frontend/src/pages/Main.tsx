import '../styles/Main.css';
import React, { useEffect, useState, useContext, useCallback } from "react";
import { getMyRooms, createRoom, getRoomMembers } from "../api/room";
import { AuthContext } from "../context/AuthContext";
import RoomSidebar from '../components/RoomSidebar';
import { Modal } from 'bootstrap';
import CreateRoomModal from '../components/CreateRoomModal';
import ChatComponent from '../components/ChatComponent';
import AddMemberModal from '../components/AddMemberModal';
import MembersSidebar from '../components/MembersSidebar';
import SearchRoomsModal from '../components/SearchRoomsModal';

interface Room {
    roomId: string;
    name: string;
    maxParticipiants?: number;
}

const Main: React.FC = () => {
    const { token, logout } = useContext(AuthContext);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [roomId, setRoomId] = useState('');
    const [roomName, setRoomName] = useState('');
    const [sidebarWidth, setSidebarWidth] = useState(260);
    const [isResizing, setIsResizing] = useState(false);

    // Members sidebar state
    const [membersSidebarOpen, setMembersSidebarOpen] = useState(false);
    const [memberCount, setMemberCount] = useState(0);
    const [membersRefreshTrigger, setMembersRefreshTrigger] = useState(0);
    const [existingMemberIds, setExistingMemberIds] = useState<string[]>([]);

    // Modals state
    const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
    const [searchModalOpen, setSearchModalOpen] = useState(false);

    // Fetch user's rooms
    useEffect(() => {
        if (!token) return;

        let cancelled = false;

        const fetchRooms = async () => {
            try {
                const res = await getMyRooms();
                if (!cancelled) setRooms(res.rooms);
            } catch {
                logout();
            }
        };

        fetchRooms();

        return () => { cancelled = true; };
    }, [token, logout]);

    // Fetch member count when room changes
    useEffect(() => {
        if (!roomId) return;

        let cancelled = false;

        const fetchMembers = async () => {
            try {
                const res = await getRoomMembers(roomId);
                if (!cancelled) {
                    const members = res.members || [];
                    setMemberCount(members.length);
                    setExistingMemberIds(members.map((m: any) => m.userId));
                }
            } catch (err) {
                console.error("Failed to fetch members:", err);
            }
        };

        fetchMembers();

        return () => { cancelled = true; };
    }, [roomId, membersRefreshTrigger]);

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

    const handleOpenCreateModal = useCallback(() => {
        const modalEl = document.getElementById("createRoomModal");
        if (modalEl) {
            const modal = new Modal(modalEl);
            modal.show();
        }
    }, []);

    const handleOpenSearchModal = useCallback(() => {
        setSearchModalOpen(true);
    }, []);

    const handleRoomClick = useCallback((id: string, name: string) => {
        setRoomId(id);
        setRoomName(name);
        setMembersSidebarOpen(false);
        setAddMemberModalOpen(false);
    }, []);

    const handleToggleMembers = useCallback(() => {
        setMembersSidebarOpen(prev => !prev);
    }, []);

    const handleInviteClick = useCallback(() => {
        setAddMemberModalOpen(true);
    }, []);

    const handleMemberAdded = useCallback(() => {
        setMembersRefreshTrigger(prev => prev + 1);
    }, []);

    const handleMembersChange = useCallback(() => {
        setMembersRefreshTrigger(prev => prev + 1);
    }, []);

    const handleRoomJoined = useCallback((room: Room) => {
        setRooms(prev => {
            if (prev.find(r => r.roomId === room.roomId)) return prev;
            return [...prev, room];
        });
        setRoomId(room.roomId);
        setRoomName(room.name);
        setSearchModalOpen(false);
    }, []);

    return (
        <div className='main-layout d-flex' style={{ userSelect: isResizing ? 'none' : 'auto' }}>
            <RoomSidebar
                rooms={rooms}
                onRoomClick={handleRoomClick}
                onAddRoomClick={handleOpenCreateModal}
                onSearchClick={handleOpenSearchModal}
                width={sidebarWidth}
                activeRoomId={roomId}
            />
            <div className='room-container'>
                {roomId
                    ? <ChatComponent
                        roomId={roomId}
                        roomName={roomName}
                        onToggleMembers={handleToggleMembers}
                        onInviteClick={handleInviteClick}
                        memberCount={memberCount}
                      />
                    : (
                        <div className="room-empty-state">
                            <div className="room-empty-icon">💬</div>
                            <p className="room-empty-text">Select a room to start chatting</p>
                        </div>
                    )
                }
            </div>
            <CreateRoomModal onCreate={handleCreate} />

            {/* Members Sidebar */}
            {roomId && (
                <MembersSidebar
                    roomId={roomId}
                    isOpen={membersSidebarOpen}
                    onClose={() => setMembersSidebarOpen(false)}
                    onMembersChange={handleMembersChange}
                    refreshTrigger={membersRefreshTrigger}
                />
            )}

            {/* Add Member Modal */}
            {addMemberModalOpen && roomId && (
                <AddMemberModal
                    roomId={roomId}
                    roomName={roomName}
                    existingMemberIds={existingMemberIds}
                    onMemberAdded={handleMemberAdded}
                    onClose={() => setAddMemberModalOpen(false)}
                />
            )}

            {/* Search Rooms Modal */}
            {searchModalOpen && (
                <SearchRoomsModal
                    existingRoomIds={rooms.map(r => r.roomId)}
                    onRoomJoined={handleRoomJoined}
                    onClose={() => setSearchModalOpen(false)}
                />
            )}
        </div>
    );
}

export default Main;