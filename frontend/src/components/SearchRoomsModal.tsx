import React, { useState, useRef, useCallback, useContext } from "react";
import { searchPublicRooms, addRoomMember } from "../api/room";
import { AuthContext } from "../context/AuthContext";
import '../styles/AddMemberModal.css';

interface Room {
  roomId: string;
  name: string;
  maxParticipiants: number;
}

interface Props {
  existingRoomIds: string[];
  onRoomJoined: (room: Room) => void;
  onClose: () => void;
}

const SearchRoomsModal: React.FC<Props> = ({ existingRoomIds, onRoomJoined, onClose }) => {
  const { userId } = useContext(AuthContext);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchPublicRooms(value.trim());
        setResults(res.rooms || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const handleJoin = async (room: Room) => {
    if (!userId) return;
    setJoiningId(room.roomId);
    try {
      await addRoomMember(room.roomId, userId);
      setJoinedIds(prev => new Set(prev).add(room.roomId));
      onRoomJoined(room);
    } catch (err) {
      console.error("Failed to join room:", err);
    } finally {
      setJoiningId(null);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Run initial search
  React.useEffect(() => {
    handleSearch('');
  }, [handleSearch]);

  return (
    <div className="add-member-backdrop" onClick={handleBackdropClick}>
      <div className="add-member-modal">
        <div className="add-member-header">
          <div>
            <h5 className="add-member-title">Explore Public Rooms</h5>
            <p className="add-member-subtitle">Discover and join public rooms</p>
          </div>
          <button className="add-member-close" onClick={onClose}>✕</button>
        </div>

        <div className="add-member-search-wrap">
          <div className="add-member-search-icon">🔍</div>
          <input
            className="add-member-search"
            type="text"
            placeholder="Search rooms..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="add-member-results">
          {loading && (
            <div className="add-member-loading">
              <div className="add-member-spinner" />
              <span>Searching...</span>
            </div>
          )}

          {!loading && results.length === 0 && (
            <div className="add-member-empty">
              <span className="add-member-empty-icon">🏠</span>
              <p>No rooms found.</p>
            </div>
          )}

          {!loading && results.map((room) => {
            const isAlreadyMember = existingRoomIds.includes(room.roomId);
            const justJoined = joinedIds.has(room.roomId);
            const isJoining = joiningId === room.roomId;

            return (
              <div key={room.roomId} className="add-member-user-card">
                <div className="add-member-user-avatar">
                  #
                </div>
                <div className="add-member-user-info">
                  <span className="add-member-user-name">{room.name}</span>
                  <span className="add-member-user-email">Max Participants: {room.maxParticipiants}</span>
                </div>
                <div className="add-member-user-action">
                  {isAlreadyMember || justJoined ? (
                    <span className="add-member-badge-member">
                      {justJoined ? '✓ Joined' : 'Joined'}
                    </span>
                  ) : (
                    <button
                      className="add-member-btn-add"
                      onClick={() => handleJoin(room)}
                      disabled={isJoining}
                    >
                      {isJoining ? (
                         <div className="add-member-spinner-sm" />
                      ) : (
                        'Join'
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SearchRoomsModal;
