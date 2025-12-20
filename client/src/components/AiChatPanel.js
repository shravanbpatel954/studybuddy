import React, { useState, useRef, useEffect } from 'react';
import useSpeechRecognition from '../hooks/useSpeechRecognition';
import './AiChatPanel.css';

const AiChatPanel = ({ messages, onSendMessage }) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const { isListening, transcript, error, startListening, stopListening, resetTranscript, isSupported } = useSpeechRecognition();

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
        <button type="submit">Send</button>
      </form>
      {error && <div className="voice-error">{error}</div>}
    </div>
  );
};

export default AiChatPanel;