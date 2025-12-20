import React, { useState } from 'react';

const ContentUploadModal = ({ onClose, onUpload, sectionId }) => {
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    setFiles([...e.target.files]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    formData.append('notes', notes);
    formData.append('sectionId', sectionId);

    try {
      await onUpload(formData);
      onClose();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>Upload Content</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Upload Files (PDF, Images, Word docs)</label>
            <input
              type="file"
              onChange={handleFileChange}
              multiple
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
            />
          </div>
          <div className="form-group">
            <label>Additional Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes or context..."
            />
          </div>
          <div className="button-group">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ContentUploadModal;