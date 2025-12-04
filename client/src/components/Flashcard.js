import React from 'react';

export default function Flashcard({ concept, onResponse }) {
    if (!concept) return null;

    return (
        <div style={{
            padding: 20,
            background: 'white',
            borderRadius: 8,
            boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
            maxWidth: 800,
            margin: '20px auto'
        }}>
            {/* Question and Answer */}
            <div style={{ minHeight: 120, textAlign: 'center' }}>
                <h3 style={{ color: '#333', marginBottom: '1rem' }}>{concept.front}</h3>
                <div style={{ color: '#666', marginBottom: '1.5rem' }}>{concept.back}</div>
            </div>

            {/* Explanation Section */}
            {concept.explanation && (
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                    <h4 style={{ color: '#2196f3', marginBottom: '0.5rem' }}>Detailed Explanation</h4>
                    <p style={{ color: '#555' }}>{concept.explanation}</p>
                </div>
            )}

            {/* Resources Section */}
            {concept.resources && (
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                    <h4 style={{ color: '#2196f3', marginBottom: '0.5rem' }}>Additional Resources</h4>
                    
                    {concept.resources.youtube && (
                        <div style={{ marginBottom: '1rem' }}>
                            <h5 style={{ color: '#666', marginBottom: '0.5rem' }}>📺 Recommended Videos:</h5>
                            <ul style={{ color: '#666', margin: 0, paddingLeft: '1.5rem' }}>
                                {concept.resources.youtube.map((topic, i) => (
                                    <li key={i}>{topic}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    
                    {concept.resources.articles && (
                        <div style={{ marginBottom: '1rem' }}>
                            <h5 style={{ color: '#666', marginBottom: '0.5rem' }}>📚 Related Articles:</h5>
                            <ul style={{ color: '#666', margin: 0, paddingLeft: '1.5rem' }}>
                                {concept.resources.articles.map((topic, i) => (
                                    <li key={i}>{topic}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {concept.resources.additionalTopics && (
                        <div style={{ marginBottom: '1rem' }}>
                            <h5 style={{ color: '#666', marginBottom: '0.5rem' }}>🔍 Related Topics to Explore:</h5>
                            <ul style={{ color: '#666', margin: 0, paddingLeft: '1.5rem' }}>
                                {concept.resources.additionalTopics.map((topic, i) => (
                                    <li key={i}>{topic}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: '1.5rem' }}>
                <button onClick={() => onResponse(true)} style={{ padding: '8px 14px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 6 }}>
                    ✅ Got it
                </button>
                <button onClick={() => onResponse(false)} style={{ padding: '8px 14px', background: '#f44336', color: 'white', border: 'none', borderRadius: 6 }}>
                    🔁 Review again
                </button>
                <button onClick={() => onResponse(null)} style={{ padding: '8px 14px', background: '#2196f3', color: 'white', border: 'none', borderRadius: 6 }}>
                    Next
                </button>
            </div>
        </div>
    );
}
