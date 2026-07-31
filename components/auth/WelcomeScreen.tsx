import React, { useState } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

interface WelcomeScreenProps {
    onNext: (name: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onNext }) => {
    const [name, setName] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) onNext(name);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm sm:max-w-md bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm text-center space-y-6">

                {/* Fixed Circular Logo Wrapper */}
                <div className="mx-auto w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-[#63a2cf] bg-[#eaf2f8] flex items-center justify-center text-3xl sm:text-4xl text-[#63a2cf] shadow-inner">
                    🤖
                </div>

                <div className="space-y-2">
                    <h2 className="text-2xl sm:text-3xl font-bold text-[#63a2cf] tracking-tight">
                        Welcome to Finance AI
                    </h2>
                    <p className="text-gray-400 text-sm sm:text-base">
                        Enter your name to get started.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <Input
                        type="text"
                        placeholder="Your name here..."
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                    <Button type="submit">
                        Continue to Chat
                    </Button>
                </form>
            </div>
        </div>
    );
};