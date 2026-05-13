import React, { useState } from "react";
import { Modal } from "bootstrap";

interface Props {
  onCreate: (name: string, password: string) => void;
}

const CreateRoomModal: React.FC<Props> = ({ onCreate }) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) return;

    onCreate(name, password);
    setName('');
    setPassword('');
    const modalEl = document.getElementById("createRoomModal");
    if (modalEl) {
      const modal = Modal.getInstance(modalEl);
      modal?.hide();
    }
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
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Password <span style={{ color: '#64748b', fontWeight: 400, textTransform: 'none' }}>(optional — leave empty for public room)</span>
              </label>
              <input
                className="form-control"
                type="password"
                placeholder="Leave empty for public room"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
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