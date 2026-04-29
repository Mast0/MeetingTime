import React, { useEffect, useState, useContext, useRef, useMemo, useCallback } from "react";
import { AuthContext } from "../context/AuthContext";
import { jwtDecode } from "jwt-decode";
import '../styles/ChatComponent.css';
import { getMessages } from "../api/chat";
import { useNavigate } from "react-router-dom";

interface TokenPayload {
  sub: string;
  email: string;
}

interface Message {
  UserId: string;
  UserName: string;
  RoomId: string;
  Text: string;
  Timestamp: number;
}

interface ChatProps {
  roomId: string;
  roomName: string;
  onToggleMembers?: () => void;
  onInviteClick?: () => void;
  memberCount?: number;
}

const ChatComponent: React.FC<ChatProps> = ({ roomId, roomName, onToggleMembers, onInviteClick, memberCount }) => {
  const { token, userName } = useContext(AuthContext);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Cursor: unix-ms timestamp of the oldest message currently displayed
  const oldestTimestampRef = useRef<number | null>(null);
  // Prevents the IntersectionObserver from firing during the initial load
  const initialLoadDone = useRef(false);
  // Set to true right before prepending older messages so auto-scroll is suppressed
  const isPrependRef = useRef(false);

  const navigate = useNavigate();

  const userId = useMemo(() => {
    if (!token) return '';
    try { return jwtDecode<TokenPayload>(token).sub; }
    catch { return ''; }
  }, [token]);

  // ── Map raw API response to typed Message ────────────────────────────────
  const mapMessages = (raw: any[]): Message[] =>
    raw.map((m: any) => ({
      UserId: m.userId,
      UserName: m.userName,
      RoomId: m.roomId,
      Text: m.text,
      Timestamp: m.timestamp,
    }));

  // ── Load older messages (triggered by scroll-to-top) ─────────────────────
  const loadOlderMessages = useCallback(async () => {
    if (loadingMore || !hasMore || !initialLoadDone.current) return;

    setLoadingMore(true);

    try {
      const res = await getMessages({
        roomId,
        beforeTimestamp: oldestTimestampRef.current ?? undefined,
      });

      const older = mapMessages(res.messages ?? []);

      if (older.length === 0) {
        setHasMore(false);
        return;
      }

      // Save scroll metrics before prepending so we can restore position
      const container = messagesContainerRef.current;
      const prevScrollHeight = container?.scrollHeight ?? 0;

      // Tell the auto-scroll effect to skip this update
      isPrependRef.current = true;

      setMessages(prev => {
        const merged = [...older, ...prev];
        oldestTimestampRef.current = merged[0]?.Timestamp ?? null;
        return merged;
      });

      setHasMore(res.hasMore ?? false);

      // Restore scroll position after React re-renders the prepended messages
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight - prevScrollHeight;
        }
      });
    } catch (err) {
      console.error("Failed to load older messages:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [roomId, loadingMore, hasMore]);

  // ── Initial load — fetch the latest page on room change ──────────────────
  useEffect(() => {
    if (!token || !roomId) return;

    let cancelled = false;
    initialLoadDone.current = false;
    setHasMore(true);
    setMessages([]);
    oldestTimestampRef.current = null;

    const fetchInitial = async () => {
      try {
        const res = await getMessages({ roomId });
        if (cancelled) return;

        const mapped = mapMessages(res.messages ?? []);
        setMessages(mapped);
        setHasMore(res.hasMore ?? false);

        if (mapped.length > 0)
          oldestTimestampRef.current = mapped[0].Timestamp;

        initialLoadDone.current = true;
      } catch (err) {
        console.error("Failed to fetch messages:", err);
      }
    };

    fetchInitial();
    return () => { cancelled = true; };
  }, [roomId, token]);

  // ── Auto-scroll to bottom on initial load and new incoming messages ───────
  // Skipped when isPrependRef is set (older messages were prepended — scroll is
  // restored manually in requestAnimationFrame inside loadOlderMessages).
  useEffect(() => {
    if (!initialLoadDone.current) return;
    if (isPrependRef.current) {
      isPrependRef.current = false; // reset for the next update
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── IntersectionObserver — watches the top sentinel div ──────────────────
  useEffect(() => {
    if (!topSentinelRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && initialLoadDone.current && hasMore && !loadingMore) {
          loadOlderMessages();
        }
      },
      {
        root: messagesContainerRef.current,
        threshold: 0.1,
      }
    );

    observer.observe(topSentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadOlderMessages]);

  // ── WebSocket connection ──────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !roomId || !userId) return;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(
      `${protocol}://${import.meta.env.VITE_WS_API_URL}/ws/chat?access_token=${token}`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        UserId: userId, UserName: userName ?? '', RoomId: roomId,
        Text: "__join__", Timestamp: Date.now(),
      }));
    };

    ws.onmessage = (ev) => {
      try {
        const msg: Message = JSON.parse(ev.data);
        if (msg.Text !== '__join__') {
          setMessages(prev => [...prev, msg]);
        }
      } catch (error) {
        console.error("Invalid message", ev.data);
      }
    };

    ws.onclose = () => console.log("Chat socket closed");
    ws.onerror = (e) => console.error("Chat socket error", e);

    return () => { ws.close(); wsRef.current = null; };
  }, [token, roomId, userId]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = () => {
    if (!text.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({
      UserId: userId, UserName: userName!, RoomId: roomId,
      Text: text, Timestamp: Date.now(),
    }));
    setText('');
  };

  return (
    <div className="chat-page position-relative">
      <div className="chat-header">
        <h5>{roomName}</h5>
        <div className="chat-header-actions">
          {onInviteClick && (
            <button className="chat-header-btn" onClick={onInviteClick} title="Invite member">
              👤+ Invite
            </button>
          )}
          {onToggleMembers && (
            <button className="chat-header-btn" onClick={onToggleMembers} title="Show members">
              👥 Members{memberCount !== undefined && <span className="chat-member-count">{memberCount}</span>}
            </button>
          )}
          <button className="call-btn" onClick={() => navigate(`/call/${roomId}`)}>
            📞 Call
          </button>
        </div>
      </div>

      <div className="chat-messages" ref={messagesContainerRef}>
        {/* Top sentinel — triggers load-more via IntersectionObserver */}
        <div ref={topSentinelRef} className="load-more-sentinel" />

        {/* Loading spinner */}
        {loadingMore && (
          <div className="load-more-spinner">
            <span className="spinner" />
          </div>
        )}

        {/* Start-of-history indicator */}
        {!hasMore && messages.length > 0 && (
          <div className="chat-history-start">
            <span>Beginning of conversation</span>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={`${m.Timestamp}-${i}`} className={`chat-message ${m.UserId === userId ? 'own' : ''}`}>
            <div className="msg-sender">{m.UserName}</div>
            <div className="msg-text">{m.Text}</div>
            <div className="msg-time">{new Date(m.Timestamp).toLocaleTimeString()}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input">
        <input
          className="form-control"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button className="btn btn-success" onClick={handleSend}>Send</button>
      </div>
    </div>
  );
};

export default ChatComponent;