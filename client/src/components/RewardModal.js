import React from 'react';

export default function RewardModal({ open, onClose, videoUrl, message }) {
    if (!open) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
            <div style={{ width: '90%', maxWidth: 720, background: 'white', borderRadius: 12, padding: 20 }}> 
                <h3>{message || 'Reward Unlocked!'}</h3>
                <div style={{ marginTop: 8 }}>
                    {videoUrl ? (
                        <iframe title="reward-video" width="100%" height="315" src={videoUrl} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                    ) : (
                        <div style={{ padding: 20, background: '#f3f3f3', borderRadius: 8 }}>No video available</div>
                    )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                    <button onClick={onClose} style={{ padding: '8px 12px', borderRadius: 8 }}>Close</button>
                </div>
            </div>
        </div>
    );
}
