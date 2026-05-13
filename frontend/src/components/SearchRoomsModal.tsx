import React, { useState, useRef, useCallback, useContext } from "react";
import { searchPublicRooms, addRoomMember, checkRoomPassword } from "../api/room";
import { AuthContext } from "../context/AuthContext";
import '../styles/AddMemberModal.css';

interface Room {
  roomId: string;
  name: string;
  hasPassword: boolean;
}

interface Props {
  existingRoomIds: string[];
  onRoomJoined: (room: { roomId: string; name: string }) => void;
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

  // Password prompt state — keyed by roomId
  const [passwordPromptId, setPasswordPromptId] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

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

  const doJoin = async (room: Room) => {
    if (!userId) return;
    setJoiningId(room.roomId);
    try {
      await addRoomMember(room.roomId, userId);
      setJoinedIds(prev => new Set(prev).add(room.roomId));
      onRoomJoined({ roomId: room.roomId, name: room.name });
    } catch (err) {
      console.error("Failed to join room:", err);
    } finally {
      setJoiningId(null);
    }
  };

  const handleJoinClick = (room: Room) => {
    if (room.hasPassword) {
      // Toggle: if already showing prompt for this room, close it
      if (passwordPromptId === room.roomId) {
        setPasswordPromptId(null);
        setPasswordInput('');
        setPasswordError('');
      } else {
        setPasswordPromptId(room.roomId);
        setPasswordInput('');
        setPasswordError('');
      }
    } else {
      doJoin(room);
    }
  };

  const handlePasswordConfirm = async (room: Room) => {
    if (!passwordInput) {
      setPasswordError('Please enter the password.');
      return;
    }
    setJoiningId(room.roomId);
    setPasswordError('');
    try {
      const { valid } = await checkRoomPassword(room.roomId, passwordInput);
      if (!valid) {
        setPasswordError('Incorrect password. Please try again.');
        return;
      }
      await addRoomMember(room.roomId, userId!);
      setJoinedIds(prev => new Set(prev).add(room.roomId));
      setPasswordPromptId(null);
      setPasswordInput('');
      onRoomJoined({ roomId: room.roomId, name: room.name });
    } catch (err) {
      console.error("Failed to join room:", err);
      setPasswordError('Something went wrong. Please try again.');
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
            <p className="add-member-subtitle">Discover and join rooms</p>
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
            const showPrompt = passwordPromptId === room.roomId;

            return (
              <div key={room.roomId} className="add-member-user-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="add-member-user-avatar" style={{ flexShrink: 0 }}>
                    {room.hasPassword ? '🔒' : '#'}
                  </div>
                  <div className="add-member-user-info" style={{ flex: 1 }}>
                    <span className="add-member-user-name">
                      {room.name}
                      {room.hasPassword && (
                        <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400 }}>
                          · Password protected
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="add-member-user-action" style={{ flexShrink: 0 }}>
                    {isAlreadyMember || justJoined ? (
                      <span className="add-member-badge-member">
                        {justJoined ? '✓ Joined' : 'Joined'}
                      </span>
                    ) : (
                      <button
                        className="add-member-btn-add"
                        onClick={() => handleJoinClick(room)}
                        disabled={isJoining}
                        title={room.hasPassword ? 'Enter password to join' : 'Join room'}
                      >
                        {isJoining ? (
                          <div className="add-member-spinner-sm" />
                        ) : room.hasPassword ? (
                          showPrompt ? 'Cancel' : '🔒 Join'
                        ) : (
                          'Join'
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline password prompt */}
                {showPrompt && !isAlreadyMember && !justJoined && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.5rem 0 0.25rem 0' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="password"
                        className="add-member-search"
                        style={{ flex: 1, padding: '0.45rem 0.75rem', fontSize: '0.875rem' }}
                        placeholder="Enter room password..."
                        value={passwordInput}
                        onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && handlePasswordConfirm(room)}
                        autoFocus
                      />
                      <button
                        className="add-member-btn-add"
                        onClick={() => handlePasswordConfirm(room)}
                        disabled={isJoining}
                      >
                        {isJoining ? <div className="add-member-spinner-sm" /> : 'Confirm'}
                      </button>
                    </div>
                    {passwordError && (
                      <span style={{ color: '#f87171', fontSize: '0.8rem', paddingLeft: '0.25rem' }}>
                        ⚠ {passwordError}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SearchRoomsModal;
