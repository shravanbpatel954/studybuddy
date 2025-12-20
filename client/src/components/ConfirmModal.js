import React from 'react';
import './ConfirmModal.css';

export default function ConfirmModal({ show, title = 'Confirm', message, onConfirm, onCancel }) {
  if (!show) return null;
  return (
    <div className="confirm-overlay">
      <div className="confirm-card">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="confirm-actions">
          <button className="btn btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="btn btn-confirm" onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
