import React, { useState } from 'react';
import ErrorMessage from './ErrorMessage';
import type { NewTaskPayload, ProductMember } from '../types';
import HtmlRenderer from './HtmlRenderer';
import { TEAM_MEMBERS } from '../constants';

interface AddTaskModalProps {
  onClose: () => void;
  onSave: (taskData: NewTaskPayload) => Promise<void>;
  productMembers: ProductMember[];
  accessToken: string;
}

const formElementClasses = "w-full bg-slate-800 border border-slate-600 rounded-md p-2 text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors";

const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const AddTaskModal: React.FC<AddTaskModalProps> = ({ onClose, onSave, productMembers, accessToken }) => {
  const todayStr = getTodayDateString();
  
  const [formData, setFormData] = useState<Omit<NewTaskPayload, 'projectId'>>({
      name: '',
      description: '',
      startDate: todayStr,
      endDate: todayStr,
      assigneeId: '',
      status: 'To Do',
      priority: 'Medium',
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditingDescription, setIsEditingDescription] = useState(true);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            if (!blob) continue;

            const reader = new FileReader();
            reader.onload = (event) => {
                const base64Image = event.target?.result as string;
                // Wrap in a paragraph tag for better rich text compatibility
                const imgTag = `<p><img src="${base64Image}" alt="pasted image" /></p>`;

                const textarea = e.target as HTMLTextAreaElement;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const currentValue = textarea.value;
                const newValue = currentValue.substring(0, start) + imgTag + currentValue.substring(end);

                setFormData(prev => ({ ...prev, description: newValue }));
            };
            reader.readAsDataURL(blob);

            e.preventDefault(); // Prevent default paste behavior
            return;
        }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
        setError("Task name is required.");
        return;
    }
    if (!formData.assigneeId) {
        setError("Assignee is required.");
        return;
    }
    
    setError(null);
    setIsLoading(true);

    try {
        await onSave(formData as NewTaskPayload);
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save the task. Please try again.');
        setIsLoading(false);
    }
  };


  return (
    <div 
        className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
        aria-modal="true"
        role="dialog"
    >
      <div 
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
            <header className="p-4 border-b border-slate-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Add New Task</h2>
                <button 
                    type="button"
                    onClick={onClose} 
                    className="text-slate-400 hover:text-white transition-colors p-1 rounded-full"
                    aria-label="Close modal"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </header>
            <main className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                    <label htmlFor="task-name" className="block text-sm font-medium text-slate-300 mb-1">
                        Task Name <span className="text-red-400">*</span>
                    </label>
                    <input
                        type="text"
                        id="task-name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className={formElementClasses}
                        required
                        disabled={isLoading}
                        autoFocus
                    />
                </div>
                <div>
                    <label htmlFor="task-description" className="block text-sm font-medium text-slate-300 mb-1">
                        Description
                    </label>
                    {isEditingDescription ? (
                        <textarea
                            id="task-description"
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            onPaste={handlePaste}
                            rows={10}
                            className={formElementClasses}
                            disabled={isLoading}
                            placeholder="Add a description. You can paste images directly."
                            onBlur={() => setIsEditingDescription(false)}
                        />
                    ) : (
                        <div
                            onClick={() => setIsEditingDescription(true)}
                            className="w-full bg-slate-800 border border-dashed border-slate-600 hover:border-solid hover:border-cyan-500 rounded-md p-2 min-h-[220px] max-h-[400px] overflow-y-auto cursor-pointer transition-colors"
                        >
                            {formData.description ? (
                                <HtmlRenderer htmlString={formData.description} accessToken={accessToken} />
                            ) : (
                                <span className="text-slate-500 italic">Click to add a description...</span>
                            )}
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                     <div>
                        <label htmlFor="assigneeId" className="block text-sm font-medium text-slate-300 mb-1">
                            Assignee <span className="text-red-400">*</span>
                        </label>
                        <select
                            id="assigneeId"
                            name="assigneeId"
                            value={formData.assigneeId || ''}
                            onChange={handleInputChange}
                            className={formElementClasses}
                            required
                        >
                            <option value="" disabled>Select an assignee</option>
                            {productMembers
                                .filter(member => {
                                    const displayName = member.name?.split('_')[0] || member.name;
                                    return TEAM_MEMBERS.some(rm => displayName === rm);
                                })
                                .map(member => (
                                <option key={member.id} value={member.id}>
                                    {member.name?.split('_')[0] || member.name}
                                </option>
                            ))}
                        </select>
                    </div>
                     <div>
                        <label htmlFor="status" className="block text-sm font-medium text-slate-300 mb-1">Status</label>
                        <select
                            id="status"
                            name="status"
                            value={formData.status}
                            onChange={handleInputChange}
                            className={formElementClasses}
                        >
                            <option>To Do</option>
                            <option>In Progress</option>
                            <option>Review</option>
                            <option>Completed</option>
                            <option>Pending</option>
                        </select>
                    </div>
                     <div>
                        <label htmlFor="priority" className="block text-sm font-medium text-slate-300 mb-1">Priority</label>
                        <select
                            id="priority"
                            name="priority"
                            value={formData.priority}
                            onChange={handleInputChange}
                            className={formElementClasses}
                        >
                            <option>Medium</option>
                            <option>Low</option>
                            <option>High</option>
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="start-date" className="block text-sm font-medium text-slate-300 mb-1">
                            Start Date
                        </label>
                        <input
                            type="date"
                            id="start-date"
                            name="startDate"
                            value={formData.startDate}
                            onChange={handleInputChange}
                            className={formElementClasses}
                            disabled={isLoading}
                        />
                    </div>
                     <div>
                        <label htmlFor="due-date" className="block text-sm font-medium text-slate-300 mb-1">
                            Due Date
                        </label>
                        <input
                            type="date"
                            id="due-date"
                            name="endDate"
                            value={formData.endDate}
                            onChange={handleInputChange}
                            className={formElementClasses}
                            disabled={isLoading}
                        />
                    </div>
                </div>
                {error && <ErrorMessage message={error} />}
            </main>
            <footer className="p-4 border-t border-slate-700 flex justify-end gap-3">
                <button 
                    type="button" 
                    onClick={onClose}
                    className="px-4 py-2 rounded-md text-sm font-semibold bg-slate-600 hover:bg-slate-500 text-slate-200 transition-colors"
                    disabled={isLoading}
                >
                    Cancel
                </button>
                <button 
                    type="submit"
                    className="px-4 py-2 rounded-md text-sm font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors disabled:bg-slate-700 disabled:cursor-not-allowed"
                    disabled={isLoading}
                >
                    {isLoading ? 'Saving...' : 'Save Task'}
                </button>
            </footer>
        </form>
      </div>
    </div>
  );
};

export default AddTaskModal;