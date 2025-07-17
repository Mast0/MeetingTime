import React, { useEffect, useState, useContext, useRef } from "react";
import { AuthContext } from "../context/AuthContext";
import { jwtDecode } from "jwt-decode";
import '../styles/ChatComponent.css';
import { getMessages } from "../api/chat";

interface TokenPayload {
  sub: string;
  email: string;
}

interface Message {
  UserId: string;
  RoomId: string;
  Text: string;
  Timestamp: number;
}

const ChatComponent: React.FC<{ roomId: string, roomName: string }> = ({ roomId, roomName }) => {
  const { token } = useContext(AuthContext);
  const [userId, setUserId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchRooms = async () => {
      if (token) {
        try{
          const res = await getMessages({ RoomId: roomId });
          const mapped: Message[] = res.messages
          .filter((m: { text: string; }) => m.text !== "__join__")
          .map((m: { userId: any; roomId: any; text: any; timestamp: any; }) => ({
            UserId: m.userId,
            RoomId: m.roomId,
            Text: m.text,
            Timestamp: m.timestamp
          }));
          setMessages(mapped);
        } catch (err) {
          console.error(err);
        }
      }
    };

    fetchRooms();
  }, [roomId, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!token) return;

    // get userId from token
    try {
      const payload = jwtDecode<TokenPayload>(token);
      setUserId(payload.sub);
    } catch {
      console.error("Cannot decode token");
    }

    // open ws
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(
      `${protocol}://${import.meta.env.VITE_API_URL}/ws/chat`
    );
    // const ws = new WebSocket(`ws://localhost:8000/ws/chat?access_token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      // send join message
      const joinsMsg: Partial<Message> = { UserId: userId, RoomId: roomId, Text: "__join__", Timestamp: Date.now() };
      ws.send(JSON.stringify(joinsMsg));
    };

    ws.onmessage = (ev) => {
      try {
        const msg: Message = JSON.parse(ev.data);
        setMessages((prev) => [...prev, msg]);
      } catch (error) {
        console.error("Invalid message", ev.data);
      }
    };

    ws.onclose = () => console.log("Chat socket closed");
    ws.onerror = (e) => console.error("Chat socket error", e);

    // clanup
    return () => {
      ws.close();
    };
  }, [token, roomId, userId]);

  const handleSend = () => {
    if (!text.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const msg: Message = {
      UserId: userId, RoomId: roomId, Text: text, Timestamp: Date.now(),
    };

    wsRef.current.send(JSON.stringify(msg));

    setText('');
  };

  return (
    <div className="chat-page">
      <div className="chat-header p-3 border-bottom border-secondary">
        <h5 className="mb-0 text-success">{roomName}</h5>
      </div>
      <div className="chat-messages text-white">
        {messages.map((m, i) => (
          <div key={i} className={`chat-message ${m.UserId === userId ? 'own' : ''}`}>
            <span className="text-white fw-bold">{m.UserId}</span>
            <div className="text-white">{m.Text}</div>
            <div className="text-white small">{new Date(m.Timestamp).toLocaleTimeString()}</div>
          </div>
        ))}
        <div ref={bottomRef}/>
      </div>
      <div className="chat-input p-3 border-top border-secondary d-flex">
        <input
          className="form-control me-2 text-white border-0"
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