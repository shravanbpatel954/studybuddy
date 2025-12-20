import React, { useState, useEffect, useRef } from 'react';
import useSession from '../hooks/useSession';
import useSpeechRecognition from '../hooks/useSpeechRecognition';
import io from 'socket.io-client';
import './ChatPanel.css';

const BACKEND_URL = process.env.REACT_APP_SOCKET_URL || process.env.REACT_APP_API_BASE?.replace('/api/v1', '') || 'https://studybuddy-backend-i649.onrender.com';

const ChatPanel = ({ moduleId, isGlobal = false }) => {
  const { user } = useSession();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const { isListening, transcript, error, startListening, stopListening, resetTranscript, isSupported } = useSpeechRecognition();

  console.log('ChatPanel render - user:', user?._id, 'roomId:', roomId, 'socket:', socket?.connected);

  // scroll function
  const scrollToBottom = (smooth = true) => {
    const container = messagesContainerRef.current;
    if (container) {
      try {
        container.scrollTo({ top: container.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
      } catch (e) {
        container.scrollTop = container.scrollHeight;
      }
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  };

  // auto scroll after messages change
  useEffect(() => {
    const id = setTimeout(() => scrollToBottom(true), 50);
    return () => clearTimeout(id);
  }, [messages.length]);

  // connect socket and fetch room
  useEffect(() => {
    if (!moduleId && !isGlobal) return;
    let mounted = true;
    const token = localStorage.getItem('token') || '';

    const ensureRoomAndConnect = async () => {
      try {
        const newSocket = io(BACKEND_URL, { auth: { token }, transports: ['websocket'] });
        setSocket(newSocket);

        newSocket.on('connect', () => {
          console.log('ChatPanel socket connected', newSocket.id);
        });

        newSocket.on('connect_error', (err) => {
          console.error('ChatPanel socket connect_error', err);
        });

        newSocket.on('roomHistory', (previousMessages) => {
          console.log('ChatPanel roomHistory received, count=', (previousMessages || []).length);
          setMessages(previousMessages || []);
          scrollToBottom();
        });

        newSocket.on('newMessage', (message) => {
          console.log('ChatPanel newMessage received:', message);
          setMessages(prev => {
            if (message._id && prev.some(m => m._id === message._id)) return prev;

            const isOurMessage = user && message.sender && String(message.sender._id) === String(user._id);

            if (message._clientId) {
              const existingIndex = prev.findIndex(m => m._localId === message._clientId);
              if (existingIndex !== -1) {
                const newMessages = [...prev];
                const serverMessage = {
                  ...message,
                  isOwnMessage: true,
                  createdAt: message.createdAt || new Date().toISOString(),
                  sender: message.sender || prev[existingIndex].sender
                };
                newMessages[existingIndex] = serverMessage;
                return newMessages;
              }
            }

            return [
              ...prev,
              {
                ...message,
                isOwnMessage: isOurMessage,
                createdAt: message.createdAt || new Date().toISOString()
              }
            ];
          });
          scrollToBottom();
        });

        newSocket.on('disconnect', () => {
          console.log('ChatPanel socket disconnected');
        });

        newSocket.on('error', (err) => console.error('Chat socket error', err));

        // get or create chat room
        let roomRes;
        if (isGlobal) {
          roomRes = await fetch(`${BACKEND_URL}/api/v1/auth/chat/global`, {
            headers: { Authorization: 'Bearer ' + token }
          });
        } else {
          roomRes = await fetch(`${BACKEND_URL}/api/v1/auth/chat/module/${moduleId}`, {
            headers: { Authorization: 'Bearer ' + token }
          });
        }
        const payload = await roomRes.json();
        if (!mounted) return;
        if (payload && payload.success && payload.room && payload.room._id) {
          const rId = payload.room._id;
          setRoomId(rId);
          try {
            newSocket.emit('joinRoom', { roomId: rId });
          } catch (e) {
            console.warn('joinRoom emit failed', e);
          }
        } else {
          console.error('Failed to get/create chat room', payload);
        }
      } catch (err) {
        console.error('Failed to ensure room and connect:', err);
      }
    };

    ensureRoomAndConnect();

    return () => {
      mounted = false;
      if (socket) {
        if (roomId) socket.emit('leaveRoom', { roomId });
        socket.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, isGlobal]);

  // send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;
    setSending(true);

    const text = newMessage.trim();
    setNewMessage('');

    const localMsg = {
      _localId: Date.now() + Math.random(),
      content: text,
      sender: user
        ? { _id: user._id, name: user.name || 'Anonymous', photo: user.photo }
        : { _id: 'anonymous', name: 'Anonymous' },
      isOwnMessage: true,
      createdAt: new Date().toISOString(),
      pending: true,
      failed: false
    };

    setMessages(prev => [...prev, localMsg]);
    scrollToBottom();

    try {
      const token = localStorage.getItem('token') || '';
      if (socket && socket.connected && roomId) {
        socket.emit('sendMessage', { roomId, content: text, _clientId: localMsg._localId });
      } else {
        const res = await fetch(`${BACKEND_URL}/api/v1/auth/chat/rooms/${roomId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ content: text, _clientId: localMsg._localId })
        });
        const payload = await res.json();
        if (!payload?.success) {
          setMessages(prev =>
            prev.map(m => (m._localId === localMsg._localId ? { ...m, failed: true, pending: false } : m))
          );
        }
      }
    } catch (err) {
      console.error('sendMessage failed', err);
      setMessages(prev =>
        prev.map(m => (m._localId === localMsg._localId ? { ...m, failed: true, pending: false } : m))
      );
    } finally {
      setSending(false);
    }
  };

  // handle voice message
  const handleVoiceMessage = () => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      startListening();
    }
  };

  // update message input when transcript changes
  useEffect(() => {
    if (transcript) {
      setNewMessage(transcript);
    }
  }, [transcript]);

  // handle error display
  useEffect(() => {
    if (error) {
      console.error('Speech recognition error:', error);
    }
  }, [error]);

  // render chat
  return (
    <div className="chat-panel">
      <div className="chat-messages" ref={messagesContainerRef}>
        {messages.map((msg) => {
          const isOwn =
            msg.isOwnMessage ||
            msg._localId ||
            (user && msg.sender && String(msg.sender._id) === String(user._id));
          const avatarUrl = msg.sender?.photo || null;
          const initials = msg.sender?.name
            ? msg.sender.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
            : 'U';
          const status = msg.pending ? '' : msg.failed ? '❌' : isOwn ? '✓✓' : '';

          const ts = new Date(msg.createdAt || Date.now());
          const timeStr = ts.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
          const today = new Date();
          let dateStr = '';
          if (ts.toDateString() === today.toDateString()) dateStr = '';
          else if (ts.getFullYear() === today.getFullYear())
            dateStr = ts.toLocaleDateString([], { month: 'short', day: 'numeric' });
          else dateStr = ts.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

          return (
            <div key={msg._id || msg._localId} className={`message${isOwn ? ' own-message' : ' other-message'}`}>
              <div className="message-meta-row">
                <div className="message-avatar">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={msg.sender?.name || 'User'} />
                  ) : (
                    <span className="avatar-initials">{initials}</span>
                  )}
                </div>
                <div className="message-sender">{isOwn ? 'You' : msg.sender?.name || 'Anonymous'}</div>
              </div>
              <div className="message-bubble">
                <div className="message-content">{msg.content}</div>
              </div>
              <div className="message-time-status-row">
                <span className="message-time">
                  {timeStr} {dateStr ? `, ${dateStr}` : ''}
                </span>
                {isOwn && <span className="message-status">{status}</span>}
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
        />
        {isSupported && (
          <button
            type="button"
            className={`mic-button ${isListening ? 'listening' : ''}`}
            onClick={handleVoiceMessage}
            title={isListening ? 'Stop listening' : 'Start voice recording'}
          >
            {isListening ? '🎤 Listening...' : '🎤'}
          </button>
        )}
        <button type="submit" disabled={sending}>Send</button>
      </form>
      {error && <div className="voice-error">{error}</div>}
    </div>
  );
};

export default ChatPanel;
