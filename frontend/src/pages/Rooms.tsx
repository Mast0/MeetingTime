import '../styles/Rooms.css';
import React, {useEffect, useState, useContext, useRef} from "react";
import { getRooms, createRoom } from "../api/room";
import { AuthContext } from "../context/AuthContext";
import { Modal } from 'bootstrap';

interface Room {
    id: string;
    name: string;
}

const Rooms: React.FC = () => {
    const { token, logout } = useContext(AuthContext);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [name, setName] = useState('');
    const [maxParticipiants, setMaxParticipiants] = useState(1);
    const [password, setPassword] = useState('');
    const modalRef = useRef<HTMLDivElement | null>(null);
    const modalInstanceRef = useRef<Modal | null>(null);

    useEffect(() => {
        if (modalRef.current) {
            modalInstanceRef.current = new Modal(modalRef.current);
        }

        const fetchRooms = async () => {
            if (token) {
                try{
                    const res = await getRooms();
                    setRooms(res.rooms);
                } catch (err) {
                    logout();
                }
            }
        };

        fetchRooms();
    }, [token]);

    const handleCreate = async () => {
        if (!name || !password || maxParticipiants < 1){
            modalInstanceRef.current?.hide();
            return; 
        }
        const newRoom = await createRoom({ name, maxParticipiants, password });
        setRooms(prev => [...prev, newRoom]);
        setName('');
        setMaxParticipiants(1);
        setPassword('');

        modalInstanceRef.current?.hide();
    };

    return (
        <>
        <div className="container-fluid bg-dark text-white min-vh-100">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="text-success">Rooms</h2>
                <button className="btn btn-outline-danger" onClick={logout}>Logout</button>
            </div>
            <div className="mb-3">
                <button className="btn btn-success" onClick={() => modalInstanceRef.current?.show()}>Create Room</button>
            </div>
            <div className="row">
                {rooms.map(r => (
                    <div key={r.id} className="col-md-4 mb-3">
                        <div className="card bg-secondary border-success text-white">
                            <div className="card-body">
                                <h5 className="card-title">{r.name}</h5>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
        <div 
            className="modal fade"
            id="createRoomModal"
            tabIndex={-1}
            aria-labelledby="createRoomModalLabel"
            aria-hidden="true"
            ref={modalRef}
        >
            <div className="modal-dialog">
                <div className="modal-content bg-dark text-white border-success">
                    <div className="modal-header">
                        <h5 className="modal-title text-success" id="createRoomModalLabel">
                            Create New Room
                        </h5>
                        <button
                            type="button"
                            className="btn-close btn-close-white"
                            onClick={() => modalInstanceRef.current?.hide()}
                        ></button>
                    </div>
                    <div className="modal-body">
                        <input 
                            className="form-control mb-3"
                            placeholder="Room name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <input 
                            className="form-control mb-3"
                            placeholder='Max participiants'
                            type='number'
                            value={maxParticipiants}
                            onChange={(e) => setMaxParticipiants(Number.parseInt(e.target.value))}
                        />
                        <input 
                            className='form-control mb-3'
                            placeholder='Password'
                            type='password'
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <div className="modal-footer">
                        <button 
                            className="btn btn-secondary"
                            onClick={() => modalInstanceRef.current?.hide()}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn btn-success"
                            onClick={handleCreate}
                        >
                            Create
                        </button>
                    </div>
                </div>
            </div>
        </div>
        </>   
    );
}

export default Rooms;