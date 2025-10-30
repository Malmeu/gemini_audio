import React from 'react';
import { BotIcon } from './Icons';

const Header: React.FC = () => {
  return (
    <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-50">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4 flex items-center gap-4">
        <BotIcon className="w-8 h-8 text-cyan-400" />
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">
            Call Analysis Conversational Agent
          </h1>
          <p className="text-sm text-gray-400">
            Analyze call transcripts and practice with an AI sales coach.
          </p>
        </div>
      </div>
    </header>
  );
};

export default Header;
