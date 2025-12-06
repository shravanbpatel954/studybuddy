import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ModuleView from '../components/ModuleView';
import ContentUploadModal from '../components/ContentUploadModal';
import './ModulesPage.css';
import '../components/MemberManagement.css';
import ConfirmModal from '../components/ConfirmModal';
import api from '../services/api';
import useAuth from '../hooks/useAuth';

const API_BASE = process.env.REACT_APP_API_BASE || 'https://studybuddy-backend-i649.onrender.com/api/v1';

const ModulesPage = () => {
  // Ensure API_BASE always has /api/v1 prefix
  const getAPIBase = () => {
    let base = process.env.REACT_APP_API_BASE || '';
    if (!base) {
      // Default for local development
      base = 'http://localhost:8080/api/v1';
    }
    // Ensure it ends with /api/v1
    if (!base.includes('/api/v1')) {
      base = base.replace(/\/$/, '') + '/api/v1';
    }
    return base;
  };
  
  const API_BASE = getAPIBase();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, setUser, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState([]);

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedModule, setSelectedModule] = useState(null);

  const [showContentModal, setShowContentModal] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCode, setShareCode] = useState('');
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [selectedModuleForMembers, setSelectedModuleForMembers] = useState(null);
  const [memberModalMode, setMemberModalMode] = useState('view'); // 'view' or 'manage'

  // Simple toast system
  const [toasts, setToasts] = useState([]);
  const showToast = (message, type = 'success') => {
    const id = Date.now() + Math.random().toString(36).slice(2, 6);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4200);
  };

  const handleToggleEnrollment = async (moduleId) => {
    try {
      const res = await fetch(`${API_BASE}/auth/modules/${moduleId}/enrollment`, {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          isEnabled: !selectedModuleForMembers.isEnrollmentEnabled 
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        setSelectedModuleForMembers(prev => ({
          ...prev,
          isEnrollmentEnabled: !prev.isEnrollmentEnabled
        }));
        showToast(
          `Enrollment ${!selectedModuleForMembers.isEnrollmentEnabled ? 'enabled' : 'disabled'} successfully`, 
          'success'
        );
      } else {
        throw new Error(data.error || 'Failed to toggle enrollment');
      }
    } catch (error) {
      console.error('Error toggling enrollment:', error);
      showToast('Failed to toggle enrollment: ' + error.message, 'error');
    }
  };

  const handleUpdateMemberRole = async (memberId, newRole) => {
    try {
      // Check if user has permission to update roles
      if (!selectedModuleForMembers || String((selectedModuleForMembers.owner && (selectedModuleForMembers.owner._id || selectedModuleForMembers.owner)) || '') !== String(user._id)) {
        throw new Error('Only the owner can update member roles');
      }

      const res = await fetch(`${API_BASE}/auth/modules/${selectedModuleForMembers._id}/members/role`, {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: memberId, role: newRole }),
      });
      
      const data = await res.json();
      if (data.success) {
        await fetchModules(); // Wait for modules to update
        // Update the local state to reflect the change immediately
        setSelectedModuleForMembers(prev => {
          if (!prev) return null;
          return {
            ...prev,
            members: prev.members.map(m => 
              m.user._id === memberId ? { ...m, role: newRole } : m
            )
          };
        });
  showToast('Member role updated successfully', 'success');
      } else {
        throw new Error(data.error || 'Failed to update member role');
      }
    } catch (error) {
      console.error('Error updating member role:', error);
        showToast('Failed to update member role: ' + error.message, 'error');
    }
  };

  const [pendingAction, setPendingAction] = useState(null); // { type, payload }

  const doRemoveMember = async (memberId) => {
    try {
      const res = await fetch(`${API_BASE}/auth/modules/${selectedModuleForMembers._id}/members`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: memberId }),
      });
      
      const data = await res.json();
      if (data.success) {
        await fetchModules(); // Wait for modules to update
        // Update the local state to reflect the change immediately
        setSelectedModuleForMembers(prev => {
          if (!prev) return null;
          return {
            ...prev,
            members: prev.members.filter(m => m.user._id !== memberId)
          };
        });
        showToast('Member removed successfully', 'success');
      } else {
        throw new Error(data.error || 'Failed to remove member');
      }
    } catch (error) {
      console.error('Error removing member:', error);
      showToast('Failed to remove member: ' + error.message, 'error');
    } finally {
      setPendingAction(null);
    }
  };

  // token provided by useAuth hook (keeps localStorage in sync)

  const handleShareModule = async (moduleId) => {
    try {
      const res = await fetch(`${API_BASE}/auth/modules/${moduleId}/share`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (data.success) {
        // Set the share code and show the modal
        setShareCode(String(data.shareCode));
        setShowShareModal(true);
        // Also copy to clipboard as a convenience
        try {
          await navigator.clipboard.writeText(String(data.shareCode));
        } catch (e) {
          console.warn('Could not copy to clipboard:', e);
        }
      } else {
        throw new Error(data.error || 'Failed to generate share code');
      }
    } catch (error) {
      console.error('Error sharing module:', error);
      showToast('Failed to share module: ' + error.message, 'error');
    }
  };

  const handleLeaveModule = async (moduleId) => {
    if (!moduleId) {
      showToast('Invalid module ID', 'error');
      return;
    }

    try {
      // Find the module and check if user is owner
      const module = modules.find(m => m._id === moduleId);
      if (!module) {
        showToast('Module not found', 'error');
        return;
      }

      const isOwner = module.owner._id.toString() === user._id.toString();
      showToast(isOwner ? 'Deleting module...' : 'Leaving module...', 'info');
      
      // Remove from local state first for better UX
      setModules(prevModules => prevModules.filter(m => m._id !== moduleId));
      setShowMemberModal(false);
      setPendingAction(null);
      
      // Use DELETE for owners, POST /leave for members
      const res = await fetch(`${API_BASE}/auth/modules/${moduleId}${isOwner ? '' : '/leave'}`, {
        method: isOwner ? 'DELETE' : 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        // If the server request fails, rollback the state change
        showToast('Server error occurred', 'error');
        await fetchModules(); // Refresh modules list from server
        return;
      }

      // Close modals and show success message
      showToast('Successfully left the module', 'success');
      setShowMemberModal(false);
      setPendingAction(null);

      let responseData;
      try {
        responseData = await res.json();
      } catch (e) {
        throw new Error('Failed to parse server response');
      }

      if (!res.ok) {
        throw new Error(
          (responseData && responseData.error) || 
          'Failed to leave module. Please try again.'
        );
      }

      if (responseData.success) {
        // Remove the module from local state
        setModules(prevModules => prevModules.filter(m => m._id !== moduleId));
        showToast('Successfully left the module', 'success');
        // Close any open modals
        setShowMemberModal(false);
        setPendingAction(null);
      } else {
        throw new Error(responseData.error || 'Failed to leave module');
      }
    } catch (error) {
      console.error('Leave module error:', error);
      showToast(error.message || 'Failed to leave module', 'error');
      setPendingAction(null);
    }
  };

  const doDeleteModule = async (moduleId) => {
    try {
      const res = await fetch(`${API_BASE}/auth/modules/${moduleId}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      if (data.success) {
        await fetchModules();
        showToast('Module deleted', 'success');
      } else {
        throw new Error(data.error || 'Failed to delete module');
      }
    } catch (error) {
      console.error('delete module error:', error);
      showToast('Failed to delete module: ' + (error.message || ''), 'error');
    } finally {
      setPendingAction(null);
    }
  };

  const fetchModuleById = async (moduleId) => {
    try {
      const res = await fetch(`${API_BASE}/auth/modules/${moduleId}`, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (data.success && data.module) {
        // Normalize owner and members like in fetchModules
        const mod = data.module;
        const rawMembers = mod.members || [];
        const members = rawMembers
          .filter(m => m && (m.user || typeof m.user === 'string'))
          .map(m => {
            let userObj = m.user;
            if (!userObj) userObj = { _id: '' };
            if (typeof userObj === 'string') userObj = { _id: userObj };
            if (userObj && userObj._id) userObj._id = String(userObj._id);
            return { user: userObj, role: m.role || 'member' };
          });

        let owner = mod.owner;
        if (!owner) owner = { _id: '' };
        if (typeof owner === 'string') owner = { _id: owner };
        if (owner && owner._id) owner._id = String(owner._id);

        const normalized = { ...mod, members, owner };
        console.log('[fetchModuleById] normalized module members:', normalized.members.map(m => ({ id: m.user && (m.user._id || m.user), name: m.user && (m.user.displayName || m.user.name || m.user.email), role: m.role })));
        return normalized;
      }
      return null;
    } catch (error) {
      console.error('Error fetching module by id:', error);
      return null;
    }
  };

  const handleImportModule = async (shareCode) => {
    try {
      const res = await fetch(`${API_BASE}/auth/modules/import`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shareCode }),
      });
      const data = await res.json();
      if (data.success) {
        // Add the imported module to the list
        setModules(prevModules => [...prevModules, data.module]);
        showToast('Module imported successfully!', 'success');
      } else {
        throw new Error(data.error || 'Failed to import module');
      }
    } catch (error) {
      console.error('Error importing module:', error);
      showToast('Failed to import module: ' + error.message, 'error');
    }
  };

  const fetchUser = useCallback(async () => {
    try {
      // Check if we have a token first
      if (!token) {
        setLoading(false);
        localStorage.removeItem('userId');
        localStorage.removeItem('userName');
        localStorage.removeItem('userEmail');
        return navigate('/', { replace: true });
      }

      const data = await api.get('/auth/profile');
      
      // Handle successful response
      if (data && (data.user || data._id)) {
        const userObj = data.user || data;
        setUser(userObj);

        // Update local storage with user data
        if (userObj._id) {
          localStorage.setItem('userId', String(userObj._id));
          localStorage.setItem('userName', userObj.name || userObj.displayName || '');
          localStorage.setItem('userEmail', userObj.email || '');
        }
      } else {
        throw new Error('Invalid user data received');
      }
    } catch (error) {
      console.error('[fetchUser] error:', error);
      
      // Clear user data
      setUser(null);
      localStorage.removeItem('userId');
      localStorage.removeItem('userName');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('token');
      
      // Use replace to prevent back navigation to this page
      return navigate('/', { replace: true });
    } finally {
      setLoading(false);
    }
  }, [navigate, token, setUser]);

  const fetchModules = useCallback(async () => {
    try {
      const data = await api.get('/auth/modules');
      if (data && data.success) {
        // Update modules and normalize member and owner shapes so UI can rely on consistent structure
        const updatedModules = data.modules.map(module => {
          const rawMembers = module.members || [];
          const members = rawMembers
            .filter(m => m && (m.user || typeof m.user === 'string'))
            .map(m => {
              let userObj = m.user;
              // If the server returned just an id (string), convert to an object with _id
              if (!userObj) userObj = { _id: '' };
              if (typeof userObj === 'string') userObj = { _id: userObj };
              // Ensure _id is a string
              if (userObj && userObj._id) userObj._id = String(userObj._id);
              return { user: userObj, role: m.role || 'member' };
            });

          // Normalize owner to an object as well
          let owner = module.owner;
          if (!owner) owner = { _id: '' };
          if (typeof owner === 'string') owner = { _id: owner };
          if (owner && owner._id) owner._id = String(owner._id);

          return { ...module, members, owner };
        });

        setModules(updatedModules);
        
        // Check if moduleId is in URL params and auto-select the module
        const moduleIdFromUrl = searchParams.get('moduleId');
        if (moduleIdFromUrl) {
          const moduleToSelect = updatedModules.find(m => m._id === moduleIdFromUrl);
          if (moduleToSelect && (!selectedModule || selectedModule._id !== moduleIdFromUrl)) {
            setSelectedModule(moduleToSelect);
            // Remove moduleId from URL to clean it up
            const newSearchParams = new URLSearchParams(searchParams);
            newSearchParams.delete('moduleId');
            navigate(`/dashboard?tab=modules${newSearchParams.toString() ? '&' + newSearchParams.toString() : ''}`, { replace: true });
            return; // Exit early to avoid updating selectedModule below
          }
        }
        
        // Update selected module if one is active (only if not set from URL)
        setSelectedModule(prev => {
          if (!prev) return null;
          const updatedModule = updatedModules.find(m => m._id === prev._id);
          return updatedModule || prev;
        });

        // Update selected module for members if open
        setSelectedModuleForMembers(prev => {
          if (!prev) return null;
          const updatedModule = updatedModules.find(m => m._id === prev._id);
          return updatedModule || prev;
        });
      }
    } catch (error) {
      console.error('Error fetching modules:', error);
      showToast('Error loading modules: ' + error.message, 'error');
    }
  }, [token, searchParams, navigate]); // Removed selectedModule to avoid infinite loop

  const handleGenerateQuiz = async (subsectionId, useUserContent) => {
    try {
      const res = await fetch(`${API_BASE}/auth/modules/quizzes/${subsectionId}`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ useUserContent }),
      });

      const data = await res.json();
      if (data.success) {
        // Refresh modules to get updated quiz data
        fetchModules();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error generating quiz:', error);
      showToast('Failed to generate quiz: ' + error.message, 'error');
    }
  };

  const handleUploadMaterial = async (subsectionId, files) => {
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });

      const res = await fetch(`${API_BASE}/auth/modules/materials/${subsectionId}`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
        },
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        // Refresh modules to get updated materials
        fetchModules();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error uploading materials:', error);
      showToast('Failed to upload materials: ' + error.message, 'error');
    }
  };

  const handleUploadContent = (sectionId) => {
    setSelectedSectionId(sectionId);
    setShowContentModal(true);
  };

  const handleContentUpload = async (formData) => {
    try {
      const res = await fetch(`${API_BASE}/auth/modules/content/${selectedSectionId}`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
        },
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        // Refresh modules to show updated content
        fetchModules();
        setShowContentModal(false);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error uploading content:', error);
      showToast('Failed to upload content: ' + error.message, 'error');
    }
  };





  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    setSelectedFile(file);
  };



  const [streamingProgress, setStreamingProgress] = useState(null);
  const [streamingModule, setStreamingModule] = useState(null);
  const abortControllerRef = useRef(null);

  const handleCreateModule = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadError('');
    setStreamingProgress(null);
    setStreamingModule(null);
    
    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }, 300000); // 5 minute timeout
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('subject', 'New Module');

    try {
      const res = await fetch(`${API_BASE}/auth/modules/stream`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
        },
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage = 'Failed to create module';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Handle SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamError = null;

      while (true) {
        // Check if aborted
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Request cancelled or timed out');
        }

        const { done, value } = await reader.read();
        if (done) {
          if (streamError) {
            throw streamError;
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'start':
                  setStreamingProgress({ step: 'start', message: data.message });
                  break;
                case 'progress':
                  setStreamingProgress({ 
                    step: data.step, 
                    message: data.message,
                    progress: data.progress 
                  });
                  break;
                case 'chapter_structure':
                  setStreamingProgress({ 
                    step: 'structuring', 
                    message: data.message 
                  });
                  break;
                case 'chapters_found':
                  setStreamingProgress({ 
                    step: 'structuring', 
                    message: `Found ${data.count} chapters` 
                  });
                  break;
                case 'chapter_progress':
                  setStreamingProgress({ 
                    step: 'structuring', 
                    message: `Processing chapter ${data.current}/${data.total}: ${data.chapter}`,
                    progress: Math.round((data.current / data.total) * 50)
                  });
                  break;
                case 'quiz_progress':
                  // Backend no longer auto-generates quizzes during module creation.
                  // Treat any legacy quiz_progress events as generic processing updates.
                  setStreamingProgress({ 
                    step: 'structuring', 
                    message: data.message || 'Processing content...',
                    progress: data.progress || 70
                  });
                  break;
                case 'module_created':
                  setStreamingModule(data.module);
                  setStreamingProgress({ 
                    step: 'saving', 
                    message: 'Module created successfully!',
                    progress: 90
                  });
                  break;
                case 'complete':
                  clearTimeout(timeoutId);
                  // Fetch the complete module from server
                  const moduleId = streamingModule?._id || data.module?._id;
                  if (moduleId) {
                    try {
                      const moduleRes = await fetch(`${API_BASE}/auth/modules/${moduleId}`, {
                        headers: { Authorization: 'Bearer ' + token }
                      });
                      const moduleData = await moduleRes.json();
                      if (moduleData.success && moduleData.module) {
                        setModules(prevModules => {
                          // Check if module already exists to avoid duplicates
                          const exists = prevModules.find(m => m._id === moduleData.module._id);
                          if (exists) return prevModules;
                          return [...prevModules, moduleData.module];
                        });
                        showToast('Module created successfully!', 'success');
                      }
                    } catch (e) {
                      console.error('Failed to fetch complete module:', e);
                    }
                  }
                  setSelectedFile(null);
                  setTimeout(() => {
                    setStreamingProgress(null);
                    setStreamingModule(null);
                  }, 3000);
                  return; // Exit successfully
                case 'error':
                  streamError = new Error(data.message || 'An error occurred during module creation');
                  // Break out of the loop
                  reader.cancel();
                  throw streamError;
              }
            } catch (e) {
              // If it's an error we threw ourselves, re-throw it
              if (e.message && (e.message.includes('error') || e.message.includes('Error') || e.message.includes('Failed'))) {
                streamError = e;
                reader.cancel();
                throw e;
              }
              // Otherwise, log parsing errors but continue
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Error creating module:', error);
      
      let errorMessage = error.message || 'Failed to upload file';
      
      // Provide user-friendly error messages
      if (error.name === 'AbortError' || error.message.includes('cancelled') || error.message.includes('timed out')) {
        errorMessage = 'Request timed out. Please try again with a smaller file or check your connection.';
      } else if (error.message.includes('No text extracted') || error.message.includes('Failed to extract text')) {
        errorMessage = 'Could not extract text from the PDF. The file might be image-based (scanned). Please try a text-based PDF or convert the file to text format.';
      } else if (error.message.includes('Failed to process file')) {
        errorMessage = 'Failed to process the file. Please ensure the file is not corrupted and is in a supported format.';
      }
      
      setUploadError(errorMessage);
      setStreamingProgress(null);
      showToast(errorMessage, 'error');
    } finally {
      clearTimeout(timeoutId);
      setUploading(false);
      abortControllerRef.current = null;
    }
  };

  const handlePreview = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setPreviewData(null);
    setShowPreviewModal(false);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('subject', 'Preview Module');

    try {
      const res = await fetch(`${API_BASE}/auth/modules?preview=true`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
        },
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.preview) {
        setPreviewData(data.preview);
        setShowPreviewModal(true);
      } else {
        throw new Error(data.error || 'Preview failed');
      }
    } catch (error) {
      console.error('Preview error:', error);
      setUploadError(error.message || 'Failed to preview file');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }

    const init = async () => {
      await Promise.all([fetchUser(), fetchModules()]);
    };
    init();

    const intervalId = setInterval(fetchModules, 30000);
    return () => clearInterval(intervalId);
  }, [token, navigate, fetchUser, fetchModules]);

  if (loading) {
    return <div>Loading...</div>;
  }

  const logoutFn = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      localStorage.removeItem('token');
      navigate('/');
    }
  };

  return (
    <div className="modules-page">
      {/* Toast container */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>

      <main className="main-content">
        {selectedModule ? (
          <ModuleView
            module={selectedModule}
            onGenerateQuiz={handleGenerateQuiz}
            onUploadMaterial={handleUploadMaterial}
            onBack={() => setSelectedModule(null)}
          />
        ) : (
          <>
            <div className="header">
              <h1>Your Study Spaces</h1>
                <div className="upload-section">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.odt,.odp,.jpg,.jpeg,.png,.gif,.webp,.tiff,.txt,.rtf"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="upload-button">
                    + New Module
                  </label>
                {selectedFile && (
                  <>
                    <div className="selected-file">
                      <span className="file-name">{selectedFile.name}</span>
                      <span className="file-size">({Math.round(selectedFile.size / 1024)}KB)</span>
                      <button
                        onClick={handlePreview}
                        disabled={uploading}
                        className={uploading ? 'uploading' : ''}
                        style={{ marginRight: '8px' }}
                      >
                        {uploading ? 'Processing...' : 'Preview'}
                      </button>
                      <button
                        onClick={handleCreateModule}
                        disabled={uploading}
                        className={uploading ? 'uploading' : ''}
                      >
                        {uploading ? 'Processing...' : 'Create Module'}
                      </button>
                    </div>
                    {uploadError && (
                      <div className="error-message">
                        {uploadError}
                      </div>
                    )}
                    {streamingProgress && (
                      <div className="streaming-progress">
                        <div className="progress-bar-container">
                          <div 
                            className="progress-bar-fill" 
                            style={{ width: `${streamingProgress.progress || 0}%` }}
                          ></div>
                        </div>
                        <div className="progress-message">
                          {streamingProgress.message || 'Processing...'}
                        </div>
                        {streamingModule && (
                          <div className="module-preview">
                            <strong>Module:</strong> {streamingModule.subject}
                            <br />
                            <small>{streamingModule.chapters?.length || 0} chapters created</small>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
                <div className="supported-formats">
                  Supported formats: PDF, Word (DOC, DOCX), PowerPoint (PPT, PPTX),
                  Images (JPG, PNG, GIF, etc.), and Text files
                </div>
              </div>
            </div>

            <div className="dashboard-content">
              <div className="modules-section">
                <div className="modules-header">
                  <h2>Your Study Modules</h2>
                  <div className="module-actions">
                    <button 
                      className="import-module-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        const code = prompt("Enter the module share code:");
                        if (code) handleImportModule(code);
                      }}
                    >
                      Import Module
                    </button>
                  </div>
                </div>
                <div className="modules-grid">
              {modules.map((module) => (
                <div key={module._id} className="module-card">
                  <div className="module-header">
                          <h3 onClick={() => setSelectedModule(module)}>{module.subject}</h3>
                          <div className="module-actions">
                            <button
                              className="share-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShareModule(module._id);
                              }}
                            >
                              Share Code
                            </button>
                            <div className="module-menu-wrapper">
                              <button
                                className="module-menu-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedModuleForMembers(module);
                                  setShowMemberModal(false);
                                  setMemberModalMode('menu');
                                  setModules(prev => prev.map(m => m._id === module._id ? { ...m, showMenu: !m.showMenu } : { ...m, showMenu: false }));
                                }}
                              >
                                <span style={{fontSize: '22px', color: '#8ab4f8'}}>⋮</span>
                              </button>
                              {module.showMenu && (
                                <div className="module-menu-dropdown">
                                  <button onClick={() => setPendingAction({ type: 'leaveModule', payload: { moduleId: module._id } })}>Unenroll</button>
                                  <button onClick={() => setSelectedModule(module)}>View Progress</button>
                                 
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                  <div className="module-info">
                    <div className="module-details">
                      <span>{module.chapters?.length || 0} chapters</span>
                      <span>{module.members?.length || 0} members</span>
                    </div>
                    <div className="module-progress-bar">
                      <div className="progress-label">
                        <span>Course Progress</span>
                        <span>{module.progress || 0}%</span>
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress"
                          style={{ width: `${module.progress || 0}%` }}
                        ></div>
                      </div>
                    </div>
                    <button 
                      className="view-details-btn"
                      onClick={() => setSelectedModule(module)}
                    >
                      Open
                    </button>
                  </div>
                </div>
              ))}
                </div>
              </div>
              {/* chat moved to the Chat tab (removed from modules column) */}
            </div>

            {/* Modals */}
            {showPreviewModal && (
              <div className="preview-modal">
                <div className="preview-content">
                  <h3>AI Structured Preview</h3>
                  <div className="preview-module">
                    {previewData && <ModuleView module={previewData} preview={true} />}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <button onClick={() => setShowPreviewModal(false)}>Close</button>
                  </div>
                </div>
              </div>
            )}

            {showContentModal && (
              <ContentUploadModal
                onClose={() => setShowContentModal(false)}
                onUpload={handleContentUpload}
                sectionId={selectedSectionId}
              />
            )}



            {/* Share Code Modal */}
            {showShareModal && (
              <div className="modal">
                <div className="modal-content">
                  <h3>Share Module</h3>
                  <div className="share-code-section">
                    <p>Share this code with others to let them join your module:</p>
                    <div className="share-code-display">
                      <code>{shareCode}</code>
                      <button
                        className="copy-btn"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(shareCode);
                            showToast('Code copied to clipboard', 'success');
                          } catch (e) {
                            showToast('Could not copy code automatically', 'error');
                          }
                        }}
                      >
                        Copy Code
                      </button>
                    </div>
                    <p className="share-tip">Others can use this code to join by clicking "Import Module" button.</p>
                  </div>
                  <div className="modal-actions">
                    <button onClick={() => setShowShareModal(false)}>Close</button>
                  </div>
                </div>
              </div>
            )}

            <ConfirmModal
              show={!!pendingAction}
              title={pendingAction?.type === 'deleteModule' ? 'Delete module' : pendingAction?.type === 'removeMember' ? 'Remove member' : pendingAction?.type === 'leaveModule' ? 'Leave module' : 'Confirm'}
              message={pendingAction?.type === 'deleteModule' ? `Delete this module? This cannot be undone.` : pendingAction?.type === 'removeMember' ? `Remove this member?` : pendingAction?.type === 'leaveModule' ? `Leave this module?` : ''}
              onCancel={() => setPendingAction(null)}
              onConfirm={() => {
                if (pendingAction?.type === 'removeMember') doRemoveMember(pendingAction.payload.userId);
                else if (pendingAction?.type === 'deleteModule') doDeleteModule(pendingAction.payload.moduleId);
                else if (pendingAction?.type === 'leaveModule') handleLeaveModule(pendingAction.payload.moduleId);
              }}
            />

            {/* Member Management Modal */}
            {showMemberModal && selectedModuleForMembers && (
              <div className="modal">
                  <div className="modal-content">
                  <h3>{selectedModuleForMembers.subject}</h3>
                  <div className="module-stats-header">
                    <span>{selectedModuleForMembers.members?.length || 0} members</span>
                    <div className="header-actions">
                      {selectedModuleForMembers.owner._id === user._id && (
                        <button 
                          className="toggle-enrollment-btn"
                          onClick={() => handleToggleEnrollment(selectedModuleForMembers._id)}
                        >
                          {selectedModuleForMembers.isEnrollmentEnabled ? 'Disable Enrollment' : 'Enable Enrollment'}
                        </button>
                      )}
                      {selectedModuleForMembers.owner._id !== user._id && (
                        <button 
                          className="leave-module-btn"
                          onClick={() => setPendingAction({
                            type: 'leaveModule',
                            payload: { moduleId: selectedModuleForMembers._id }
                          })}
                        >
                          Leave Module
                        </button>
                      )}
                    </div>
                  </div>                  <div className="members-list">
                    {/* Teaching Staff Section */}
                    <div className="members-section">
                      <h4>Teaching Staff</h4>
                      {/* Display owner */}
                      {selectedModuleForMembers.owner && (
                        <div className="member-item owner">
                          <div className="member-info">
                            <img 
                              src={selectedModuleForMembers.owner.photo || '/default-avatar.png'} 
                              alt="Profile" 
                              className="member-avatar"
                            />
                            <div className="member-details">
                              <span className="member-name">
                                {selectedModuleForMembers.owner.displayName || selectedModuleForMembers.owner.name}
                                {selectedModuleForMembers.owner._id === user._id ? ' (You)' : ''}
                              </span>
                              <span className="member-email">{selectedModuleForMembers.owner.email}</span>
                              <span className="member-role owner">Owner</span>
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Display teachers and teaching assistants */}
                      {selectedModuleForMembers.members
                        .filter(m => ['admin', 'moderator'].includes(m.role) && 
                               String(m.user._id) !== String(selectedModuleForMembers.owner._id))
                        .map(member => (
                          <div key={member.user._id} className="member-item">
                            <div className="member-info">
                              <img 
                                src={member.user.photo || '/default-avatar.png'} 
                                alt="Profile" 
                                className="member-avatar"
                              />
                              <div className="member-details">
                                <span className="member-name">
                                  {member.user.displayName || member.user.name}
                                  {member.user._id === user._id ? ' (You)' : ''}
                                </span>
                                <span className="member-email">{member.user.email}</span>
                                <span className={`member-role ${member.role}`}>
                                  {member.role === 'admin' ? 'Teacher' : 'Teaching Assistant'}
                                </span>
                              </div>
                            </div>
                            {memberModalMode === 'manage' && selectedModuleForMembers.owner._id === user._id && (
                              <div className="member-actions">
                                <select
                                  value={member.role}
                                  onChange={(e) => handleUpdateMemberRole(member.user._id, e.target.value)}
                                  className="role-select"
                                >
                                  <option value="member">Student</option>
                                  <option value="moderator">Teaching Assistant</option>
                                  <option value="admin">Teacher</option>
                                </select>
                                <button
                                  className="remove-member-btn"
                                  onClick={() => setPendingAction({ 
                                    type: 'removeMember', 
                                    payload: { 
                                      userId: member.user._id,
                                      name: member.user.displayName || member.user.name
                                    }
                                  })}
                                >
                                  Remove
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>

                    {/* Students Section */}
                    <div className="members-section">
                      <h4>Students</h4>
                      {selectedModuleForMembers.members
                        .filter(m => (m.role === 'member' || !m.role) && 
                               String(m.user._id) !== String(selectedModuleForMembers.owner._id))
                        .map(member => (
                          <div key={member.user._id} className="member-item">
                            <div className="member-info">
                              <img 
                                src={member.user.photo || '/default-avatar.png'} 
                                alt="Profile" 
                                className="member-avatar"
                              />
                              <div className="member-details">
                                <span className="member-name">
                                  {member.user.displayName || member.user.name}
                                  {member.user._id === user._id ? ' (You)' : ''}
                                </span>
                                <span className="member-email">{member.user.email}</span>
                              </div>
                            </div>
                            {memberModalMode === 'manage' && 
                             (selectedModuleForMembers.owner._id === user._id || user.role === 'admin') && (
                              <div className="member-actions">
                                <button
                                  className="remove-member-btn"
                                  onClick={() => setPendingAction({ 
                                    type: 'removeMember', 
                                    payload: { 
                                      userId: member.user._id,
                                      name: member.user.displayName || member.user.name
                                    }
                                  })}
                                >
                                  Remove student
                                </button>
                              </div>
                            )}
                            {member.user._id === user._id && (
                              <div className="member-actions">
                                <button
                                  className="unenroll-btn"
                                  onClick={() => setPendingAction({ 
                                    type: 'leaveModule',
                                    payload: { moduleId: selectedModuleForMembers._id }
                                  })}
                                >
                                  Unenroll
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                  <div className="modal-actions">
                    <button onClick={() => setShowMemberModal(false)}>Close</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default ModulesPage;
