import React, { useState, useRef, useEffect } from 'react';
import './AiChatPanel.css';

const AiChatPanel = ({ messages, onSendMessage }) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    onSendMessage(newMessage.trim());
    setNewMessage('');
  };

  return (
    <div className="ai-chat-panel">
      <div className="ai-chat-messages">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`ai-message ${msg.sender === 'user' ? 'user-message' : 'ai-response'}`}
          >
            <div className="message-content">
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="ai-chat-input">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your doubt here..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
};

export default AiChatPanel;