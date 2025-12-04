import React, { useState, useEffect, useRef } from 'react';
import useSession from '../hooks/useSession';
import io from 'socket.io-client';
import './ChatInterface.css';

const BACKEND_URL = process.env.REACT_APP_SOCKET_URL || process.env.REACT_APP_API_BASE?.replace('/api/v1', '') || 'https://studybuddy-backend-i649.onrender.com';

const ChatInterface = ({ moduleId }) => {
  const { user } = useSession();
  const [activeChat, setActiveChat] = useState('group'); // 'group' or userId for private chats
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [moduleMembers, setModuleMembers] = useState([]);
  const [sending, setSending] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const messagesEndRef = useRef(null);
  const [showUserProfile, setShowUserProfile] = useState(false);

  useEffect(() => {
    if (!moduleId) return;
    let mounted = true;
    const token = localStorage.getItem('token') || '';

    const setup = async () => {
      try {
        // Fetch module members
        const membersRes = await fetch(`${BACKEND_URL}/api/v1/auth/modules/${moduleId}/members`, {
          headers: { Authorization: 'Bearer ' + token }
        });
        const membersPayload = await membersRes.json();
        if (mounted && membersPayload && membersPayload.success) setModuleMembers(membersPayload.members);

        // Support group/module chat and private (DM) chats
        if (activeChat === 'group') {
          // Get or create module chat room
          const roomRes = await fetch(`${BACKEND_URL}/api/v1/auth/chat/module/${moduleId}`, { headers: { Authorization: 'Bearer ' + token } });
          const roomPayload = await roomRes.json();
          if (!mounted) return;
          if (roomPayload && roomPayload.success && roomPayload.room && roomPayload.room._id) {
            const rId = roomPayload.room._id;
            setRoomId(rId);
            setSocket(null);
            const newSocket = io(BACKEND_URL, { auth: { token }, transports: ['websocket'] });

            newSocket.on('connect', () => {
              console.log('ChatInterface socket connected', newSocket.id, 'group room', rId);
              newSocket.emit('joinRoom', { roomId: rId });
            });

            newSocket.on('roomHistory', (history) => { console.log('ChatInterface group roomHistory', rId, 'count=', (history||[]).length); setMessages(history || []); scrollToBottom(); });
            newSocket.on('newMessage', (message) => {
              console.log('ChatInterface newMessage', message._id || message._localId, 'group', rId);
              setMessages(prev => {
                // correlate by server-provided client id first
                const pendingIdxByClient = message._clientId ? prev.findIndex(m => m._localId === message._clientId) : -1;
                if (pendingIdxByClient !== -1) {
                  const copy = prev.slice();
                  copy[pendingIdxByClient] = message;
                  return copy;
                }
                // try a heuristic match by pending and identical content
                const pendingIdx = prev.findIndex(m => m.pending && m.content === message.content && (m.sender?.name === (message.sender?.name || 'You')));
                if (pendingIdx !== -1) {
                  const copy = prev.slice();
                  copy[pendingIdx] = message;
                  return copy;
                }
                  return [...prev, message];
              });
                if (typeof console !== 'undefined' && console.debug) console.debug('ChatInterface: incoming newMessage payload', message);
              scrollToBottom();
            });

            setSocket(newSocket);
          } else {
            console.error('Failed to get/create module chat room', roomPayload);
          }
        } else {
          // Private chat (direct message) - create/find DM room between current user and selected user
          try {
            const dmRes = await fetch(`${BACKEND_URL}/api/v1/auth/chat/dm`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
              body: JSON.stringify({ userId: activeChat })
            });
            const dmPayload = await dmRes.json();
            if (!dmPayload || !dmPayload.success || !dmPayload.room || !dmPayload.room._id) {
              console.error('Failed to get/create DM room', dmPayload);
              return;
            }
            const rId = dmPayload.room._id;
            setRoomId(rId);
            setSocket(null);
            const newSocket = io(BACKEND_URL, { auth: { token }, transports: ['websocket'] });

            newSocket.on('connect', () => {
              console.log('ChatInterface DM socket connected', newSocket.id, 'dm room', rId);
              newSocket.emit('joinRoom', { roomId: rId });
            });

            newSocket.on('roomHistory', (history) => { console.log('ChatInterface DM roomHistory', rId, 'count=', (history||[]).length); setMessages(history || []); scrollToBottom(); });
            newSocket.on('newMessage', (message) => {
              console.log('ChatInterface DM newMessage', message._id || message._localId, 'dm', rId);
              setMessages(prev => {
                const pendingIdxByClient = message._clientId ? prev.findIndex(m => m._localId === message._clientId) : -1;
                if (pendingIdxByClient !== -1) {
                  const copy = prev.slice();
                  copy[pendingIdxByClient] = message;
                  return copy;
                }
                const pendingIdx = prev.findIndex(m => m.pending && m.content === message.content && (m.sender?.name === (message.sender?.name || 'You')));
                if (pendingIdx !== -1) {
                  const copy = prev.slice();
                  copy[pendingIdx] = message;
                  return copy;
                }
                return [...prev, message];
              });
                      if (typeof console !== 'undefined' && console.debug) console.debug('ChatInterface: incoming newMessage payload', message);
                      scrollToBottom();
            });

            setSocket(newSocket);
          } catch (err) {
            console.error('Failed to setup DM chat', err);
          }
        }
      } catch (err) {
        console.error('Chat setup failed:', err);
      }
    };

    setup();

    return () => {
      mounted = false;
      if (socket) {
        socket.disconnect();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, activeChat]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    if (!socket) return console.warn('No socket connection');

    // For group chat we use the rooms POST API so backend persists and emits
              if (activeChat === 'group') {
      if (sending) return;
      const text = newMessage.trim();
      const localMsg = {
        _localId: 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2,7),
        sender: { name: user?.displayName || user?.name || 'You', _id: user?._id },
        content: text,
        createdAt: new Date().toISOString(),
        pending: true
      };
      setMessages(prev => [...prev, localMsg]);
      setNewMessage('');
      setSending(true);
  if (typeof console !== 'undefined' && console.debug) console.debug('ChatInterface: optimistic localMsg (group)', localMsg);
      try {
        // Ensure socket is in the room before POSTing; if not, attempt a quick rejoin
        if (socket && rId) {
          try {
            const isInRoom = socket.rooms ? (socket.rooms instanceof Set ? socket.rooms.has(rId) : !!socket.rooms[rId]) : false;
            if (!isInRoom) {
              console.warn('ChatInterface: socket not in group room before POST, attempting rejoin', { socketId: socket.id, roomId: rId });
              socket.emit('joinRoom', { roomId: rId });
              await new Promise(r => setTimeout(r, 250));
            }
          } catch (chkErr) {
            console.warn('ChatInterface group rejoin check error', chkErr);
          }
        }
        const token = localStorage.getItem('token') || '';
        const rId = roomId || (await (await fetch(`${BACKEND_URL}/api/v1/auth/chat/module/${moduleId}`, { headers: { Authorization: 'Bearer ' + token } })).json()).room?._id;
        if (!rId) throw new Error('No room id');
        const res = await fetch(`${BACKEND_URL}/api/v1/auth/chat/rooms/${rId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ content: text, _clientId: localMsg._localId })
        });
        const payload = await res.json();
        if (!payload || !payload.success) {
          console.error('Failed to post message', payload);
          setMessages(prev => prev.map(m => m._localId === localMsg._localId ? { ...m, failed: true, pending: false } : m));
        }
      } catch (err) {
        console.error('Failed to send group message:', err);
        setMessages(prev => prev.map(m => m._localId === localMsg._localId ? { ...m, failed: true, pending: false } : m));
      } finally {
        setSending(false);
      }
    } else {
      // Private/direct message: use the DM roomId created in setup()
      if (sending) return;
      const text = newMessage.trim();
      const localMsg = {
        _localId: 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2,7),
        sender: { name: user?.displayName || user?.name || 'You' },
        content: text,
        createdAt: new Date().toISOString(),
        pending: true
      };
      setMessages(prev => [...prev, localMsg]);
      setNewMessage('');
      setSending(true);
  if (typeof console !== 'undefined' && console.debug) console.debug('ChatInterface: optimistic localMsg (dm)', localMsg);
      try {
        // Ensure socket is in the DM room before POSTing; if not, attempt a quick rejoin
        if (socket && roomId) {
          try {
            const isInRoom = socket.rooms ? (socket.rooms instanceof Set ? socket.rooms.has(roomId) : !!socket.rooms[roomId]) : false;
            if (!isInRoom) {
              console.warn('ChatInterface: socket not in DM room before POST, attempting rejoin', { socketId: socket.id, roomId });
              socket.emit('joinRoom', { roomId });
              await new Promise(r => setTimeout(r, 250));
            }
          } catch (chkErr) {
            console.warn('ChatInterface DM rejoin check error', chkErr);
          }
        }
        const token = localStorage.getItem('token') || '';
        const rId = roomId || (await (await fetch(`${BACKEND_URL}/api/v1/auth/chat/dm`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ userId: activeChat }) })).json()).room?._id;
        if (!rId) throw new Error('No room id');
        const res = await fetch(`${BACKEND_URL}/api/v1/auth/chat/rooms/${rId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ content: text, _clientId: localMsg._localId })
        });
        const payload = await res.json();
        if (!payload || !payload.success) {
          console.error('Failed to post DM message', payload);
          setMessages(prev => prev.map(m => m._localId === localMsg._localId ? { ...m, failed: true, pending: false } : m));
        }
      } catch (err) {
        console.error('Failed to send DM message:', err);
        setMessages(prev => prev.map(m => m._localId === localMsg._localId ? { ...m, failed: true, pending: false } : m));
      } finally {
        setSending(false);
      }
    }
  };

  const switchChat = (chatId) => {
    setActiveChat(chatId);
    setShowUserProfile(false);
  };

  const showProfile = (member) => {
    setSelectedUser(member);
    setShowUserProfile(true);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="chat-interface">
      <div className="chat-sidebar">
        <div className="chat-options">
          <button 
            className={activeChat === 'group' ? 'active' : ''} 
            onClick={() => switchChat('group')}
          >
            Group Chat
          </button>
          <div className="members-list">
            <h3>Module Members</h3>
            {moduleMembers.map(member => (
              <div 
                key={member._id} 
                className={`member-item ${activeChat === member._id ? 'active' : ''}`}
              >
                <div 
                  className="member-name" 
                  onClick={() => switchChat(member._id)}
                >
                  {member.name}
                </div>
                <button 
                  className="view-profile-btn"
                  onClick={() => showProfile(member)}
                >
                  Profile
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="chat-main">
        {!showUserProfile ? (
          <>
            <div className="chat-header">
              <h2>{activeChat === 'group' ? 'Module Group Chat' : `Chat with ${moduleMembers.find(m => m._id === activeChat)?.name}`}</h2>
            </div>

            <div className="chat-messages">
              {messages.map((msg, index) => {
                const isOwn = (msg.sender && msg.sender._id && String(msg.sender._id) === String(user?._id)) || !!msg._localId;
                const roleClass = isOwn ? 'own-message sent' : 'received';
                return (
                  <div key={index} className={`message ${roleClass} ${msg.failed ? 'failed' : ''}`}>
                    <div className="message-content">
                      <div className="message-sender">{msg.sender?.name || (msg._localId ? 'You' : 'Anonymous')}</div>
                      <div className="message-text">
                        {msg.content}
                        {msg.pending && <em style={{ marginLeft: 8, fontSize: 12 }}>sending…</em>}
                        {msg.failed && <em style={{ marginLeft: 8, color: 'red', fontSize: 12 }}>failed</em>}
                      </div>
                      <div className="message-time">{formatTime(msg.createdAt || msg.timestamp)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="chat-input">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                disabled={!roomId || sending}
              />
              <button type="submit" disabled={!roomId || sending}>{sending ? 'Sending…' : 'Send'}</button>
            </form>
          </>
        ) : (
          <div className="user-profile">
            <div className="profile-header">
              <h2>{selectedUser?.name}'s Profile</h2>
              <button onClick={() => setShowUserProfile(false)}>Back to Chat</button>
            </div>
            <div className="profile-content">
              <div className="profile-info">
                <img 
                  src={selectedUser?.avatar || 'default-avatar.png'} 
                  alt="Profile" 
                  className="profile-avatar"
                />
                <h3>{selectedUser?.name}</h3>
                <p>Email: {selectedUser?.email}</p>
                <p>Role: {selectedUser?.role || 'Member'}</p>
              </div>
              <div className="profile-stats">
                <h3>Study Stats</h3>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-value">{selectedUser?.modules?.length || 0}</span>
                    <span className="stat-label">Modules</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{selectedUser?.completedQuizzes || 0}</span>
                    <span className="stat-label">Quizzes Completed</span>
                  </div>
                </div>
              </div>
              <button 
                className="start-chat-btn"
                onClick={() => switchChat(selectedUser?._id)}
              >
                Start Private Chat
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;