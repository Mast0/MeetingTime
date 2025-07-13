import React, { useState } from "react";
import '../styles/RoomSidebar.css';

interface Room {
  id: string;
  name: string;
}

interface Props {
  rooms: Room[];
  onRoomClick: (roomId: string) => void;
  onAddRoomClick: () => void;
  width: number;
}

const RoomSidebar: React.FC<Props> = ({ rooms, onRoomClick, onAddRoomClick, width }) => {
  const [resizeHover, setResizeHover] = useState(false);

  return (
    <div 
      className={`sidebar-container ${resizeHover ? 'resize-hover' : ''} text-white p-3`} 
      style={{width: `${width}px`, minHeight: '100vh'}}
    >
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0 text-success">Rooms</h5>
        <button className="btn btn-sm btn-outline-success" onClick={onAddRoomClick}>+</button>
      </div>
      <ul className="list-group list-group-flush">
        {rooms.map((room) => (
          <li
            key={room.id}
            className="sidebar-container-item list-group-item list-group-item-action text-white border-success"
            style={{cursor: 'pointer'}}
            onClick={() => onRoomClick(room.id)}
          >
            {room.name}
          </li>
        ))}
      </ul>
      <div
        className="sidebar-resizer"
        onMouseDown={() => (window as any).startSidebarResize?.()}
        onMouseEnter={() => setResizeHover(true)}
        onMouseLeave={() => setResizeHover(false)}
      ></div>
    </div>
  );
};

export default RoomSidebar;