import React, { useEffect, useState, useContext, useRef, useMemo } from "react";
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

const ChatComponent: React.FC<{ roomId: string; roomName: string }> = ({ roomId, roomName }) => {
  const { token, userName } = useContext(AuthContext);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Decode userId once from token — stable across renders
  const userId = useMemo(() => {
    if (!token) return '';
    try {
      return jwtDecode<TokenPayload>(token).sub;
    } catch {
      return '';
    }
  }, [token]);

  // Fetch message history when room changes
  useEffect(() => {
    if (!token || !roomId) return;

    let cancelled = false;

    const fetchMessages = async () => {
      try {
        const res = await getMessages({ RoomId: roomId });

        if (cancelled) return;

        const mapped: Message[] = res.messages
          .filter((m: any) => m.text !== "__join__")
          .map((m: any) => ({
            UserId: m.userId,
            UserName: m.userName,
            RoomId: m.roomId,
            Text: m.text,
            Timestamp: m.timestamp
          }));
        setMessages(mapped);
      } catch (err) {
        console.error("Failed to fetch messages:", err);
      }
    };

    fetchMessages();

    return () => { cancelled = true; };
  }, [roomId, token]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // WebSocket connection — depends only on token, roomId, and userId (all stable)
  useEffect(() => {
    if (!token || !roomId || !userId) return;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(
      `${protocol}://${import.meta.env.VITE_WS_API_URL}/ws/chat?access_token=${token}`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      // Send join message with the already-decoded userId
      const joinMsg = { UserId: userId, UserName: userName ?? '', RoomId: roomId, Text: "__join__", Timestamp: Date.now() };
      ws.send(JSON.stringify(joinMsg));
    };

    ws.onmessage = (ev) => {
      try {
        const msg: Message = JSON.parse(ev.data);
        if (msg.Text !== '__join__') {
          setMessages((prev) => [...prev, msg]);
        }
      } catch (error) {
        console.error("Invalid message", ev.data);
      }
    };

    ws.onclose = () => console.log("Chat socket closed");
    ws.onerror = (e) => console.error("Chat socket error", e);

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [token, roomId, userId]);

  const handleSend = () => {
    if (!text.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const msg: Message = {
      UserId: userId,
      UserName: userName!,
      RoomId: roomId,
      Text: text,
      Timestamp: Date.now(),
    };

    wsRef.current.send(JSON.stringify(msg));
    setText('');
  };

  return (
    <div className="chat-page position-relative">
      <button
        className="call-btn"
        onClick={() => navigate(`/call/${roomId}`)}
      >
        📞 Call
      </button>
      <div className="chat-header">
        <h5>{roomName}</h5>
      </div>
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={`${m.Timestamp}-${i}`} className={`chat-message ${m.UserId === userId ? 'own' : ''}`}>
            <div className="msg-sender">{m.UserName}</div>
            <div className="msg-text">{m.Text}</div>
            <div className="msg-time">{new Date(m.Timestamp).toLocaleTimeString()}</div>
          </div>
        ))}
        <div ref={bottomRef}/>
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