import React, { useState } from 'react';

interface SaveFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (tableName: string, customName: string) => void;
    isSaving: boolean;
    title: string;
    content: string;
}

const TABLE_NAMES = ['staffy', 'mutuelle', 'timeone', 'sercure'] as const;
type TableName = typeof TABLE_NAMES[number];

const TABLE_DISPLAY_NAMES: Record<TableName, string> = {
    staffy: 'Staffy',
    mutuelle: 'Mutuelle',
    timeone: 'TimeOne',
    sercure: 'Sercure'
};

const getTableDisplayName = (tableName: TableName): string => {
    return TABLE_DISPLAY_NAMES[tableName];
};

export const SaveForm: React.FC<SaveFormProps> = ({
    isOpen,
    onClose,
    onSave,
    isSaving,
    title,
    content
}) => {
    const [selectedTable, setSelectedTable] = useState<TableName>('staffy');
    const [customName, setCustomName] = useState<string>('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (customName.trim()) {
            onSave(selectedTable, customName);
            setCustomName('');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-sky-400">Sauvegarder la transcription</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Nom de l'enregistrement
                        </label>
                        <input
                            type="text"
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                            placeholder="Entrez un nom pour cette transcription..."
                            required
                        />
                    </div>
                    
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Table de destination
                        </label>
                        <select
                            value={selectedTable}
                            onChange={(e) => setSelectedTable(e.target.value as TableName)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                        >
                            {TABLE_NAMES.map(table => (
                                <option key={table} value={table}>
                                    {getTableDisplayName(table)}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving || !customName.trim()}
                            className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
