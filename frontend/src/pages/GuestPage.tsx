import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { guestLogin } from '../api/auth';
import { getRoomBasicInfo } from '../api/room';
import CallPage from './CallPage';
import { AuthContext } from '../context/AuthContext';

export const GuestPage: React.FC = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();
    const [displayName, setDisplayName] = useState('');
    const [token, setToken] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [roomName, setRoomName] = useState('');

    useEffect(() => {
        if (roomId) {
            getRoomBasicInfo(roomId)
                .then(data => {
                    if (data && data.name) {
                        setRoomName(data.name);
                    }
                })
                .catch(() => { /* ignore */ });
        }
    }, [roomId]);

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!displayName.trim() || !roomId) return;
        setLoading(true);
        setError('');
        try {
            const res = await guestLogin({ displayName, roomId });
            setToken(res.token);
            setUserId(res.guestId);
        } catch (err: any) {
            setError(err.response?.data || 'Failed to join as guest');
        } finally {
            setLoading(false);
        }
    };

    if (token && userId) {
        // Render CallPage wrapped in a custom AuthContext.Provider
        // This makes the CallPage believe the guest is a normal logged-in user!
        const authValue = {
            token,
            userName: displayName,
            userId: userId,
            email: '',
            setUserName: () => {},
            setEmail: () => {},
            login: () => {}, // No-op for guests
            logout: () => {
                setToken(null);
                setUserId(null);
                navigate('/');
            }
        };

        return (
            <AuthContext.Provider value={authValue}>
                <CallPage />
            </AuthContext.Provider>
        );
    }

    return (
        <div className="d-flex align-items-center justify-content-center vh-100 bg-dark text-light">
            <div className="card bg-secondary text-light p-4" style={{ maxWidth: '400px', width: '100%' }}>
                <h3 className="text-center mb-4" style={{ color: '#4ade80' }}>
                    Join {roomName ? `Room: ${roomName}` : 'Meeting'} as Guest
                </h3>
                {error && <div className="alert alert-danger">{error}</div>}
                <form onSubmit={handleJoin}>
                    <div className="mb-3">
                        <label className="form-label">Display Name</label>
                        <input
                            type="text"
                            className="form-control text-dark"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Enter your name"
                            required
                            autoFocus
                        />
                    </div>
                    <button type="submit" className="btn w-100 mt-2" style={{ background: '#4ade80', color: '#000', fontWeight: 600 }} disabled={loading}>
                        {loading ? 'Joining...' : 'Join Room'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default GuestPage;
