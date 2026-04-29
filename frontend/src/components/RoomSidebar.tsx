import React, { useState } from "react";
import '../styles/RoomSidebar.css';

interface Room {
  roomId: string;
  name: string;
}

interface Props {
  rooms: Room[];
  onRoomClick: (roomId: string, roomName: string) => void;
  onAddRoomClick: () => void;
  onSearchClick: () => void;
  width: number;
  activeRoomId?: string;
}

const RoomSidebar: React.FC<Props> = ({ rooms, onRoomClick, onAddRoomClick, onSearchClick, width, activeRoomId }) => {
  const [resizeHover, setResizeHover] = useState(false);

  return (
    <div
      className={`sidebar-container ${resizeHover ? 'resize-hover' : ''}`}
      style={{ width: `${width}px`, minHeight: '100vh' }}
    >
      <div className="sidebar-header">
        <h5>Rooms</h5>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="sidebar-add-btn" onClick={onSearchClick} title="Explore public rooms">
            🔍
          </button>
          <button className="sidebar-add-btn" onClick={onAddRoomClick} title="Create room">
            +
          </button>
        </div>
      </div>

      <div className="sidebar-rooms">
        {rooms.map((room) => (
          <button
            key={room.roomId}
            className={`sidebar-room-item ${activeRoomId === room.roomId ? 'active' : ''}`}
            onClick={() => onRoomClick(room.roomId, room.name)}
          >
            <span className="sidebar-room-icon">#</span>
            {room.name}
          </button>
        ))}

        {rooms.length === 0 && (
          <p style={{
            color: 'var(--color-text-muted)',
            fontSize: '0.85rem',
            textAlign: 'center',
            padding: '2rem 1rem',
            margin: 0,
          }}>
            No rooms yet. Create one!
          </p>
        )}
      </div>

      <div
        className="sidebar-resizer"
        onMouseDown={() => (window as any).startSidebarResize?.()}
        onMouseEnter={() => setResizeHover(true)}
        onMouseLeave={() => setResizeHover(false)}
      />
    </div>
  );
};

export default RoomSidebar;