import React, { useEffect, useState, useContext, useRef } from "react";
//import { ChatClient } from "../grpc/ChatServiceClientPb";
//import { ChatMessage } from "../grpc/chat_pb";
import { AuthContext } from "../context/AuthContext";

const ChatPage: React.FC<{ roomId: string }> = ({ roomId }) => {
  const { token } = useContext(AuthContext);
  //const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const streamRef = useRef<any>(null);

  useEffect(() => {
    if (!token) return;

    // Create Client
    // const client = new ChatClient('/grpc/chat.Chat', null, {
    //   'grpc-web-text': true,
    //   Authorization: `Bearer ${token}`
    // });

    // Open p2p stream
    // const stream = client.client_.rpcCall<ChatMessage, ChatMessage>();
    // streamRef.current = stream;

    // // Send first message, to connect to room
    // const joinMsg = new ChatMessage();
    // joinMsg.setUserid('');
    // joinMsg.setRoomid(roomId);
    // joinMsg.setText('__join__');
    // joinMsg.setTimestamp(Date.now());
    // stream.send(joinMsg);

    // // read all incoming
    // stream.on('data', (msg: ChatMessage) => {
    //   setMessages(prev => [...prev, msg]);
    // });

    // stream.on('end', () => {
    //   console.log('stream ended');
    // });

    // return () => {
    //   stream.finishSend();
    // };
  }, [roomId, token]);

  const handleSend = () => {
    if (!text.trim() || !streamRef.current) return;
    // const msg = new ChatMessage();
    // msg.setUserid('');
    // msg.setRoomid(roomId);
    // msg.setText(text);
    // msg.setTimestamp(Date.now());
    // streamRef.current.send(msg);
    setText('');
  };

  return (
    <div className="d-flex flex-column h-100">
      <div className="flex-grow-1 overflow-auto p-3 bg-dark text-white">
        {/* {messages.map((m, i) => (
          <div key={i} className="mb-2">
            <strong>{m.getUserid()}</strong>: {m.getText()}
          </div>
        ))} */}
      </div>
      <div className="p-3 bg-secondary d-flex">
        <input 
          className="form-control me-2"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
        />
        <button className="btn btn-success" onClick={handleSend}>Send</button>
      </div>
    </div>
  );
};

export default ChatPage;