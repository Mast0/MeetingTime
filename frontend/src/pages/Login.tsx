import React, { useState, useContext } from "react";
import { login as loginApi } from "../api/auth";
import { AuthContext } from "../context/AuthContext";
import { Link } from "react-router-dom";

const Login: React.FC = () => {
    const { login } = useContext(AuthContext);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const token = await loginApi({ email, password });
            await login(token);
        } catch (err: any) {
            setError(err.response?.data?.error || err.response?.data || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            background: 'linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 50%, #16213e 100%)',
        }}>
            <div style={{
                width: '420px',
                background: 'rgba(22, 33, 62, 0.8)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '2.5rem',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 60px rgba(74, 222, 128, 0.05)',
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h2 style={{
                        color: '#4ade80',
                        fontSize: '1.75rem',
                        fontWeight: 700,
                        marginBottom: '0.5rem',
                    }}>Welcome Back</h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
                        Sign in to MeetingTime
                    </p>
                </div>

                {error && (
                    <div style={{
                        background: 'rgba(229, 62, 62, 0.15)',
                        border: '1px solid rgba(229, 62, 62, 0.3)',
                        borderRadius: '8px',
                        padding: '0.75rem 1rem',
                        marginBottom: '1rem',
                        color: '#fc8181',
                        fontSize: '0.85rem',
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Email
                        </label>
                        <input
                            className="form-control"
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="you@example.com"
                        />
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Password
                        </label>
                        <input
                            className="form-control"
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                        />
                    </div>
                    <button
                        className="btn btn-success w-100"
                        type="submit"
                        disabled={loading}
                        style={{ padding: '0.7rem', fontSize: '0.95rem' }}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <p style={{
                    textAlign: 'center',
                    marginTop: '1.5rem',
                    marginBottom: 0,
                    color: '#94a3b8',
                    fontSize: '0.9rem',
                }}>
                    Don't have an account?{' '}
                    <Link to="/register" style={{ color: '#4ade80', fontWeight: 500 }}>
                        Create one
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default Login;