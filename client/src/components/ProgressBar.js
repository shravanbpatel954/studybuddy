import React from 'react';
import './QuizSession.css';

export default function ProgressBar({ value = 0 }) {
    const pct = Math.max(0, Math.min(100, value));
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
            <div style={{ minWidth: 100, fontWeight: 600 }}>Mastery</div>
            <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div style={{ minWidth: 40, textAlign: 'right', fontWeight: 700 }}>{pct}%</div>
        </div>
    );
}
import React from 'react';

export default function ProgressBar({ value = 0 }) {
    return (
        <div className="progress-bar">
            <div className="progress" style={{ width: `${value}%` }} />
        </div>
    );
}
