import WebSocket from "ws";
import { handleMessage } from "./handlers";

const PORT = 3001;

export const startSignaling = () => {
    const wss = new WebSocket.Server({ port: PORT });
    console.log(`WebSocket signaling server running on ws://localhost:${PORT}`);

    wss.on('connection', ws => {
        ws.on('message', message => handleMessage(ws, message.toString()));
    });
};