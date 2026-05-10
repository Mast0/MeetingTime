namespace ChatService.Services;

public interface IAesEncryptionService
{
    /// <summary>
    /// Encrypts a plaintext string using AES-256-GCM.
    /// Returns a Base64-encoded blob: nonce(12) + ciphertext + tag(16).
    /// </summary>
    string Encrypt(string plaintext);

    /// <summary>
    /// Decrypts a Base64-encoded blob produced by <see cref="Encrypt"/>.
    /// </summary>
    string Decrypt(string ciphertext);
}
