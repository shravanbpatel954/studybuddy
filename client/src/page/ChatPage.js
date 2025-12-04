import React from 'react';
import GlobalChat from '../components/GlobalChat';
import './ChatPage.css';

export default function ChatPage() {
  return (
    <div className="chat-page">
      <h2 className="chat-title">Chat Room</h2>
      <GlobalChat />
    </div>
  );
}
