import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CSSProperties } from "react";

interface SortableColumnHeaderProps {
    id: string;
    column: any;
    width: number;
    isEditing: boolean;
    editingName: string;
    setEditingName: (name: string) => void;
    onRename: (id: string, name: string) => void;
    setEditingColumnId: (id: string) => void;
    setEditingColumnName: (name: string) => void;
    onChangeColumnType: (id: string, type: any) => void;
    children?: React.ReactNode;
}

export function SortableColumnHeader({
    id,
    column,
    width,
    isEditing,
    editingName,
    setEditingName,
    onRename,
    setEditingColumnId,
    setEditingColumnName,
    onChangeColumnType,
    children
}: SortableColumnHeaderProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style: CSSProperties = {
        transform: CSS.Translate.toString(transform),
        transition,
        width: `${width}px`,
        minWidth: `${width}px`,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative',
    };

    return (
        <th
            ref={setNodeRef}
            style={style}
            className="border-r border-border px-4 py-3 text-left font-medium text-muted-foreground group relative resize-x overflow-auto"
            {...attributes}
            {...listeners}
        >
            <div className="flex items-center justify-between">
                {isEditing ? (
                    <input
                        className="w-full rounded border px-2 py-1 text-sm text-foreground"
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => onRename(column.id, editingName)}
                        onKeyDown={(e) => e.key === 'Enter' && onRename(column.id, editingName)}
                        // Prevent drag when editing
                        onPointerDown={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span
                        className="cursor-pointer hover:text-primary w-full block"
                        onClick={() => {
                            setEditingColumnId(column.id);
                            setEditingColumnName(column.name);
                        }}
                    >
                        {column.name}
                    </span>
                )}
            </div>
            <div className="absolute right-1 top-1 hidden group-hover:flex gap-1 bg-background p-1 shadow-sm rounded border border-border z-10">
                <select
                    className="text-xs border rounded px-1"
                    value={column.type}
                    onChange={(e) => onChangeColumnType(column.id, e.target.value as any)}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <option value="text">Text</option>
                    <option value="status">Status</option>
                    <option value="number">Number</option>
                    <option value="money">Money</option>
                    <option value="date">Date</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="checkbox">Checkbox</option>
                </select>
                {children}
            </div>
        </th>
    );
}
