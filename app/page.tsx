'use client';

import { useState, useEffect } from 'react';
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

  // Load username and sessions from localStorage on mount
  useEffect(() => {
    const savedName = localStorage.getItem('fa_user_name');
    if (savedName) {
      setUserName(savedName);
    }
    const savedSessions = localStorage.getItem('fa_chat_sessions');
    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        setSessions(parsed);
      } catch (e) {
        console.error('Failed to parse saved chat sessions', e);
      }
    }
  }, []);

  // Save sessions to localStorage when updated
  const updateSessions = (newSessions: ChatSession[]) => {
    setSessions(newSessions);
    localStorage.setItem('fa_chat_sessions', JSON.stringify(newSessions));
  };

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

  const handleDeleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = sessions.filter((s) => s.id !== id);
    updateSessions(filtered);
    if (activeChatId === id) {
      setActiveChatId(null);
      setCurrentView('new-chat');
    }
  };

  const handleSaveSession = (updatedSession: ChatSession) => {
    const index = sessions.findIndex((s) => s.id === updatedSession.id);
    let newSessions: ChatSession[];
    if (index >= 0) {
      newSessions = [...sessions];
      newSessions[index] = updatedSession;
    } else {
      newSessions = [updatedSession, ...sessions];
    }
    updateSessions(newSessions);
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