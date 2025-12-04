import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import useSession from '../hooks/useSession';
import './BasicChat.css';

// NOTE: backend server default used here; update if your API lives elsewhere
const BACKEND_URL = process.env.REACT_APP_SOCKET_URL || process.env.REACT_APP_API_BASE?.replace('/api/v1', '') || 'https://studybuddy-backend-i649.onrender.com';

const BasicChat = ({ moduleId, type = 'module' }) => {
    const { user } = useSession();
    const [socket, setSocket] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [connected, setConnected] = useState(false);
    const [roomId, setRoomId] = useState(null);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (!moduleId && type === 'module') return;

        let mounted = true;
        const token = localStorage.getItem('token') || '';

        // Ensure we have the ChatRoom._id for this module (backend will create if missing)
        const ensureRoom = async () => {
            try {
                const res = await fetch(`${BACKEND_URL}/api/v1/auth/chat/module/${moduleId}`, {
                    headers: {
                        Authorization: 'Bearer ' + token
                    }
                });
                const payload = await res.json();
                if (!mounted) return;
                if (payload && payload.success && payload.room && payload.room._id) {
                    setRoomId(payload.room._id);
                    // Now connect socket and join the correct chat room
                    const newSocket = io(BACKEND_URL, {
                        auth: { token },
                        transports: ['websocket']
                    });

                    newSocket.on('connect', () => {
                        setConnected(true);
                        // join using ChatRoom._id
                        newSocket.emit('joinRoom', { roomId: payload.room._id });
                    });

                    newSocket.on('roomHistory', (history) => setMessages(history || []));
                    newSocket.on('newMessage', (message) => {
                        if (typeof console !== 'undefined' && console.debug) console.debug('BasicChat: incoming newMessage payload', message);
                        setMessages(prev => {
                            // correlate by server-provided _clientId first
                            const pendingIdxByClient = message._clientId ? prev.findIndex(m => m._localId === message._clientId) : -1;
                            if (pendingIdxByClient !== -1) {
                                const copy = prev.slice();
                                copy[pendingIdxByClient] = message;
                                return copy;
                            }
                            // try to match and replace a recent optimistic pending message
                            const pendingIdx = prev.findIndex(m => m.pending && m.content === message.content && (m.sender?.name === (message.sender?.name || 'You')));
                            if (pendingIdx !== -1) {
                                const copy = prev.slice();
                                copy[pendingIdx] = message;
                                return copy;
                            }
                            return [...prev, message];
                        });
                    });
                    newSocket.on('disconnect', () => setConnected(false));
                    newSocket.on('error', (err) => console.error('Chat socket error', err));

                    setSocket(newSocket);
                } else {
                    console.error('Failed to get/create chat room', payload);
                }
            } catch (err) {
                console.error('Failed to ensure chat room:', err);
            }
        };

        if (type === 'module') {
            ensureRoom();
        } else if (type === 'global') {
            // TODO: handle global room creation endpoint if needed
        }

        return () => {
            mounted = false;
            if (socket) {
                if (roomId) socket.emit('leaveRoom', { roomId });
                socket.disconnect();
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [moduleId, type]);

    const sendMessage = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const text = newMessage.trim();
        if (!text) return;
        if (!roomId) return console.warn('No chat room id yet');
        if (sending) return;

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
    if (typeof console !== 'undefined' && console.debug) console.debug('BasicChat: optimistic localMsg', localMsg);

        try {
            const token = localStorage.getItem('token') || '';
            const res = await fetch(`${BACKEND_URL}/api/v1/auth/chat/rooms/${roomId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token
                },
                body: JSON.stringify({ content: text, _clientId: localMsg._localId })
            });
            const payload = await res.json();
            if (!payload || !payload.success) {
                console.error('Failed to post message', payload);
                setMessages(prev => prev.map(m => m._localId === localMsg._localId ? { ...m, failed: true, pending: false } : m));
            }
            // server will emit newMessage which will replace the optimistic entry
        } catch (err) {
            console.error('sendMessage failed', err);
            setMessages(prev => prev.map(m => m._localId === localMsg._localId ? { ...m, failed: true, pending: false } : m));
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="basic-chat">
            <div className="chat-status">
                {connected ? '🟢 Connected' : '🔴 Disconnected'}
            </div>
            <div className="messages-container">
                {messages.map((msg, index) => {
                    const isOwn = (msg.sender && msg.sender._id && String(msg.sender._id) === String(user?._id)) || !!msg._localId;
                    const roleClass = isOwn ? 'sent' : 'received';
                    const senderName = isOwn ? 'You' : (msg.sender?.name || 'Anonymous');
                    
                    return (
                        <div key={msg._id || msg._localId || index} className={`message-wrapper ${roleClass}`}>
                            <div className={`message ${roleClass} ${msg.failed ? 'failed' : ''} ${msg.pending ? 'pending' : ''}`}>
                                <div className="message-sender">{senderName}</div>
                                <div className="message-text">{msg.content}</div>
                                <div className="message-time">
                                    {new Date(msg.createdAt || msg.timestamp || Date.now()).toLocaleTimeString()}
                                </div>
                            </div>
                            {msg.pending && (
                                <div className="message-status">Sending...</div>
                            )}
                            {msg.failed && (
                                <div className="message-status">Failed to send</div>
                            )}
                        </div>
                    );
                })}
            </div>
            <form onSubmit={sendMessage} className="message-form">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    disabled={!connected || !roomId}
                />
                <button type="submit" disabled={!connected || !roomId || sending}>Send</button>
            </form>
        </div>
    );
};

export default BasicChat;