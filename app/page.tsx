'use client';

import { useState, useEffect, useCallback } from 'react';
import { WelcomeScreen } from '@/components/auth/WelcomeScreen';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { ChatArea } from '@/components/dashboard/ChatArea';
import { ChatSession } from '@/utils/types';

export default function Home() {
  const [userName, setUserName] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [currentView, setCurrentView] = useState<string>('new-chat');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // Fetch chat sessions for user from Postgres database via API
  const fetchSessions = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`/api/sessions?userId=${uid}`);
      const data = await res.json();
      if (res.ok && data.sessions) {
        setSessions(data.sessions);
        // Automatically select the most recent active chat if available
        if (data.sessions.length > 0) {
          setActiveChatId(data.sessions[0].id);
          setCurrentView('history');
        } else {
          setActiveChatId(null);
          setCurrentView('new-chat');
        }
      }
    } catch (e) {
      console.error('Failed to fetch user sessions from Postgres database:', e);
    }
  }, []);

  // Load persistent user credentials & auto-login if saved
  useEffect(() => {
    const savedName = localStorage.getItem('fa_user_name');
    const savedId = localStorage.getItem('fa_user_id');
    if (savedName && savedId) {
      setUserName(savedName);
      setUserId(savedId);
      fetchSessions(savedId);
    }
  }, [fetchSessions]);

  const handleSetUserName = async (name: string) => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();

      if (res.ok && data.user) {
        const user = data.user;
        setUserName(user.name);
        setUserId(user.id);
        localStorage.setItem('fa_user_name', user.name);
        localStorage.setItem('fa_user_id', user.id);

        await fetchSessions(user.id);
      } else {
        alert(data.error || 'Failed to register/authenticate user');
      }
    } catch (err) {
      console.error('User register/login error:', err);
      alert('Failed to connect to user service');
    }
  };

  const handleLogout = () => {
    setUserName('');
    setUserId('');
    setSessions([]);
    setActiveChatId(null);
    localStorage.removeItem('fa_user_name');
    localStorage.removeItem('fa_user_id');
  };

  const handleNewChat = () => {
    setActiveChatId(null);
    setCurrentView('new-chat');
    setSidebarOpen(false);
  };

  const handleSelectChat = (id: string) => {
    setActiveChatId(id);
    setCurrentView('history');
    setSidebarOpen(false);
  };

  const handleDeleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/sessions?id=${id}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeChatId === id) {
        setActiveChatId(null);
        setCurrentView('new-chat');
      }
    } catch (err) {
      console.error('Failed to delete chat session:', err);
    }
  };

  const handleSaveSession = (updatedSession: ChatSession) => {
    setSessions((prev) => {
      const index = prev.findIndex((s) => s.id === updatedSession.id);
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = updatedSession;
        return copy;
      }
      return [updatedSession, ...prev];
    });
    setActiveChatId(updatedSession.id);
  };

  if (!userName || !userId) {
    return <WelcomeScreen onNext={handleSetUserName} />;
  }

  const activeSession = sessions.find((s) => s.id === activeChatId) || null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 relative">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        sessions={sessions}
        activeChatId={activeChatId}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
      />
      <ChatArea
        key={activeChatId || 'new-session'}
        userName={userName}
        userId={userId}
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        activeSession={activeSession}
        onSaveSession={handleSaveSession}
      />
    </div>
  );
}