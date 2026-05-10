import React, { useEffect, useState, useCallback, useRef } from "react";
import { getRoomMembers, removeRoomMember } from "../api/room";
import { getUser } from "../api/auth";
import { getPresence } from "../api/presence";
import '../styles/MembersSidebar.css';

interface Member {
  userId: string;
  role: string;
  joinedAt: string;
  userName?: string;
  email?: string;
}

interface Props {
  roomId: string;
  isOpen: boolean;
  onClose: () => void;
  onMembersChange?: () => void;
  refreshTrigger?: number;
}

const MembersSidebar: React.FC<Props> = ({ roomId, isOpen, onClose, onMembersChange, refreshTrigger }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const presenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const res = await getRoomMembers(roomId);
      const rawMembers: Member[] = res.members || [];

      const enriched = await Promise.all(
        rawMembers.map(async (m) => {
          try {
            const user = await getUser({ id: m.userId });
            return { ...m, userName: user.userName, email: user.email };
          } catch {
            return { ...m, userName: 'Unknown', email: '' };
          }
        })
      );

      setMembers(enriched);
      return enriched;
    } catch (err) {
      console.error("Failed to fetch members:", err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  const refreshPresence = useCallback(async (currentMembers: Member[]) => {
    if (currentMembers.length === 0) return;
    try {
      const ids = currentMembers.map(m => m.userId);
      const online = await getPresence(ids);
      setOnlineIds(new Set(online));
    } catch {
      // Presence is best-effort — silently ignore errors
    }
  }, []);

  useEffect(() => {
    if (isOpen && roomId) {
      fetchMembers().then(enriched => {
        if (enriched) refreshPresence(enriched);
      });

      presenceIntervalRef.current = setInterval(() => {
        setMembers(current => {
          refreshPresence(current);
          return current;
        });
      }, 15_000);
    }

    return () => {
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
        presenceIntervalRef.current = null;
      }
    };
  }, [isOpen, roomId, fetchMembers, refreshPresence, refreshTrigger]);

  const handleRemove = async (userId: string) => {
    setRemovingId(userId);
    try {
      await removeRoomMember(roomId, userId);
      setMembers(prev => prev.filter(m => m.userId !== userId));
      onMembersChange?.();
    } catch (err) {
      console.error("Failed to remove member:", err);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <>
      {isOpen && <div className="members-sidebar-overlay" onClick={onClose} />}
      <div className={`members-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="members-sidebar-header">
          <h5 className="members-sidebar-title">
            Members
            {members.length > 0 && (
              <span className="members-count-badge">{members.length}</span>
            )}
          </h5>
          <button className="members-sidebar-close" onClick={onClose}>✕</button>
        </div>

        <div className="members-sidebar-list">
          {loading && (
            <div className="members-sidebar-loading">
              <div className="members-sidebar-spinner" />
              <span>Loading members...</span>
            </div>
          )}

          {!loading && members.length === 0 && (
            <div className="members-sidebar-empty">
              <span className="members-sidebar-empty-icon">👥</span>
              <p>No members yet</p>
            </div>
          )}

          {!loading && members.map((member) => {
            const isOnline = onlineIds.has(member.userId);
            return (
              <div key={member.userId} className="members-sidebar-card">
                <div className="members-sidebar-avatar-wrap">
                  <div className="members-sidebar-avatar">
                    {member.userName?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <span
                    className={`presence-dot ${isOnline ? 'online' : 'offline'}`}
                    title={isOnline ? 'Online' : 'Offline'}
                  />
                </div>
                <div className="members-sidebar-info">
                  <div className="members-sidebar-name-row">
                    <span className="members-sidebar-name">{member.userName}</span>
                    {member.role === 'owner' && (
                      <span className="members-sidebar-role-badge">Owner</span>
                    )}
                  </div>
                  <span className="members-sidebar-email">{member.email}</span>
                </div>
                {member.role !== 'owner' && (
                  <button
                    className="members-sidebar-remove"
                    onClick={() => handleRemove(member.userId)}
                    disabled={removingId === member.userId}
                    title="Remove member"
                  >
                    {removingId === member.userId ? (
                      <div className="members-remove-spinner" />
                    ) : (
                      '✕'
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default MembersSidebar;
