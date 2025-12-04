import React, { useEffect, useState } from 'react';
import { fetchTop, fetchMyRank } from '../services/leaderboardService';
import './Leaderboard.css';

export default function Leaderboard({ limit = 10 }) {
  const [top, setTop] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const [topRes, myRes] = await Promise.all([fetchTop(limit), fetchMyRank()]);
      if (!mounted) return;
      if (topRes?.success) setTop(topRes.leaderboard || []);
      if (myRes?.success) setMe(myRes.user || null);
      setLoading(false);
    }
    load();
    return () => (mounted = false);
  }, [limit]);

  return (
    <div className="leaderboard">
      <h3>Leaderboard</h3>
      {loading && <div>Loading...</div>}

      {!loading && (
        <>
          <ol className="leaderboard-list">
            {top.map((u, idx) => (
              <li key={u._id} className="leaderboard-item">
                <span className="pos">{idx + 1}.</span>
                <img src={u.photo || '/static/avatar.png'} alt="avatar" className="avatar" />
                <span className="name">{u.displayName || 'Anonymous'}</span>
                <span className="points">{u.points || 0} pts</span>
              </li>
            ))}
          </ol>

          {me && (
            <div className="leaderboard-me">
              <strong>Your Rank:</strong> {me.rank} — {me.displayName} — {me.points} pts
            </div>
          )}
        </>
      )}
    </div>
  );
}
