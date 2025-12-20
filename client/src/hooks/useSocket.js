import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

// Usage: const { socket, connect, disconnect, sendMessage, messages } = useSocket();
export default function useSocket({ url = process.env.REACT_APP_SOCKET_URL || process.env.REACT_APP_API_BASE?.replace('/api/v1', '') || 'https://studybuddy-backend-i649.onrender.com' } = {}) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    }
  }, []);

  const connect = () => {
    if (socketRef.current) return;
    const token = localStorage.getItem('token') || '';
    const socket = io(url, { transports: ['websocket'], auth: { token } });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('roomHistory', (history) => {
      setMessages(history || []);
    });

    socket.on('newMessage', (msg) => {
      setMessages(prev => [...prev, msg]);
    });
  };

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  const joinRoom = (roomId, userId) => {
    if (!socketRef.current) return;
    socketRef.current.emit('joinRoom', { roomId, userId });
  };

  const leaveRoom = (roomId) => {
    if (!socketRef.current) return;
    socketRef.current.emit('leaveRoom', { roomId });
  };

  const sendMessage = ({ roomId, senderId, content, attachments }) => {
    // Use HTTP POST to server so backend handles persistence and emission
    if (!roomId) return;
    const token = localStorage.getItem('token') || '';
    fetch(`${url}/api/v1/auth/chat/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ content, attachments })
    }).catch(err => console.error('sendMessage error', err));
  };

  return { socket: socketRef.current, connected, connect, disconnect, joinRoom, leaveRoom, sendMessage, messages };
}
