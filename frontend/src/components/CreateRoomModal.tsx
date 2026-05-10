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
    if (!name.trim()) return;

    onCreate(name, maxParticipiants, password);
    setName('');
    setMaxParticipiants(1);
    setPassword('');
    const modalEl = document.getElementById("createRoomModal");
    if (modalEl) {
      const modal = Modal.getInstance(modalEl);
      modal?.hide();
    }
  };

  const handleParticipantsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setMaxParticipiants(isNaN(value) || value < 1 ? 1 : value);
  };

  return (
    <div
      className="modal fade"
      id="createRoomModal"
      tabIndex={-1}
      aria-labelledby="createRoomModalLabel"
      aria-hidden="true"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title" id="createRoomModalLabel">
              Create Room
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              data-bs-dismiss="modal"
              aria-label="Close"
            />
          </div>
          <div className="modal-body" style={{ padding: '1.5rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Room Name
              </label>
              <input
                className="form-control"
                placeholder="e.g. Team Standup"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Max Participants
              </label>
              <input
                className="form-control"
                type="number"
                min={1}
                value={maxParticipiants}
                onChange={handleParticipantsChange}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Password (optional)
              </label>
              <input
                className="form-control"
                type="password"
                placeholder="Leave empty for public room"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button className="btn btn-success" onClick={handleSubmit}>Create Room</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateRoomModal;