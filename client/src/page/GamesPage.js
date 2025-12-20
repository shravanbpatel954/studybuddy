import React, { useState, useMemo, useEffect, useRef } from 'react';
import './GamesPage.css';
import api from '../services/api';
import useAuth from '../hooks/useAuth';

const gamesList = [
  // Your games data here
    { name: 'Medieval Defense', url: 'https://cdn.htmlgames.com/MedievalDefense/', img: '/assets/medieval_defense_logo.png', desc: 'Defend your kingdom in this medieval strategy game!', plays: 320 },
    { name: 'Bottle Shooter', url: 'https://cdn.htmlgames.com/BottleShooter/', img: '/assets/bottleshooter200.png', desc: 'Test your aim in this fun bottle shooting challenge!', plays: 400 },
    { name: 'Car Park Sort', url: 'https://cdn.htmlgames.com/CarParkSort/', img: '/assets/carparksort200.png', desc: 'Solve the parking puzzle with logic and patience!', plays: 250 },
    { name: 'Sudoku Classic', url: 'https://cdn.htmlgames.com/SudokuClassic/', img: '/assets/sudokoclassic.webp', desc: 'Train your brain with classic Sudoku!', plays: 150 },
    { name: 'Mystical Forest', url: 'https://cdn.htmlgames.com/MysticalForest/', img: '/assets/mysticalforest200.webp', desc: 'Embark on an enchanted puzzle adventure!', plays: 180 },
    { name: 'Spades Spider Solitaire', url: 'https://cdn.htmlgames.com/SpadesSpiderSolitaire/', img: '/assets/spadesspidersolitaire200.webp', desc: 'Classic solitaire with a twist!', plays: 130 },
    { name: 'Picture Pie Ancient City', url: 'https://cdn.htmlgames.com/PicturePieAncientCity/', img: '/assets/picturepieancientcity200.webp', desc: 'Solve the puzzle in ancient cities!', plays: 220 },
    { name: '4 Winds', url: 'https://cdn.htmlgames.com/4Winds/', img: '/assets/4winds200.png', desc: 'Navigate the winds and conquer!', plays: 110 },
    { name: 'Atlantis Gem', url: 'https://cdn.htmlgames.com/AtlantisGem/', img: '/assets/atlantisgem200.png', desc: 'Discover the lost city with gems!', plays: 170 },
    { name: 'Clock Solitaire', url: 'https://cdn.htmlgames.com/ClockSolitaire/', img: '/assets/clocksolitaire200.png', desc: 'A race against the clock!', plays: 95 },
    { name: 'Achilles Solitaire', url: 'https://cdn.htmlgames.com/AchillesSolitaire/', img: '/assets/achillessolitaire200.png', desc: 'Defeat your enemies in this strategic card game!', plays: 120 },
    { name: 'Bubble Shooter', url: 'https://cdn.htmlgames.com/Bubble_Shooter/', img: '/assets/bubble_shooter200.png', desc: 'Shoot bubbles and match colors!', plays: 260 },
    { name: 'Daily 2 Queens', url: 'https://cdn.htmlgames.com/Daily2Queens/', img: '/assets/daily-2-queens-200.png', desc: 'Solve the puzzle with the queens!', plays: 200 },
    { name: 'Frozen Freecell', url: 'https://cdn.htmlgames.com/FrozenFreecell/', img: '/assets/frozenfreecell200.png', desc: 'Play Freecell with a frosty twist!', plays: 160 },
    { name: 'Game of 15', url: 'https://cdn.htmlgames.com/GameOf15/', img: '/assets/gameof15200.png', desc: 'Solve the sliding puzzle in minimal moves!', plays: 140 },
    { name: 'Downhill', url: 'https://cdn.htmlgames.com/Downhill/', img: '/assets/downhill200.png', desc: 'Race downhill and avoid obstacles!', plays: 190 },
    { name: 'Monkey Connect', url: 'https://cdn.htmlgames.com/MonkeyConnect/', img: '/assets/monkeyconnect200.png', desc: 'Connect the playful monkeys!', plays: 150 },
    { name: 'Match 3 Master', url: 'https://cdn.htmlgames.com/Match3Master/', img: '/assets/match3master200.png', desc: 'Master the art of match-3 puzzles!', plays: 210 },
    { name: 'Hidden Spots City', url: 'https://cdn.htmlgames.com/HiddenSpotsCity/', img: '/assets/hiddenspots-city200.png', desc: 'Find all hidden spots in the city!', plays: 175 },
    { name: 'Planet Shooter', url: 'https://cdn.htmlgames.com/PlanetShooter/', img: '/assets/planetshooter200.png', desc: 'Blast planets and survive!', plays: 130 },
    { name: 'Jungle Sniper', url: 'https://cdn.htmlgames.com/JungleSniper/', img: '/assets/junglesniper200.png', desc: 'Show your sniper skills in the jungle!', plays: 450 },
    { name: 'Water Sort', url: 'https://cdn.htmlgames.com/WaterSort/', img: '/assets/watersort200.png', desc: 'Sort the colored water in the right order!', plays: 240 },
    { name: 'Puzzle Drop Space Adventure', url: 'https://cdn.htmlgames.com/PuzzleDropSpaceAdventure/', img: '/assets/puzzledropspaceadventure200.png', desc: 'Drop and match space puzzles!', plays: 160 },
    { name: 'Traffic Control', url: 'https://cdn.htmlgames.com/TrafficControl/', img: '/assets/trafficcontrol200.png', desc: 'Control the traffic without collisions!', plays: 300 },
    { name: 'Cookie Clicker Pro', url: 'https://cloud.onlinegames.io/games/2025/unity/cookie-clicker-pro/index-og.html', img: 'https://www.onlinegames.io/media/posts/971/responsive/Cookie-Clicker-Pro-Game-xs.jpg', desc: 'Create the biggest cookie empire!', plays: 310 },
    { name: 'Survival Island', url: 'https://cloud.onlinegames.io/games/2024/unity2/survival-island/index-og.html', img: 'https://www.onlinegames.io/media/posts/970/responsive/Survival-Island-xs.jpg', desc: 'Survive and explore on a deserted island.', plays: 280 },
    { name: 'Mahjong', url: 'https://cloud.onlinegames.io/games/2025/unity/mahjong/index-og.html', img: 'https://www.onlinegames.io/media/posts/966/responsive/Mahjong-xs.jpg', desc: 'Classic Mahjong puzzle challenge!', plays: 250 },
    { name: 'Nuts and Bolts Puzzle', url: 'https://cloud.onlinegames.io/games/2025/unity/nuts-and-bolts-puzzle/index-og.html', img: 'https://www.onlinegames.io/media/posts/965/responsive/nuts-and-bolts-puzzle-xs.jpg', desc: 'Solve the tricky bolt puzzles!', plays: 230 },
    { name: 'Drift King', url: 'https://www.onlinegames.io/games/2024/unity/drift-king/index.html', img: 'https://www.onlinegames.io/media/posts/729/responsive/Drift-King-xs.jpg', desc: 'Drift your way to victory!', plays: 400 },
    { name: 'Highway Traffic', url: 'https://www.onlinegames.io/games/2022/unity/highway-traffic/index.html', img: 'https://www.onlinegames.io/media/posts/32/responsive/Highway-Traffic-2-xs.jpg', desc: 'Navigate the traffic like a pro.', plays: 350 },
    { name: 'Masked Special Forces', url: 'https://www.onlinegames.io/games/2022/unity2/masked-special-forces/index.html', img: 'https://www.onlinegames.io/media/posts/310/responsive/Masked-Special-Forces-FPS-xs.jpg', desc: 'Multiplayer FPS action game.', plays: 480 },
    { name: 'Stack Fire Ball', url: 'https://www.onlinegames.io/games/2021/unity/stack-fire-ball/index.html', img: 'https://www.onlinegames.io/media/posts/184/responsive/Stack-Fire-Ball-Game-xs.jpg', desc: 'Break tiles and win!', plays: 230 },
    { name: 'Squid Race Simulator', url: 'https://www.onlinegames.io/games/2021/unity3/squid-race-simulator/index.html', img: 'https://www.onlinegames.io/media/posts/950/responsive/squid-race-simulator-xs.jpg', desc: 'Race to survive in Squid Game!', plays: 350 },
    { name: 'GTA Simulator', url: 'https://www.onlinegames.io/games/2023/unity2/gta-simulator/index.html', img: 'https://www.onlinegames.io/media/posts/416/responsive/GTA-Simulator-xs.jpg', desc: 'Play the GTA-inspired simulator.', plays: 500 },
  
 { name: 'Real Flight Simulator', url: 'https://www.onlinegames.io/games/2023/unity/real-flight-simulator/index.html', img: 'https://www.onlinegames.io/media/posts/342/responsive/Real-Flight-Simulator-2-xs.jpg', desc: 'Experience the ultimate flight simulation.', plays: 300 },
{ name: 'Drift Hunters Pro', url: 'https://www.onlinegames.io/games/2023/unity/drift-hunters-pro/index.html', img: 'https://www.onlinegames.io/media/posts/397/responsive/Drift-Hunters-Pro-xs.jpg', desc: 'Thrilling 3D drifting and racing game.', plays: 450 },
{ name: 'Stickman GTA City', url: 'https://cloud.onlinegames.io/games/2024/unity3/stickman-gta-city/index-og.html', img: 'https://www.onlinegames.io/media/posts/900/responsive/stickman-gta-city-free-xs.jpg', desc: 'Experience Stickman-style GTA action.', plays: 400 },
{ name: 'Stickman Parkour', url: 'https://cloud.onlinegames.io/games/2024/construct/219/stickman-parkour/index-og.html', img: 'https://www.onlinegames.io/media/posts/871/responsive/stickman-parkour-OG-xs.jpg', desc: 'Stickman takes on challenging parkour courses.', plays: 280 },
{ name: 'Capybara Clicker Pro', url: 'https://www.onlinegames.io/games/2023/q2/capybara-clicker-pro/index.html', img: 'https://www.onlinegames.io/media/posts/554/responsive/Capybara-Clicker-Pro-xs.jpg', desc: 'Tap and earn coins in this clicker game.', plays: 350 },
{ name: 'Madalin Stunt Cars Pro', url: 'https://www.onlinegames.io/games/2023/unity/madalin-stunt-cars-pro/index.html', img: 'https://www.onlinegames.io/media/posts/401/responsive/Madalin-Stunt-Cars-Pro-Game-xs.jpg', desc: 'Perform crazy stunts with luxury cars.', plays: 500 },
{ name: 'Police Chase Drifter', url: 'https://www.onlinegames.io/games/2021/3/police-chase-drifter/index.html', img: 'https://www.onlinegames.io/media/posts/155/responsive/Police-Chase-Drifter-Online-xs.jpg', desc: 'Outrun the police and become a drift champion.', plays: 380 },
{ name: 'Basket Hoop', url: 'https://cloud.onlinegames.io/games/2024/construct/311/basket-hoop/index-og.html', img: 'https://www.onlinegames.io/media/posts/843/responsive/Basket-Hoop-xs.jpg', desc: 'Shoot hoops and beat the clock.', plays: 220 },
{ name: 'Get On Top', url: 'https://www.gamenora.com/embed/get-on-top', img: 'https://www.onlinegames.io/media/posts/697/responsive/Get-on-Top-xs.jpg', desc: 'Battle it out in this hilarious physics-based game.', plays: 260 },
{ name: 'Super Car Driving', url: 'https://cloud.onlinegames.io/games/2024/unity2/super-car-driving/index-og.html', img: 'https://www.onlinegames.io/media/posts/854/responsive/supercardriving-2-xs.jpg', desc: 'Drive and stunt with high-end supercars.', plays: 420 },
{ name: 'Tank Arena', url: 'https://cloud.onlinegames.io/games/2025/construct/293/tank-arena/index-og.html', img: 'https://www.onlinegames.io/media/posts/956/responsive/Tank-Arena-Online-xs.jpg', desc: 'Engage in thrilling tank battles.', plays: 300 }


  ];

export default function GamesPage() {
  const { token } = useAuth();
  const [activeGame, setActiveGame] = useState(null);
  const [user, setUser] = useState({ points: 0, unlockedGames: ['Basket Hoop'] });
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('popular');
  const [unlocking, setUnlocking] = useState(false);
  const [timeStatus, setTimeStatus] = useState(null);
  const [gameStartTime, setGameStartTime] = useState(null);
  const [unlockedGame, setUnlockedGame] = useState(null);
  const gameTimeIntervalRef = useRef(null);
  const gameStartTimeRef = useRef(null);
  
  // API base URL - declared once at component level
  const apiBase = process.env.REACT_APP_API_BASE || 'https://studybuddy-backend-i649.onrender.com/api/v1';

  const filtered = useMemo(() => {
    const q = (query || '').toLowerCase().trim();
    let list = gamesList.filter(g => !q || g.name.toLowerCase().includes(q) || g.desc.toLowerCase().includes(q));
    
    // Sort: Basket Hoop first (always unlocked), then unlocked games, then locked games
    // Within each group, sort by popularity or name
    const basketHoop = list.find(g => g.name === 'Basket Hoop');
    const unlocked = list.filter(g => g.name !== 'Basket Hoop' && user.unlockedGames.includes(g.name));
    const locked = list.filter(g => g.name !== 'Basket Hoop' && !user.unlockedGames.includes(g.name));
    
    // Sort each group
    const sortFn = sortBy === 'popular' 
      ? (a, b) => b.plays - a.plays
      : (a, b) => a.name.localeCompare(b.name);
    
    unlocked.sort(sortFn);
    locked.sort(sortFn);
    
    // Combine: Basket Hoop first, then unlocked, then locked
    const result = [];
    if (basketHoop) result.push(basketHoop);
    result.push(...unlocked);
    result.push(...locked);
    
    return result;
  }, [query, sortBy, user.unlockedGames]);

  // Load user profile and time status
  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const [profileRes, timeRes] = await Promise.all([
          api.get('auth/profile'),
          fetch(`${apiBase}/game/time-status`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(r => {
            if (!r.ok) {
              console.warn('Time status check failed on load:', r.status);
              // Return default that allows play
              return { 
                success: true, 
                canPlay: true, 
                remainingTimeMs: 10 * 60 * 1000,
                remainingTimeMinutes: 10,
                remainingTimeSeconds: 0,
                resetInMinutes: 60,
                resetInSeconds: 0
              };
            }
            return r.json();
          }).catch(err => {
            console.warn('Time status check error on load:', err);
            // Return default that allows play - backend will verify on start
            return { 
              success: true, 
              canPlay: true, 
              remainingTimeMs: 10 * 60 * 1000,
              remainingTimeMinutes: 10,
              remainingTimeSeconds: 0,
              resetInMinutes: 60,
              resetInSeconds: 0
            };
          })
        ]);
        
        if (!mounted) return;
        
        if (profileRes && profileRes.user) {
          setUser({ 
            points: profileRes.user.points || 0, 
            unlockedGames: profileRes.user.unlockedGames || ['Basket Hoop'] 
          });
        }
        
        // Always set time status, even if null or failed
        if (timeRes) {
          // Ensure all required fields are present
          const normalizedTimeStatus = {
            ...timeRes,
            success: timeRes.success !== false,
            canPlay: timeRes.canPlay !== false,
            remainingTimeMinutes: timeRes.remainingTimeMinutes ?? Math.floor((timeRes.remainingTimeMs || 10 * 60 * 1000) / 60000),
            remainingTimeSeconds: timeRes.remainingTimeSeconds ?? Math.floor(((timeRes.remainingTimeMs || 10 * 60 * 1000) % 60000) / 1000),
            resetInMinutes: timeRes.resetInMinutes ?? 60,
            resetInSeconds: timeRes.resetInSeconds ?? 0
          };
          setTimeStatus(normalizedTimeStatus);
        } else {
          // If timeRes is null, set default that allows play
          setTimeStatus({
            success: true,
            canPlay: true,
            remainingTimeMs: 10 * 60 * 1000,
            remainingTimeMinutes: 10,
            remainingTimeSeconds: 0,
            resetInMinutes: 60,
            resetInSeconds: 0
          });
        }
      } catch (err) {
        console.debug('Could not load data for games page', err.message);
      }
    }
    loadData();
    
    // Refresh time status and points every 30 seconds
    const interval = setInterval(async () => {
      try {
        const [timeRes, profileRes] = await Promise.all([
          fetch(`${apiBase}/game/time-status`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(r => r.json()).catch(() => null),
          api.get('auth/profile').catch(() => null)
        ]);
        
        if (timeRes && timeRes.success) setTimeStatus(timeRes);
        if (profileRes && profileRes.user) {
          setUser(prev => ({
            ...prev,
            points: profileRes.user.points || 0,
            unlockedGames: profileRes.user.unlockedGames || prev.unlockedGames
          }));
        }
      } catch (e) {
        console.debug('Periodic refresh error:', e);
      }
    }, 30000);
    
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [token, apiBase]);

  // Update time display while game is active
  useEffect(() => {
    if (activeGame && gameStartTime) {
      gameTimeIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - gameStartTime;
        if (timeStatus) {
          const remaining = Math.max(0, timeStatus.remainingTimeMs - elapsed);
          if (remaining <= 0) {
            handleEndGame();
          }
        }
      }, 1000);
      
      return () => {
        if (gameTimeIntervalRef.current) {
          clearInterval(gameTimeIntervalRef.current);
        }
      };
    }
  }, [activeGame, gameStartTime, timeStatus]);

  async function handleUnlockRandom() {
    try {
      setUnlocking(true);
      const res = await api.post('game/unlock');
      console.log('Unlock response:', res); // Debug log
      if (res && res.success) {
        // Update state immediately with response data - ensure points decrease right away
        // Use the exact values from the response, ensuring they're numbers/arrays
        const newPoints = typeof res.points === 'number' ? res.points : Number(res.points) || 0;
        const newUnlockedGames = Array.isArray(res.unlockedGames) ? res.unlockedGames : (res.unlockedGames || []);
        
        console.log('Updating points from', user.points, 'to', newPoints); // Debug log
        
        // Force immediate state update - use functional update to ensure we get latest state
        setUser(prev => ({
          points: newPoints,
          unlockedGames: newUnlockedGames.length > 0 ? newUnlockedGames : prev.unlockedGames
        }));

        // Notify dashboard/top-bar so global points display refreshes immediately
        try {
          const event = new CustomEvent('pointsUpdated', {
            detail: {
              earned: 0,
              pointsEarned: 0,
              newTotal: newPoints,
            },
          });
          window.dispatchEvent(event);
          console.log('[GamesPage] Dispatched pointsUpdated event after unlock', {
            newTotal: newPoints,
          });
        } catch (e) {
          console.warn('[GamesPage] Failed to dispatch pointsUpdated event', e);
        }
        
        if (res.unlocked) {
          setUnlockedGame(res.unlocked);
          setTimeout(() => setUnlockedGame(null), 5000);
        }
      } else {
        const errorMsg = res?.error || 'Failed to unlock game';
        alert(errorMsg);
      }
    } catch (err) {
      console.error('Unlock error:', err); // Debug log
      const msg = err?.response?.data?.error || err?.message || 'Failed to unlock';
      alert(msg);
    } finally {
      setUnlocking(false);
    }
  }

  function handlePlayGame(game, e) {
    // Prevent any default navigation
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Check if game is unlocked
    if (!user.unlockedGames.includes(game.name)) {
      alert('This game is locked! Unlock it with points first.');
      return;
    }

    // INSTANT GAME LOADING: Set game active immediately (don't wait for backend calls)
    // This makes the iframe appear instantly, just like standalone app
    setActiveGame(game);
    setGameStartTime(Date.now());
    gameStartTimeRef.current = Date.now();

    // Check time status and start game in background (non-blocking)
    // Don't wait for these - let game load immediately
    Promise.all([
      fetch(`${apiBase}/game/time-status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => {
        if (!r.ok) return { success: true, canPlay: true, remainingTimeMs: 10 * 60 * 1000 };
        return r.json();
      }).catch(() => ({ success: true, canPlay: true, remainingTimeMs: 10 * 60 * 1000 })),
      
      fetch(`${apiBase}/game/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ gameName: game.name })
      }).then(r => {
        if (!r.ok) return { success: true, canPlay: true };
        return r.json();
      }).catch(() => ({ success: true, canPlay: true }))
    ]).then(([timeRes, startRes]) => {
      // Update time status if we got valid data
      if (timeRes && timeRes.success !== false) {
        const normalizedTimeStatus = {
          ...timeRes,
          canPlay: timeRes.canPlay !== false,
          remainingTimeMinutes: timeRes.remainingTimeMinutes ?? Math.floor((timeRes.remainingTimeMs || 10 * 60 * 1000) / 60000),
          remainingTimeSeconds: timeRes.remainingTimeSeconds ?? Math.floor(((timeRes.remainingTimeMs || 10 * 60 * 1000) % 60000) / 1000),
          resetInMinutes: timeRes.resetInMinutes ?? 0,
          resetInSeconds: timeRes.resetInSeconds ?? 0
        };
        setTimeStatus(normalizedTimeStatus);
        
        // Only block if explicitly told we can't play
        if (timeRes.canPlay === false) {
          const resetMin = timeRes.resetInMinutes ?? 0;
          const resetSec = timeRes.resetInSeconds ?? 0;
          let timeStr = '';
          if (resetMin > 0) {
            timeStr = `${resetMin}m ${resetSec}s`;
          } else if (resetSec > 0) {
            timeStr = `${resetSec}s`;
          } else {
            timeStr = 'soon';
          }
          alert(`Game time limit reached! You can play again in ${timeStr}.`);
          // Close the game if time limit reached
          setActiveGame(null);
          setGameStartTime(null);
          gameStartTimeRef.current = null;
          return;
        }
      }

      // Check if startGame explicitly blocked due to time limit
      if (startRes && startRes.success === false && startRes.error && startRes.error.includes('time limit')) {
        const resetMin = startRes.resetInMinutes ?? 0;
        const resetSec = startRes.resetInSeconds ?? 0;
        let timeStr = '';
        if (resetMin > 0) {
          timeStr = `${resetMin}m ${resetSec}s`;
        } else if (resetSec > 0) {
          timeStr = `${resetSec}s`;
        } else {
          timeStr = 'soon';
        }
        alert(`Game time limit reached! You can play again in ${timeStr}.`);
        setTimeStatus({ ...timeRes, ...startRes });
        // Close the game if time limit reached
        setActiveGame(null);
        setGameStartTime(null);
        gameStartTimeRef.current = null;
        return;
      }

      // Update time status with startGame response if available
      if (startRes && startRes.success && startRes.remainingTimeMs !== undefined) {
        setTimeStatus({
          ...timeRes,
          canPlay: startRes.canPlay !== false,
          remainingTimeMs: startRes.remainingTimeMs,
          remainingTimeMinutes: Math.floor(startRes.remainingTimeMs / 60000),
          remainingTimeSeconds: Math.floor((startRes.remainingTimeMs % 60000) / 1000),
          resetTime: startRes.resetTime,
          resetInMinutes: startRes.resetInMinutes || 0,
          resetInSeconds: 0
        });
      } else if (startRes && startRes.success) {
        setTimeStatus({ ...timeRes, ...startRes });
      }
    }).catch(err => {
      console.debug('Background game start operations failed:', err);
      // Game is already showing, so continue
    });
  }

  function handleEndGame(e) {
    // Prevent event propagation
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Store current game info before clearing state
    const currentGame = activeGame;
    const startTime = gameStartTimeRef.current;
    
    // Close immediately for instant response (don't wait for async operations)
    setActiveGame(null);
    setGameStartTime(null);
    gameStartTimeRef.current = null;
    if (gameTimeIntervalRef.current) {
      clearInterval(gameTimeIntervalRef.current);
      gameTimeIntervalRef.current = null;
    }
    
    // Clean up in background (don't block UI)
    if (currentGame && startTime) {
      const timePlayed = Date.now() - startTime;
      
      // Fire and forget - don't wait for response
      fetch(`${apiBase}/game/end`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          gameName: currentGame.name, 
          timePlayedMs: timePlayed 
        })
      }).catch(err => console.debug('Game end tracking failed:', err));
      
      // Refresh time status in background
      fetch(`${apiBase}/game/time-status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(r => r.json())
      .then(timeRes => {
        if (timeRes && timeRes.success) {
          setTimeStatus(timeRes);
        }
      })
      .catch(err => console.debug('Time status refresh failed:', err));
    }
  }

  const formatTime = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getRemainingTime = () => {
    if (!activeGame || !gameStartTime || !timeStatus) return null;
    const elapsed = Date.now() - gameStartTime;
    const remaining = Math.max(0, timeStatus.remainingTimeMs - elapsed);
    return remaining;
  };

  return (
    <div className="games-page">
      {/* Unlock Animation */}
      {unlockedGame && (
        <div className="unlock-animation">
          <div className="unlock-content">
            <div className="unlock-icon">🎉</div>
            <h3>Game Unlocked!</h3>
            <p>{unlockedGame}</p>
          </div>
        </div>
      )}

      <div className="games-header">
        <div className="header-content">
          <h2>🎮 Game Arcade</h2>
          <p>Earn points from quizzes to unlock new games!</p>
        </div>
        <div className="games-controls">
          <input 
            className="search-input" 
            placeholder="Search games..." 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
          />
          <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="popular">Most Played</option>
            <option value="name">A → Z</option>
          </select>
        </div>
      </div>

      <div className="games-header-sub">
        <div className="stats-section">
          <div className="stat-card points-card">
            <div className="stat-icon">💰</div>
            <div className="stat-info">
              <span className="stat-label">Points</span>
              <span className="stat-value">{user.points}</span>
            </div>
          </div>
          
          {timeStatus && (
            <div className={`stat-card time-card ${!timeStatus.canPlay ? 'time-limit' : ''}`}>
              <div className="stat-icon">⏱️</div>
              <div className="stat-info">
                <span className="stat-label">Game Time</span>
                <span className="stat-value">
                  {timeStatus.canPlay 
                    ? `${timeStatus.remainingTimeMinutes || 0}m ${timeStatus.remainingTimeSeconds || 0}s`
                    : (() => {
                        const resetMin = timeStatus.resetInMinutes ?? 0;
                        const resetSec = timeStatus.resetInSeconds ?? 0;
                        if (resetMin > 0) {
                          return `Resets in ${resetMin}m ${resetSec}s`;
                        } else if (resetSec > 0) {
                          return `Resets in ${resetSec}s`;
                        } else {
                          return 'Resets soon';
                        }
                      })()
                  }
                </span>
              </div>
            </div>
          )}

          {activeGame && getRemainingTime() !== null && (
            <div className="stat-card active-game-card">
              <div className="stat-icon">🎯</div>
              <div className="stat-info">
                <span className="stat-label">Time Left</span>
                <span className="stat-value">{formatTime(getRemainingTime())}</span>
              </div>
            </div>
          )}
        </div>

        <div className="unlock-actions">
          <button 
            className="unlock-btn" 
            onClick={handleUnlockRandom} 
            disabled={unlocking || (user.points || 0) < 950}
          >
            {unlocking ? (
              <>
                <span className="spinner-small"></span>
                Unlocking...
              </>
            ) : (
              <>
                <span>🎲</span>
                Unlock Random Game (950 pts)
              </>
            )}
          </button>
        </div>
      </div>

      <div className="games-grid">
        {filtered.map((g, i) => {
          const locked = !user.unlockedGames.includes(g.name);
          const isBasketHoop = g.name === 'Basket Hoop';
          
          return (
            <div 
              key={i} 
              className={`game-card ${locked ? 'locked' : ''} ${isBasketHoop ? 'starter-game' : ''}`}
            >
              {isBasketHoop && <div className="starter-badge">FREE</div>}
              {locked && <div className="lock-overlay">🔒</div>}
              
              <div className="game-thumb-container">
                <img 
                  className="game-thumb" 
                  src={g.img} 
                  alt={g.name} 
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/assets/game_fallback.png';
                  }} 
                />
              </div>
              
              <div className="game-title">{g.name}</div>
              <div className="game-desc">{g.desc}</div>
              
              <div className="card-footer">
                <div className="plays-badge">▶ {g.plays}</div>
                {locked ? (
                  <button 
                    className="locked-btn" 
                    onClick={handleUnlockRandom}
                    disabled={unlocking || (user.points || 0) < 950}
                  >
                    🔒 Locked
                  </button>
                ) : (
                  <button 
                    className="play-btn" 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handlePlayGame(g, e);
                    }}
                    disabled={timeStatus && !timeStatus.canPlay}
                    type="button"
                  >
                    ▶ Play
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {activeGame && (
        <div className="game-modal" role="dialog" aria-modal="true">
          <div className="game-modal-content">
            <div className="game-modal-header">
              <div className="modal-title-section">
                <h3>{activeGame.name}</h3>
                {getRemainingTime() !== null && (
                  <div className="time-indicator">
                    ⏱️ {formatTime(getRemainingTime())} remaining
                  </div>
                )}
              </div>
              <button 
                className="game-modal-close" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleEndGame(e);
                }}
                type="button"
                aria-label="Close game"
              >✕</button>
            </div>
            <div className="game-modal-body">
              <iframe 
                key={activeGame.url} // Force re-render on game change
                title={activeGame.name} 
                src={activeGame.url}
                allow="fullscreen; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                frameBorder="0"
                scrolling="no"
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  border: 'none', 
                  display: 'block',
                  backgroundColor: '#000'
                }}
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-presentation allow-top-navigation-by-user-activation allow-modals"
                loading="eager"
                referrerPolicy="no-referrer-when-downgrade"
                onLoad={(e) => {
                  console.log('Game iframe loaded successfully:', activeGame.name);
                }}
                onError={(e) => {
                  console.error('Iframe load error for', activeGame.name, ':', e);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
