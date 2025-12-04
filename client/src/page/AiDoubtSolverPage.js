import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import useSession from '../hooks/useSession';
import { getApiBase } from '../utils/apiConfig';
import './AiDoubtSolverPage.css';
import { jsPDF } from 'jspdf';
import { Trash2 } from 'lucide-react';

// Threaded ChatGPT-like local persistence using localStorage.
// - Threads are stored under `ai_doubt_threads_<userId>`.
// - Legacy single conversation `ai_doubt_<userId>` is migrated automatically on first load.

const makeId = (pref = 't') => `${pref}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;

const AiDoubtSolverPage = () => {
  const { user } = useSession();
  const userId = user?._id || 'anon';
  const threadsKey = `ai_doubt_threads_${userId}`;
  const legacyKey = `ai_doubt_${userId}`;
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Initialize threads and activeThreadId synchronously to avoid UI flicker.
  const [state, setState] = useState(() => {
    try {
      // Try new threads storage first
      const raw = localStorage.getItem(threadsKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.threads)) {
          const threads = parsed.threads;
          const activeId = parsed.activeId || (threads[0] && threads[0].id) || null;
          return { threads, activeId };
        }
      }

      // Migrate legacy single conversation if present
      const legacyRaw = localStorage.getItem(legacyKey);
      if (legacyRaw) {
        try {
          const msgs = JSON.parse(legacyRaw);
          const thread = {
            id: makeId('t'),
            title: 'Conversation',
            messages: Array.isArray(msgs) ? msgs : [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          const threads = [thread];
          // persist migrated threads
          localStorage.setItem(threadsKey, JSON.stringify({ threads, activeId: thread.id }));
          // remove legacy
          localStorage.removeItem(legacyKey);
          return { threads, activeId: thread.id };
        } catch (err) {
          console.warn('Failed migrating legacy AI storage', err);
        }
      }

      // Default: create a starter thread
      const starter = {
        id: makeId('t'),
        title: 'New Conversation',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const threads = [starter];
      localStorage.setItem(threadsKey, JSON.stringify({ threads, activeId: starter.id }));
      return { threads, activeId: starter.id };
    } catch (err) {
      console.warn('Failed to initialize AI threads from storage', err);
      const starter = {
        id: makeId('t'),
        title: 'New Conversation',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      return { threads: [starter], activeId: starter.id };
    }
  });

  const { threads, activeId } = state;
  const messagesEndRef = useRef(null);

  // Helper: get active thread object (must be defined before useEffects that use it)
  const activeThread = threads.find(t => t.id === activeId) || threads[0] || null;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread?.messages]);

  // Cleanup old threads (older than 10 days)
  useEffect(() => {
    const cleanupOldThreads = () => {
      const tenDaysAgo = Date.now() - (10 * 24 * 60 * 60 * 1000);
      setState(prev => {
        const filtered = prev.threads.filter(t => {
          const lastUpdate = t.updatedAt || t.createdAt || 0;
          return lastUpdate > tenDaysAgo;
        });
        
        if (filtered.length === 0) {
          // If all threads were deleted, create a new one
          const starter = {
            id: makeId('t'),
            title: 'New Conversation',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          return { threads: [starter], activeId: starter.id };
        }
        
        // If active thread was deleted, switch to first remaining
        const activeExists = filtered.some(t => t.id === prev.activeId);
        const newActiveId = activeExists ? prev.activeId : filtered[0].id;
        
        return { threads: filtered, activeId: newActiveId };
      });
    };

    // Run cleanup on mount and then every hour
    cleanupOldThreads();
    const interval = setInterval(cleanupOldThreads, 60 * 60 * 1000); // Every hour
    
    return () => clearInterval(interval);
  }, []);

  // Persist threads whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(threadsKey, JSON.stringify({ threads, activeId }));
    } catch (err) {
      console.warn('Failed to persist AI threads', err);
    }
  }, [threads, activeId, threadsKey]);

  // If the user (and storage key) changes (e.g. login/logout), reload threads from the
  // correct per-user storage key and migrate legacy storage if needed. This ensures
  // chats persist across logout/login and page refresh.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(threadsKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.threads)) {
          const threads = parsed.threads;
          const activeId = parsed.activeId || (threads[0] && threads[0].id) || null;
          setState({ threads, activeId });
          return;
        }
      }

      // If no threads found at the new key, check for legacy single convo and migrate.
      const legacyRaw = localStorage.getItem(legacyKey);
      if (legacyRaw) {
        const msgs = JSON.parse(legacyRaw);
        const thread = {
          id: makeId('t'),
          title: 'Conversation',
          messages: Array.isArray(msgs) ? msgs : [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        const threads = [thread];
        localStorage.setItem(threadsKey, JSON.stringify({ threads, activeId: thread.id }));
        localStorage.removeItem(legacyKey);
        setState({ threads, activeId: thread.id });
        return;
      }

      // If nothing exists, create a starter thread for this user key.
      const starter = {
        id: makeId('t'),
        title: 'New Conversation',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      localStorage.setItem(threadsKey, JSON.stringify({ threads: [starter], activeId: starter.id }));
      setState({ threads: [starter], activeId: starter.id });
    } catch (err) {
      console.warn('Failed to load threads for user', err);
    }
  }, [threadsKey, legacyKey]);

  const setActiveThreadMessages = (updater) => {
    setState(prev => {
      const nextThreads = prev.threads.map(t => {
        if (t.id !== prev.activeId) return t;
        const nextMessages = typeof updater === 'function' ? updater(t.messages.slice()) : updater;
        return { ...t, messages: nextMessages.slice(-100), updatedAt: Date.now() };
      });
      return { ...prev, threads: nextThreads };
    });
  };

  const createNewThread = () => {
    const t = { id: makeId('t'), title: 'Conversation', messages: [], createdAt: Date.now(), updatedAt: Date.now() };
    setState(prev => ({ threads: [t, ...prev.threads], activeId: t.id }));
  };

  const deleteThread = (id, e) => {
    e?.stopPropagation(); // Prevent thread selection when clicking delete
    if (!window.confirm('Delete this conversation? This cannot be undone.')) return;
    setState(prev => {
      const next = prev.threads.filter(t => t.id !== id);
      if (!next.length) {
        const starter = { id: makeId('t'), title: 'New Conversation', messages: [], createdAt: Date.now(), updatedAt: Date.now() };
        return { threads: [starter], activeId: starter.id };
      }
      const nextActive = prev.activeId === id ? next[0].id : prev.activeId;
      return { threads: next, activeId: nextActive };
    });
  };

  const clearActiveConversation = () => {
    if (!activeThread) return;
    if (!window.confirm('Clear this conversation? This cannot be undone.')) return;
    setActiveThreadMessages([]);
  };

  const exportToPDF = () => {
    if (!activeThread || !activeThread.messages.length) {
      alert('No messages to export');
      return;
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;
      let y = margin;
      const lineHeight = 7;
      const spacing = 5;

      // Title
      doc.setFontSize(18);
      doc.text('AI Doubt Solver - Chat Export', margin, y);
      y += lineHeight + spacing;

      // Thread title
      doc.setFontSize(14);
      doc.text(`Thread: ${activeThread.title || 'Conversation'}`, margin, y);
      y += lineHeight + spacing;

      // Date
      doc.setFontSize(10);
      const exportDate = new Date().toLocaleString();
      doc.text(`Exported on: ${exportDate}`, margin, y);
      y += lineHeight + spacing * 2;

      // Messages
      doc.setFontSize(11);
      activeThread.messages.forEach((msg, idx) => {
        // Check if we need a new page
        if (y > pageHeight - margin - 20) {
          doc.addPage();
          y = margin;
        }

        // Sender label
        doc.setFont('helvetica', 'bold');
        const senderLabel = msg.sender === 'user' ? 'You' : 'AI Assistant';
        doc.text(senderLabel, margin, y);
        y += lineHeight;

        // Message text (strip markdown for PDF)
        doc.setFont('helvetica', 'normal');
        const text = msg.text || '';
        // Remove markdown formatting for cleaner PDF
        const cleanText = text
          .replace(/#{1,6}\s+/g, '') // Remove headers
          .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
          .replace(/\*(.*?)\*/g, '$1') // Remove italic
          .replace(/`(.*?)`/g, '$1') // Remove code
          .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1'); // Remove links

        const lines = doc.splitTextToSize(cleanText, maxWidth);
        lines.forEach(line => {
          if (y > pageHeight - margin - 10) {
            doc.addPage();
            y = margin;
          }
          doc.text(line, margin + 5, y);
          y += lineHeight;
        });

        y += spacing * 2; // Space between messages
      });

      // Save PDF
      const filename = `ai-doubt-chat-${activeThread.title || 'conversation'}-${Date.now()}.pdf`;
      doc.save(filename);
    } catch (error) {
      console.error('Failed to export PDF:', error);
      alert('Failed to export PDF. Please try again.');
    }
  };

  // Update metadata (title/updatedAt/etc) for the active thread
  const updateActiveThreadMeta = (patch) => {
    setState(prev => {
      const nextThreads = prev.threads.map(t => t.id === prev.activeId ? { ...t, ...patch, updatedAt: Date.now() } : t);
      return { ...prev, threads: nextThreads };
    });
  };

  const selectThread = (id) => {
    setState(prev => ({ ...prev, activeId: id }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading || !activeThread) return;

    const userMessage = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      text: inputMessage,
      sender: 'user',
      createdAt: Date.now()
    };

    // Append user message optimistically
      const wasEmpty = activeThread ? (activeThread.messages.length === 0) : true;
      setActiveThreadMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');
      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/ai/solve-doubt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ query: userMessage.text })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get AI response');
      }

      const aiMessage = {
        id: `a-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        text: data.response,
        sender: 'ai',
        createdAt: Date.now()
      };

      // If this thread was empty before this exchange, auto-name it from the user's first message
      if (wasEmpty) {
        const snippet = (userMessage.text || '').trim().slice(0, 60);
        if (snippet) updateActiveThreadMeta({ title: snippet });
      }

      setActiveThreadMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = {
        id: `e-${Date.now()}`,
        text: error.message || 'Sorry, something went wrong. Please try again.',
        sender: 'ai',
        isError: true,
        createdAt: Date.now()
      };
      setActiveThreadMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ai-doubt-solver">
      <div className="ai-doubt-header">
        <div style={{ flex: 1 }}>
          <h2>AI Doubt Solver</h2>
          <p>Ask any academic questions and get instant help!</p>
        </div>
        {activeThread && activeThread.messages.length > 0 && (
          <div className="ai-doubt-header-actions">
            <button onClick={exportToPDF} title="Export chat to PDF">
              📄 Export PDF
            </button>
            <button onClick={clearActiveConversation} title="Clear conversation">
              🗑️ Clear
            </button>
          </div>
        )}
      </div>

      <div className="ai-chat-layout">
        <aside className="ai-sidebar">
          <div className="sidebar-actions">
            <button onClick={createNewThread} className="new-thread">
              <span className="new-thread-icon">+</span>
              <span className="new-thread-text">New Chat</span>
            </button>
          </div>

          <div className="threads-list">
            {threads.map(t => (
              <div 
                key={t.id} 
                className={`thread-item ${t.id === activeId ? 'active' : ''}`} 
                onClick={() => selectThread(t.id)}
              >
                <div className="thread-content">
                  <div className="thread-title">{t.title || 'New Conversation'}</div>
                  <div className="thread-meta">
                    <small>{t.messages && t.messages.length ? `${t.messages.length} messages` : 'Empty'}</small>
                  </div>
                </div>
                <button 
                  className="thread-delete-btn"
                  onClick={(e) => deleteThread(t.id, e)}
                  title="Delete conversation"
                  aria-label="Delete conversation"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </aside>

        <div className="ai-chat-container">
          <div className="messages-container">
            {activeThread && activeThread.messages.map(message => (
              <div key={message.id} className={`message ${message.sender} ${message.isError ? 'error' : ''}`}>
                <div className="message-content">
                  {message.sender === 'ai' ? (
                    <ReactMarkdown>{message.text}</ReactMarkdown>
                  ) : (
                    message.text
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="message ai loading">
                <div className="message-content">Thinking...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="input-form">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type your question here..."
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading || !inputMessage.trim()}>
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AiDoubtSolverPage;