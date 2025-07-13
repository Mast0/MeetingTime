import React, { useState } from "react";
import { Modal } from "bootstrap";

interface Props {
  onCreate: (name: string, maxParticipiants: number, password: string) => void;
}

const CreateRoomModal: React.FC<Props> = ({ onCreate }) => {
  const [name, setName] = useState('');
  const [maxParticipiants, setMaxParticipiants] = useState(1);
  const [password, setPassword] = useState('');

  const handleSubmit = () => {
    onCreate(name, maxParticipiants, password);
    setName('');
    setMaxParticipiants(1);
    setPassword('');
    const modalEl = document.getElementById("createRoomModal");
    const modal = Modal.getInstance(modalEl!);
    modal?.hide();
  }

  return (
        <div 
            className="modal fade"
            id="createRoomModal"
            tabIndex={-1}
            aria-labelledby="createRoomModalLabel"
            aria-hidden="true"
        >
            <div className="modal-dialog">
                <div className="modal-content bg-dark text-white border-success">
                    <div className="modal-header">
                        <h5 className="modal-title text-success" id="createRoomModalLabel">
                            Create Room
                        </h5>
                        <button
                            type="button"
                            className="btn-close btn-close-white"
                            data-bs-dismiss="modal"
                            aria-label="Close"
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
                            type="number"
                            placeholder="Max participants"
                            value={maxParticipiants}
                            onChange={(e) => setMaxParticipiants(parseInt(e.target.value))}
                        />
                        <input
                            className="form-control mb-3"
                            type="password"
                            placeholder="Password (optional)"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button className="btn btn-success" onClick={handleSubmit}>Create</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateRoomModal;