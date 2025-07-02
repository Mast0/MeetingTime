using Grpc.Core;
using Microsoft.AspNetCore.Authorization;
using Protos;

namespace ApiGateway.Proxy;

public class ProxyToChatService : Chat.ChatBase
{
    private readonly Chat.ChatClient _chatClient;
    public ProxyToChatService(Chat.ChatClient chatClient)
    {
        _chatClient = chatClient;
    }

    [Authorize]
    public override async Task Chat(IAsyncStreamReader<ChatMessage> requestStream, IServerStreamWriter<ChatMessage> responseStream, ServerCallContext context)
    {
        using var call = _chatClient.Chat();

        var requestTask = Task.Run(async () =>
        {
            await foreach (var msg in requestStream.ReadAllAsync())
            {
                await call.RequestStream.WriteAsync(msg);
            }
            await call.RequestStream.CompleteAsync();
        });

        var responseTask = Task.Run(async () =>
        {
            await foreach(var msg in call.ResponseStream.ReadAllAsync())
            {
                await responseStream.WriteAsync(msg);
            }
        });

        await Task.WhenAll(requestTask, responseTask);
    }
}
