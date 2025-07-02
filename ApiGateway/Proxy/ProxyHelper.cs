using System.Net.WebSockets;

namespace ApiGateway.Proxy;

public static class ProxyHelper
{
    public static async Task ProxyWebSocket(WebSocket frontend, ClientWebSocket backend)
    {
        var buffer = new byte[8192];

        var sendToBackend = Task.Run(async () =>
        {
            while (frontend.State == WebSocketState.Open)
            {
                var result = await frontend.ReceiveAsync(buffer, CancellationToken.None);
                if (result.MessageType == WebSocketMessageType.Close) break;
                await backend.SendAsync(buffer.AsMemory(0, result.Count), WebSocketMessageType.Text, result.EndOfMessage, CancellationToken.None);
            }
            await backend.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, "frontend closed", CancellationToken.None);
        });

        var sendToFrontend = Task.Run(async () =>
        {
            while (backend.State == WebSocketState.Open) 
            {
                var result = await backend.ReceiveAsync(buffer, CancellationToken.None);
                if (result.MessageType == WebSocketMessageType.Close) break;
                await frontend.SendAsync(buffer.AsMemory(0, result.Count), WebSocketMessageType.Text, result.EndOfMessage, CancellationToken.None);
            }
            await frontend.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, "backend closed", CancellationToken.None);
        });

        await Task.WhenAny(sendToBackend, sendToFrontend);
    }
}
