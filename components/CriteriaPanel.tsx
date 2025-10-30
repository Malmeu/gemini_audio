import React, { useState } from 'react';
import { ANALYSIS_CRITERIA } from '../constants';
import { Criterion } from '../types';
import { ChevronDownIcon, ChevronUpIcon } from './Icons';

const CriteriaPanel: React.FC = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6 h-full sticky top-24">
      <h2 className="text-2xl font-bold mb-6 text-white">Analysis Criteria</h2>
      <div className="space-y-4">
        {ANALYSIS_CRITERIA.map((criterion: Criterion) => (
          <div key={criterion.id} className="bg-gray-700/50 rounded-md">
            <button
              onClick={() => toggleExpand(criterion.id)}
              className="w-full text-left p-4 flex justify-between items-center hover:bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <span className="font-semibold">{criterion.title}</span>
              {expandedId === criterion.id ? (
                <ChevronUpIcon className="w-5 h-5" />
              ) : (
                <ChevronDownIcon className="w-5 h-5" />
              )}
            </button>
            {expandedId === criterion.id && (
              <div className="p-4 border-t border-gray-600">
                <p className="text-gray-300">{criterion.summary}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CriteriaPanel;
