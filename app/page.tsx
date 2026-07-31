'use client';

import { useState, useEffect, useCallback } from 'react';
import { WelcomeScreen } from '@/components/auth/WelcomeScreen';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { ChatArea } from '@/components/dashboard/ChatArea';
import { ChatSession } from '@/utils/types';

export default function Home() {
  const [userName, setUserName] = useState<string>('');
  const [currentView, setCurrentView] = useState<string>('new-chat');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // Load persistent user name
  useEffect(() => {
    const savedName = localStorage.getItem('fa_user_name');
    if (savedName) {
      setUserName(savedName);
    }
  }, []);

  // Fetch real chat sessions from Postgres database via API
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      if (res.ok && data.sessions) {
        setSessions(data.sessions);
      }
    } catch (e) {
      console.error('Failed to fetch sessions from Postgres database:', e);
    }
  }, []);

  useEffect(() => {
    if (userName) {
      fetchSessions();
    }
  }, [userName, fetchSessions]);

  const handleSetUserName = (name: string) => {
    setUserName(name);
    localStorage.setItem('fa_user_name', name);
  };

  const handleLogout = () => {
    setUserName('');
    localStorage.removeItem('fa_user_name');
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

  if (!userName) {
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
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        activeSession={activeSession}
        onSaveSession={handleSaveSession}
      />
    </div>
  );
}