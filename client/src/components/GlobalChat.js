import React from 'react';
import ChatPanel from '../components/ChatPanel';
import './GlobalChat.css';

const GlobalChat = () => {
  return (
    <div className="global-chat-container">
      <h2>Global Classroom Chat</h2>
      <ChatPanel isGlobal={true} />
    </div>
  );
};

export default GlobalChat;