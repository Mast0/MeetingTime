import WebSocket from "ws";

export const handleMessage = (ws: WebSocket, message: string) => {
    console.log('received: ', message);

    // TODO: розбір JSON та логіка обміну SDP, ICE, підключення до MediaSoup
    ws.send(JSON.stringify({ type: 'pong' }));
};