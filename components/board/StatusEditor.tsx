import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

type StatusOption = {
    label: string;
    color: string;
};

type Props = {
    isOpen: boolean;
    onClose: () => void;
    initialOptions: StatusOption[];
    onSave: (options: StatusOption[]) => void;
};

const PRESET_COLORS = [
    '#00c875', // Green
    '#fdab3d', // Orange
    '#e2445c', // Red
    '#0073ea', // Blue
    '#a25ddc', // Purple
    '#784bd1', // Dark Purple
    '#ff642e', // Coral
    '#ffcb00', // Yellow
    '#808080', // Grey
    '#333333', // Black
];

export function StatusEditor({ isOpen, onClose, initialOptions, onSave }: Props) {
    const [options, setOptions] = useState<StatusOption[]>(initialOptions);

    useEffect(() => {
        setOptions(initialOptions);
    }, [initialOptions]);

    if (!isOpen) return null;

    const handleAddOption = () => {
        setOptions([...options, { label: 'New Status', color: '#808080' }]);
    };

    const handleUpdateOption = (index: number, field: keyof StatusOption, value: string) => {
        const newOptions = [...options];
        newOptions[index] = { ...newOptions[index], [field]: value };
        setOptions(newOptions);
    };

    const handleDeleteOption = (index: number) => {
        setOptions(options.filter((_, i) => i !== index));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg bg-surface p-6 shadow-xl border border-border bg-white">
                <h2 className="mb-4 text-lg font-semibold">Edit Status Options</h2>

                <div className="mb-4 space-y-2 max-h-[60vh] overflow-y-auto">
                    {options.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <div className="relative group">
                                <div
                                    className="h-8 w-8 rounded border cursor-pointer"
                                    style={{ backgroundColor: option.color }}
                                />
                                <div className="absolute top-full left-0 mt-1 hidden group-hover:grid grid-cols-5 gap-1 p-2 bg-white shadow-lg rounded border z-10 w-[150px]">
                                    {PRESET_COLORS.map(color => (
                                        <div
                                            key={color}
                                            className="h-5 w-5 rounded cursor-pointer hover:scale-110 transition-transform"
                                            style={{ backgroundColor: color }}
                                            onClick={() => handleUpdateOption(index, 'color', color)}
                                        />
                                    ))}
                                </div>
                            </div>

                            <input
                                type="text"
                                value={option.label}
                                onChange={(e) => handleUpdateOption(index, 'label', e.target.value)}
                                className="flex-1 rounded border px-2 py-1 text-sm"
                                placeholder="Status label"
                            />

                            <button
                                onClick={() => handleDeleteOption(index)}
                                className="text-muted-foreground hover:text-destructive p-1"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>

                <div className="mb-6">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddOption}
                        className="w-full border-dashed"
                    >
                        + Add Option
                    </Button>
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={() => onSave(options)}>
                        Save Changes
                    </Button>
                </div>
            </div>
        </div>
    );
}
