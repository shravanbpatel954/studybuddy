<div className="lb-mobile">

  {/* TOP PODIUM */}
  <div className="lb-podium">
    {top.slice(0, 3).map((u, i) => (
      <div key={u._id} className={`lb-podium-card rank-${i + 1}`}>
        <div className="lb-rank-badge">#{i + 1}</div>
        <img
          src={u.photo || '/static/avatar.png'}
          className="lb-avatar"
          alt=""
        />
        <div className="lb-name">
          {u.displayName || 'Anonymous'}
        </div>
        <div className="lb-points">
          {u.points} pts
        </div>
      </div>
    ))}
  </div>

  {/* FULL RANK LIST */}
  <div className="lb-list">
    {top.slice(3).map((u, idx) => (
      <div
        key={u._id}
        className={`lb-row ${
          me?._id === u._id ? 'lb-you' : ''
        }`}
      >
        <div className="lb-pos">{idx + 4}</div>

        <img
          src={u.photo || '/static/avatar.png'}
          className="lb-row-avatar"
          alt=""
        />

        <div className="lb-row-name">
          {u.displayName || 'Anonymous'}
        </div>

        <div className="lb-row-points">
          {u.points} pts
        </div>
      </div>
    ))}
  </div>

</div>
