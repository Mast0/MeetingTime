using System.Security.Cryptography;
using System.Text;

namespace ChatService.Services;

/// <summary>
/// AES-256-GCM authenticated encryption service.
/// Stored format: Base64( nonce[12] || ciphertext || tag[16] )
/// </summary>
public sealed class AesEncryptionService : IAesEncryptionService
{
    private const int NonceSize = 12; // GCM standard nonce
    private const int TagSize   = 16; // GCM authentication tag

    private readonly byte[] _key;

    public AesEncryptionService(IConfiguration configuration)
    {
        var keyBase64 = configuration["Encryption:Key"]
            ?? throw new InvalidOperationException(
                "Encryption:Key is not configured. Set it in appsettings.json or via the Encryption__Key environment variable.");

        _key = Convert.FromBase64String(keyBase64);

        if (_key.Length != 32)
            throw new InvalidOperationException(
                "Encryption:Key must be a 32-byte (256-bit) Base64-encoded string.");
    }

    public string Encrypt(string plaintext)
    {
        var plaintextBytes = Encoding.UTF8.GetBytes(plaintext);

        var nonce      = new byte[NonceSize];
        var ciphertext = new byte[plaintextBytes.Length];
        var tag        = new byte[TagSize];

        RandomNumberGenerator.Fill(nonce);

        using var aes = new AesGcm(_key, TagSize);
        aes.Encrypt(nonce, plaintextBytes, ciphertext, tag);

        // Pack: nonce || ciphertext || tag
        var blob = new byte[NonceSize + ciphertext.Length + TagSize];
        Buffer.BlockCopy(nonce,      0, blob, 0,                                  NonceSize);
        Buffer.BlockCopy(ciphertext, 0, blob, NonceSize,                          ciphertext.Length);
        Buffer.BlockCopy(tag,        0, blob, NonceSize + ciphertext.Length,      TagSize);

        return Convert.ToBase64String(blob);
    }

    public string Decrypt(string encryptedBase64)
    {
        var blob = Convert.FromBase64String(encryptedBase64);

        if (blob.Length < NonceSize + TagSize)
            throw new CryptographicException("Encrypted blob is too short.");

        var nonce           = blob[..NonceSize];
        var tag             = blob[^TagSize..];
        var ciphertext      = blob[NonceSize..^TagSize];
        var plaintextBytes  = new byte[ciphertext.Length];

        using var aes = new AesGcm(_key, TagSize);
        aes.Decrypt(nonce, ciphertext, tag, plaintextBytes);

        return Encoding.UTF8.GetString(plaintextBytes);
    }
}
