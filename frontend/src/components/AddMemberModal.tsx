import React, { useState, useRef, useCallback } from "react";
import { searchUsers } from "../api/auth";
import { addRoomMember } from "../api/room";
import '../styles/AddMemberModal.css';

interface User {
  id: string;
  userName: string;
  email: string;
}

interface Props {
  roomId: string;
  roomName: string;
  existingMemberIds: string[];
  onMemberAdded: () => void;
  onClose: () => void;
}

const AddMemberModal: React.FC<Props> = ({ roomId, roomName, existingMemberIds, onMemberAdded, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchUsers(value.trim());
        setResults(res.users || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const handleAdd = async (userId: string) => {
    setAddingId(userId);
    try {
      await addRoomMember(roomId, userId);
      setAddedIds(prev => new Set(prev).add(userId));
      onMemberAdded();
    } catch (err) {
      console.error("Failed to add member:", err);
    } finally {
      setAddingId(null);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="add-member-backdrop" onClick={handleBackdropClick}>
      <div className="add-member-modal">
        <div className="add-member-header">
          <div>
            <h5 className="add-member-title">Add Members</h5>
            <p className="add-member-subtitle">to #{roomName}</p>
          </div>
          <button className="add-member-close" onClick={onClose}>✕</button>
        </div>

        <div className="add-member-search-wrap">
          <div className="add-member-search-icon">🔍</div>
          <input
            className="add-member-search"
            type="text"
            placeholder="Search by username or email..."
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

          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <div className="add-member-empty">
              <span className="add-member-empty-icon">👤</span>
              <p>No users found for "{query}"</p>
            </div>
          )}

          {!loading && results.map((user) => {
            const isAlreadyMember = existingMemberIds.includes(user.id);
            const justAdded = addedIds.has(user.id);
            const isAdding = addingId === user.id;

            return (
              <div key={user.id} className="add-member-user-card">
                <div className="add-member-user-avatar">
                  {user.userName?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="add-member-user-info">
                  <span className="add-member-user-name">{user.userName}</span>
                  <span className="add-member-user-email">{user.email}</span>
                </div>
                <div className="add-member-user-action">
                  {isAlreadyMember || justAdded ? (
                    <span className="add-member-badge-member">
                      {justAdded ? '✓ Added' : 'Member'}
                    </span>
                  ) : (
                    <button
                      className="add-member-btn-add"
                      onClick={() => handleAdd(user.id)}
                      disabled={isAdding}
                    >
                      {isAdding ? (
                        <div className="add-member-spinner-sm" />
                      ) : (
                        '+ Add'
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {!loading && query.trim().length < 2 && (
            <div className="add-member-hint">
              <span className="add-member-hint-icon">✨</span>
              <p>Type at least 2 characters to search</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddMemberModal;
