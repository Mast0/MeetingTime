import React, { useState, useContext } from "react";
import { register as registerApi } from "../api/auth";
import { AuthContext } from "../context/AuthContext";

const Register: React.FC = () => {
    const { login } = useContext(AuthContext);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try{
            const res = await registerApi({ username, email, password });
            login(res);
        } catch (err: any){
            setError(err.response?.data || 'Registration failed');
        }
    };
    return (
        <div className="d-flex justify-content-center align-items-center vh-100 bg-dark">
            <div className="card p-4 text-white border-success" style={{width: '400px'}}>
                <h2 className="text-center text-success mb-4">Register</h2>
                {error && <p className="text-danger" style={{ color: 'red' }}>{error}</p>}
                <form onSubmit={handleSubmit}>
                    <input className="form-control mb-3" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
                    <input className="form-control mb-3" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                    <input className="form-control mb-3" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
                    <button className="btn btn-success w-100" type="submit">Register</button>
                </form>
            </div>
        </div>
    );
};

export default Register;