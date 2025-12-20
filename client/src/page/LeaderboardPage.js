import React, { useEffect, useState } from 'react';
import { fetchTop, fetchMyRank } from '../services/leaderboardService';
import './LeaderboardPage.css';
import useAuth from '../hooks/useAuth'; 

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [top, setTop] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(50);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadLeaderboard = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [topRes, myRes] = await Promise.all([
        fetchTop(limit),
        fetchMyRank()
      ]);
      
      console.log('Leaderboard data loaded:', { topRes, myRes }); // Debug log
      
      if (topRes?.success) {
        const leaderboard = topRes.leaderboard || [];
        // Ensure leaderboard is sorted by points descending
        const sorted = [...leaderboard].sort((a, b) => (b.points || 0) - (a.points || 0));
        setTop(sorted);
        console.log(`Loaded ${sorted.length} users in leaderboard`);
      } else {
        console.warn('Failed to load leaderboard:', topRes);
        setError('Failed to load leaderboard. Please try again.');
      }
      
      if (myRes?.success) {
        setMe(myRes.user || null);
      } else {
        console.warn('Failed to load user rank:', myRes);
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      setError('Error loading leaderboard. Please refresh the page.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadLeaderboard, 30000);
    return () => clearInterval(interval);
  }, [limit]);

  const getRankIcon = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  const getRankClass = (rank) => {
    if (rank === 1) return 'rank-gold';
    if (rank === 2) return 'rank-silver';
    if (rank === 3) return 'rank-bronze';
    return '';
  };

  const formatPoints = (points) => {
    if (points >= 1000000) return `${(points / 1000000).toFixed(1)}M`;
    if (points >= 1000) return `${(points / 1000).toFixed(1)}K`;
    return points?.toString() || '0';
  };

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-container">
        <div className="leaderboard-header">
          <div className="header-content">
            <h1>🏆 Leaderboard</h1>
            <p>Compete with other students and climb the ranks!</p>
          </div>
          <div className="header-actions">
            <select 
              value={limit} 
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="limit-select"
            >
              <option value={20}>Top 20</option>
              <option value={50}>Top 50</option>
              <option value={100}>Top 100</option>
            </select>
            <button 
              onClick={loadLeaderboard}
              className="refresh-btn"
              disabled={refreshing}
            >
              {refreshing ? '🔄' : '↻'} Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading leaderboard...</p>
          </div>
        ) : (
          <>
            {/* Top 3 Podium */}
            {top.length >= 3 && (
              <div className="podium-section">
                <div className="podium-item second">
                  <div className="podium-avatar">
                    <img 
                      src={top[1]?.photo || '/default-avatar.png'} 
                      alt={top[1]?.displayName}
                    />
                    <span className="podium-rank">2</span>
                  </div>
                  <div className="podium-info">
                    <h3>{top[1]?.displayName || 'Anonymous'}</h3>
                    <p className="podium-points">{formatPoints(top[1]?.points)} pts</p>
                  </div>
                </div>

                <div className="podium-item first">
                  <div className="podium-avatar">
                    <img 
                      src={top[0]?.photo || '/default-avatar.png'} 
                      alt={top[0]?.displayName}
                    />
                    <span className="podium-rank">1</span>
                    <div className="crown">👑</div>
                  </div>
                  <div className="podium-info">
                    <h3>{top[0]?.displayName || 'Anonymous'}</h3>
                    <p className="podium-points">{formatPoints(top[0]?.points)} pts</p>
                  </div>
                </div>

                <div className="podium-item third">
                  <div className="podium-avatar">
                    <img 
                      src={top[2]?.photo || '/default-avatar.png'} 
                      alt={top[2]?.displayName}
                    />
                    <span className="podium-rank">3</span>
                  </div>
                  <div className="podium-info">
                    <h3>{top[2]?.displayName || 'Anonymous'}</h3>
                    <p className="podium-points">{formatPoints(top[2]?.points)} pts</p>
                  </div>
                </div>
              </div>
            )}

            {/* Full Leaderboard List */}
            <div className="leaderboard-list-section">
              <h2 className="section-title">All Rankings</h2>
              <div className="leaderboard-list">
                {top.map((u, idx) => {
                  const rank = idx + 1;
                  const isCurrentUser = user && String(u._id) === String(user._id);
                  
                  return (
                    <div 
                      key={u._id || idx} 
                      className={`leaderboard-item ${getRankClass(rank)} ${isCurrentUser ? 'current-user' : ''}`}
                    >
                      <div className="item-rank">
                        {getRankIcon(rank) && <span className="rank-icon">{getRankIcon(rank)}</span>}
                        <span className="rank-number">{rank}</span>
                      </div>
                      
                      <div className="item-avatar">
                        <img 
                          src={u.photo || '/default-avatar.png'} 
                          alt={u.displayName || 'User'}
                          onError={(e) => {
                            e.target.src = '/default-avatar.png';
                          }}
                        />
                        {isCurrentUser && <div className="user-badge">You</div>}
                      </div>
                      
                      <div className="item-info">
                        <h4 className="item-name">
                          {u.displayName || 'Anonymous'}
                          {isCurrentUser && <span className="you-indicator"> (You)</span>}
                        </h4>
                        <p className="item-email">{u.email || ''}</p>
                      </div>
                      
                      <div className="item-points">
                        <span className="points-value">{formatPoints(u.points || 0)}</span>
                        <span className="points-label">points</span>
                      </div>
                      
                      {rank <= 3 && (
                        <div className="item-badge">
                          <span className="badge-text">Top {rank}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* User's Rank Card */}
            {me && (
              <div className="user-rank-card">
                <div className="rank-card-header">
                  <h3>Your Ranking</h3>
                </div>
                <div className="rank-card-content">
                  <div className="rank-display">
                    <span className="rank-label">Rank</span>
                    <span className="rank-value">#{me.rank || 'N/A'}</span>
                  </div>
                  <div className="points-display">
                    <span className="points-label">Total Points</span>
                    <span className="points-value-large">{formatPoints(me.points || 0)}</span>
                  </div>
                  {me.before && me.before.length > 0 && (
                    <div className="next-rank-info">
                      <p>
                        {me.before[0]?.points - (me.points || 0)} points to reach rank #{me.rank - 1}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="error-state">
                <p>⚠️ {error}</p>
                <button onClick={loadLeaderboard} className="retry-btn">
                  Retry
                </button>
              </div>
            )}

            {!error && top.length === 0 && (
              <div className="empty-state">
                <p>No rankings available yet. Be the first to earn points!</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
