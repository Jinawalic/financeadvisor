import React, { useState, useRef, useEffect } from 'react';
import { Send as PaperAirplaneIcon, Plus as PlusIcon } from 'lucide-react';
import { Message, ChatSession } from '@/utils/types';

interface ChatAreaProps {
    userName: string;
    onMenuToggle: () => void;
    activeSession: ChatSession | null;
    onSaveSession: (session: ChatSession) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
    userName,
    onMenuToggle,
    activeSession,
    onSaveSession,
}) => {
    const [message, setMessage] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [messages, setMessages] = useState<Message[]>(activeSession ? activeSession.messages : []);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(activeSession ? activeSession.id : null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Sync messages if activeSession changes
    useEffect(() => {
        if (activeSession) {
            setMessages(activeSession.messages);
            setCurrentSessionId(activeSession.id);
        } else {
            setMessages([]);
            setCurrentSessionId(null);
        }
    }, [activeSession]);

    // Auto scroll down on new messages
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handlePlusClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFile(e.target.files[0]);
        }
    };

    // Helper to generate concise title from text or file
    const generateChatTitle = (text: string, file: File | null): string => {
        if (file && !text) {
            return `File: ${file.name}`;
        }
        if (text) {
            const cleanText = text.trim();
            if (cleanText.length <= 35) return cleanText;
            return cleanText.substring(0, 32) + '...';
        }
        return 'New Financial Inquiry';
    };

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() && !selectedFile) return;

        const userMsgText = message;
        const attachedFile = selectedFile;

        // Construct new user message
        const userMsg: Message = {
            id: Date.now().toString(),
            text: userMsgText,
            sender: 'user',
            fileName: attachedFile?.name,
        };

        const newMessages = [...messages, userMsg];
        setMessages(newMessages);

        // Determine session ID and title
        const sessionId = currentSessionId || Date.now().toString();
        const sessionTitle = activeSession
            ? activeSession.title
            : generateChatTitle(userMsgText, attachedFile);

        // Save session immediately with user message
        const sessionToSave: ChatSession = {
            id: sessionId,
            title: sessionTitle,
            messages: newMessages,
            createdAt: activeSession ? activeSession.createdAt : Date.now(),
        };

        setCurrentSessionId(sessionId);
        onSaveSession(sessionToSave);

        // Clear inputs
        setMessage('');
        setSelectedFile(null);

        // Simulated AI response
        setTimeout(() => {
            let aiText = `Thanks for asking! Let me analyze your financial details.`;
            if (attachedFile) {
                aiText = `I have received your document "${attachedFile.name}". I am processing the statement items to calculate your totals, savings, and expense categories.`;
            } else if (userMsgText.toLowerCase().includes('budget') || userMsgText.toLowerCase().includes('spend')) {
                aiText = `To create an effective budget, standard rules recommend splitting your net income into 50% Needs, 30% Wants, and 20% Savings. Would you like me to analyze your statement for exact figures?`;
            } else if (userMsgText.toLowerCase().includes('save') || userMsgText.toLowerCase().includes('investment')) {
                aiText = `Building an emergency fund with 3 to 6 months of living expenses is the best starting step before pursuing higher-risk investments.`;
            }

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: aiText,
                sender: 'ai',
            };

            const updatedMessagesWithAi = [...newMessages, aiMsg];
            setMessages(updatedMessagesWithAi);

            onSaveSession({
                ...sessionToSave,
                messages: updatedMessagesWithAi,
            });
        }, 700);
    };

    const hasChatStarted = messages.length > 0 || selectedFile !== null;

    return (
        /* Changed h-screen to h-full max-h-screen to snap exactly to its layout block */
        <section className="flex-1 flex flex-col h-full max-h-screen w-full bg-white relative overflow-hidden">
            {/* Top Header navbar */}
            <header className="h-16 border-b border-gray-100 flex items-center justify-between px-4 sm:px-8 bg-white z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onMenuToggle}
                        className="p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-50 active:bg-gray-100 lg:hidden"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="font-bold text-base sm:text-lg text-[#0b3c5d]">
                            {'Finance AI'}
                        </h1>
                    </div>
                </div>

                <div className="bg-[#eaf2f8] text-[#4682b4] font-medium px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm max-w-[120px] sm:max-w-none truncate">
                    {userName}
                </div>
            </header>

            {/* Main Content Area */}
            {/* Swapped p-4 sm:p-8 to py-4 px-4 sm:p-8 to avoid unnecessary bottom-padding cutoff */}
            <main className={`flex-1 overflow-y-auto py-4 px-4 sm:p-8 flex flex-col min-h-0 transition-all duration-500 ${hasChatStarted ? 'justify-start' : 'justify-center items-center'
                }`}>
                {/* Initial Welcome Text */}
                {!hasChatStarted && (
                    <div className="text-center space-y-2 mb-8 animate-fade-in w-full">
                        <p className="text-gray-400 text-base sm:text-lg px-4">
                            Welcome {userName}! Ask me anything about your finances or upload a bank statement.
                        </p>
                    </div>
                )}

                {/* Render Messages Timeline */}
                {messages.length > 0 && (
                    <div className="w-full max-w-3xl mx-auto space-y-4 mb-2">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex flex-col max-w-[85%] sm:max-w-[80%] ${msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                                    }`}
                            >
                                <div className={`p-4 rounded-2xl text-sm sm:text-base shadow-sm ${msg.sender === 'user'
                                        ? 'bg-[#63a2cf] text-white rounded-tr-none'
                                        : 'bg-gray-100 text-gray-800 rounded-tl-none border border-gray-200'
                                    }`}>
                                    {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}
                                    {msg.fileName && (
                                        <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md mt-1.5 ${msg.sender === 'user' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                                            }`}>
                                            📎 {msg.fileName}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                )}

                {/* Selected Pending File Preview */}
                {selectedFile && !messages.length && (
                    <div className="inline-flex items-center gap-2 bg-gray-100 border border-gray-200 text-gray-600 text-xs sm:text-sm px-3 py-1.5 rounded-lg mb-4 animate-fade-in">
                        📎 <span className="font-medium truncate max-w-[200px]">{selectedFile.name}</span>
                        <button
                            type="button"
                            onClick={() => setSelectedFile(null)}
                            className="text-gray-400 hover:text-red-500 font-bold ml-1"
                        >
                            &times;
                        </button>
                    </div>
                )}

                {/* Centered Input Housing when Idle */}
                {!hasChatStarted && (
                    <div className="w-full max-w-2xl transition-all duration-500">
                        <ChatInputForm
                            message={message}
                            setMessage={setMessage}
                            handleSend={handleSend}
                            fileInputRef={fileInputRef}
                            handleFileChange={handleFileChange}
                            handlePlusClick={handlePlusClick}
                        />
                    </div>
                )}
            </main>

            {/* Bottom Input Housing when Active */}
            {hasChatStarted && (
                <footer className="p-3 sm:p-6 border-t border-gray-100 bg-white shrink-0">
                    <div className="max-w-3xl mx-auto">
                        {selectedFile && (
                            <div className="inline-flex items-center gap-2 bg-gray-100 border border-gray-200 text-gray-600 text-xs sm:text-sm px-3 py-1.5 rounded-lg mb-2">
                                📎 <span className="font-medium truncate max-w-[200px]">{selectedFile.name}</span>
                                <button type="button" onClick={() => setSelectedFile(null)} className="text-gray-400 hover:text-red-500 font-bold ml-1">&times;</button>
                            </div>
                        )}
                        <ChatInputForm
                            message={message}
                            setMessage={setMessage}
                            handleSend={handleSend}
                            fileInputRef={fileInputRef}
                            handleFileChange={handleFileChange}
                            handlePlusClick={handlePlusClick}
                        />
                    </div>
                </footer>
            )}
        </section>
    );
};

interface InputFormProps {
    message: string;
    setMessage: (val: string) => void;
    handleSend: (e: React.FormEvent) => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handlePlusClick: () => void;
}

const ChatInputForm: React.FC<InputFormProps> = ({
    message,
    setMessage,
    handleSend,
    fileInputRef,
    handleFileChange,
    handlePlusClick
}) => {
    return (
        <form onSubmit={handleSend} className="w-full flex items-center gap-3 relative">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".csv,.pdf,.json,image/*"
            />

            <button
                type="button"
                onClick={handlePlusClick}
                className="absolute left-3 p-2 text-gray-400 hover:text-gray-600 active:scale-95 transition-all z-10"
            >
                <PlusIcon className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
            </button>

            <input
                type="text"
                placeholder="Type your question for Finance AI..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full pl-12 pr-14 py-3 sm:py-4 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#63a2cf]/50 bg-[#fafafa] text-sm sm:text-base text-gray-950 placeholder-gray-400 transition-all shadow-sm"
            />

            <button
                type="submit"
                className="absolute right-1.5 p-2.5 sm:p-3 bg-[#63a2cf] text-white rounded-full hover:bg-[#5291be] transition-colors"
            >
                <PaperAirplaneIcon className="w-4 sm:w-5 h-4 sm:h-5 transform rotate-45 -translate-y-0.5 translate-x-0.5" />
            </button>
        </form>
    );
};