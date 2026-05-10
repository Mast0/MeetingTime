import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  unreadCounts?: Map<string, number>;
}

const RoomSidebar: React.FC<Props> = ({ rooms, onRoomClick, onAddRoomClick, onSearchClick, width, activeRoomId, unreadCounts }) => {
  const [resizeHover, setResizeHover] = useState(false);
  const navigate = useNavigate();

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
            <span className="sidebar-room-name-text">{room.name}</span>
            {(() => {
              const count = unreadCounts?.get(room.roomId) ?? 0;
              return count > 0 ? (
                <span className="sidebar-unread-badge">
                  {count > 99 ? '99+' : count}
                </span>
              ) : null;
            })()}
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

      {/* Settings button at bottom */}
      <div style={{ padding: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
        <button
          id="sidebar-settings-btn"
          className="sidebar-room-item"
          style={{ width: '100%', color: 'var(--color-text-secondary)' }}
          onClick={() => navigate('/settings')}
          title="Open settings"
        >
          <span className="sidebar-room-icon">⚙️</span>
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
};

export default RoomSidebar;