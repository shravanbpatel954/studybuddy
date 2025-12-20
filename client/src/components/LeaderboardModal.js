import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { fetchTop, fetchMyRank } from '../services/leaderboardService';
import useAuth from '../hooks/useAuth';
import './LeaderboardModal.css';

const LeaderboardModal = ({ isOpen, onClose }) => {
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
      
      if (topRes?.success) {
        const leaderboard = topRes.leaderboard || [];
        const sorted = [...leaderboard].sort((a, b) => (b.points || 0) - (a.points || 0));
        setTop(sorted);
      } else {
        setError('Failed to load leaderboard. Please try again.');
      }
      
      if (myRes?.success) {
        setMe(myRes.user || null);
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
    if (isOpen) {
      loadLeaderboard();
      const interval = setInterval(loadLeaderboard, 30000);
      return () => clearInterval(interval);
    }
  }, [isOpen, limit]);

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

  if (!isOpen) return null;

  return (
    <>
      <div className="leaderboard-modal-backdrop" onClick={onClose} />
      <div className={`leaderboard-modal ${isOpen ? 'open' : ''}`}>
        <div className="leaderboard-modal-header">
          <h2>🏆 Leaderboard</h2>
          <button 
            className="leaderboard-modal-close"
            onClick={onClose}
            aria-label="Close leaderboard"
          >
            <X size={24} />
          </button>
        </div>

        <div className="leaderboard-modal-content">
          {loading ? (
            <div className="leaderboard-loading">
              <div className="leaderboard-spinner"></div>
              <p>Loading leaderboard...</p>
            </div>
          ) : error ? (
            <div className="leaderboard-error">
              <p>{error}</p>
              <button onClick={loadLeaderboard} className="retry-btn">
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* Top 3 Podium */}
              {top.length >= 3 && (
                <div className="leaderboard-podium">
                  <div className="podium-item second">
                    <div className="podium-avatar">
                      <img 
                        src={top[1]?.photo || '/default-avatar.png'} 
                        alt={top[1]?.displayName}
                      />
                      <span className="podium-rank">2</span>
                    </div>
                    <h3>{top[1]?.displayName || 'Anonymous'}</h3>
                    <p className="podium-points">{formatPoints(top[1]?.points)} pts</p>
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
                    <h3>{top[0]?.displayName || 'Anonymous'}</h3>
                    <p className="podium-points">{formatPoints(top[0]?.points)} pts</p>
                  </div>

                  <div className="podium-item third">
                    <div className="podium-avatar">
                      <img 
                        src={top[2]?.photo || '/default-avatar.png'} 
                        alt={top[2]?.displayName}
                      />
                      <span className="podium-rank">3</span>
                    </div>
                    <h3>{top[2]?.displayName || 'Anonymous'}</h3>
                    <p className="podium-points">{formatPoints(top[2]?.points)} pts</p>
                  </div>
                </div>
              )}

              {/* Full Leaderboard List */}
              <div className="leaderboard-list-container">
                <div className="leaderboard-list-header">
                  <h3>All Rankings</h3>
                  <select 
                    value={limit} 
                    onChange={(e) => setLimit(parseInt(e.target.value))}
                    className="limit-select"
                  >
                    <option value={20}>Top 20</option>
                    <option value={50}>Top 50</option>
                    <option value={100}>Top 100</option>
                  </select>
                </div>
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
                          <span className="points-label">pts</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* User Rank Card */}
              {me && (
                <div className="user-rank-card">
                  <h3>Your Rank</h3>
                  <div className="rank-card-content">
                    <div className="rank-display">
                      <span className="rank-label">Rank</span>
                      <span className="rank-value">{me.rank || 'N/A'}</span>
                    </div>
                    <div className="points-display">
                      <span className="points-label">Points</span>
                      <span className="points-value-large">{formatPoints(me.points || 0)}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default LeaderboardModal;

