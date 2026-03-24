import React, { useState, useEffect } from 'react';
import type { Task, UpdateTaskPayload, TaskStatus, TaskPriority, ProductMember, TechResource, NewTechResourcePayload } from '../types';
import ErrorMessage from './ErrorMessage';
import HtmlRenderer from './HtmlRenderer';
import { createTechResource, getTechResources } from '../services/dataverseService';
import { TECH_RESOURCE_TYPE_MAPPING, TEAM_MEMBERS } from '../constants';

interface TaskDetailModalProps {
  task: Task;
  onClose: () => void;
  onSave: (taskId: string, data: UpdateTaskPayload) => Promise<void>;
  accessToken: string;
  productMembers: ProductMember[];

}

const formElementClasses = "w-full bg-slate-800 border border-slate-600 rounded-md p-2 text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const formatDateForInput = (dateString?: string): string => {
  if (!dateString || dateString === 'N/A') return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
};

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ task, onClose, onSave, accessToken, productMembers }) => {
  const [formData, setFormData] = useState({
    name: task.name,
    description: task.description,
    startDate: formatDateForInput(task.startDateRaw),
    endDate: formatDateForInput(task.endDateRaw),
    assigneeId: task.assigneeId || '',
    status: task.status,
    priority: task.priority,
    proofOfComplete: task.proofOfComplete || '',
    techResourceId: task.techResource?.id || '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<null | 'description' | 'proofOfComplete'>(null);
  
  // Tech Resource State
  const [availableResources, setAvailableResources] = useState<TechResource[]>([]);
  const [isCreatingResource, setIsCreatingResource] = useState(false);
  const [newResource, setNewResource] = useState<NewTechResourcePayload>({
      name: '',
      type: '',
      version: '',
      description: '',
      resourceLink: ''
  });

  // Searchable Dropdown State
  const [resourceSearchTerm, setResourceSearchTerm] = useState('');
  const [showResourceDropdown, setShowResourceDropdown] = useState(false);

  const isReadOnly = false;

  useEffect(() => {
    setFormData({
      name: task.name,
      description: task.description,
      startDate: formatDateForInput(task.startDateRaw),
      endDate: formatDateForInput(task.endDateRaw),
      assigneeId: task.assigneeId || '',
      status: task.status,
      priority: task.priority,
      proofOfComplete: task.proofOfComplete || '',
      techResourceId: task.techResource?.id || '',
    });
     // Reset editing field when task changes
    setEditingField(null);
    setIsCreatingResource(false);
  }, [task]);

  useEffect(() => {
      // Load available resources when modal opens
      getTechResources(accessToken).then(setAvailableResources).catch(console.error);
  }, [accessToken]);

  // Sync search term with selected resource when data loads or selection changes externally
  useEffect(() => {
    if (formData.techResourceId && availableResources.length > 0) {
        const selected = availableResources.find(r => r.id === formData.techResourceId);
        if (selected) {
            setResourceSearchTerm(selected.name);
        }
    } else if (!formData.techResourceId) {
        setResourceSearchTerm('');
    }
  }, [formData.techResourceId, availableResources]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleNewResourceChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setNewResource(prev => ({ ...prev, [name]: value }));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>, fieldName: 'description' | 'proofOfComplete') => {
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

                setFormData(prev => ({ ...prev, [fieldName]: newValue }));
            };
            reader.readAsDataURL(blob);

            e.preventDefault(); // Prevent default paste behavior
            return;
        }
    }
  };

  const handleSave = async () => {
    if (isReadOnly) return;
    setError(null);
    setIsLoading(true);
    try {
      let finalTechResourceId = formData.techResourceId;
      
      if (isCreatingResource) {
          if (!newResource.name) throw new Error("Resource name is required");
          const createdId = await createTechResource(newResource, accessToken);
          finalTechResourceId = createdId;
      }

      await onSave(task.id, {
        name: formData.name,
        description: formData.description,
        startDate: formData.startDate,
        endDate: formData.endDate,
        assigneeId: formData.assigneeId,
        status: formData.status as TaskStatus,
        priority: formData.priority as TaskPriority,
        proofOfComplete: formData.proofOfComplete,
        techResourceId: finalTechResourceId || null
      });
      onClose();
    } catch(err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (isReadOnly) return;
    setError(null);
    setIsLoading(true);
    try {
        await onSave(task.id, { status: 'Cancelled' });
        onClose();
    } catch(err) {
        setError(err instanceof Error ? err.message : 'Failed to deactivate the task.');
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
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

  // Filter resources for the dropdown
  const filteredResources = availableResources.filter(r => 
    r.name.toLowerCase().includes(resourceSearchTerm.toLowerCase())
  );

  return (
    <div 
        className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
        aria-modal="true"
        role="dialog"
    >
        <div 
            className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
        >
            <header className="p-4 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
                 <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full bg-transparent text-xl font-bold text-slate-100 focus:outline-none placeholder-slate-500 disabled:opacity-100"
                    placeholder="Task Name"
                    disabled={isReadOnly}
                />
                
                <button 
                    onClick={onClose} 
                    className="text-slate-400 hover:text-white transition-colors p-1 rounded-full ml-4"
                    aria-label="Close task details"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </header>
            
            <main className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0 overflow-hidden">
                {/* Left Column for major text areas - Using flex to fill height */}
                <div className="md:col-span-2 flex flex-col gap-4 h-full min-h-0">
                     {/* Description: Flex 1 (50% space) */}
                     <div className="flex flex-col flex-1 min-h-0">
                        <label htmlFor="task-description" className="block text-sm font-medium text-slate-300 mb-1 flex-shrink-0">Description</label>
                        {editingField === 'description' && !isReadOnly ? (
                            <textarea
                                id="task-description"
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                onPaste={(e) => handlePaste(e, 'description')}
                                className={`${formElementClasses} h-full resize-none`}
                                autoFocus
                                onBlur={() => setEditingField(null)}
                            />
                        ) : (
                            <div 
                                onClick={() => !isReadOnly && setEditingField('description')}
                                className={`w-full h-full bg-slate-800 border border-dashed border-slate-600 rounded-md p-2 overflow-y-auto transition-colors ${!isReadOnly ? 'hover:border-solid hover:border-cyan-500 cursor-pointer' : ''}`}
                            >
                                {formData.description ? (
                                    <HtmlRenderer htmlString={formData.description} accessToken={accessToken} /> 
                                ) : (
                                    <span className="text-slate-500 italic">Click to add a description...</span>
                                )}
                            </div>
                        )}
                    </div>
                     
                     {/* Proof of Complete: Flex 1 (50% space) */}
                     <div className="flex flex-col flex-1 min-h-0">
                        <label htmlFor="proof-of-complete" className="block text-sm font-medium text-slate-300 mb-1 flex-shrink-0">Proof of Complete</label>
                         {editingField === 'proofOfComplete' && !isReadOnly ? (
                            <textarea
                                id="proof-of-complete"
                                name="proofOfComplete"
                                value={formData.proofOfComplete}
                                onChange={handleInputChange}
                                onPaste={(e) => handlePaste(e, 'proofOfComplete')}
                                className={`${formElementClasses} h-full resize-none`}
                                autoFocus
                                onBlur={() => setEditingField(null)}
                            />
                        ) : (
                            <div 
                                onClick={() => !isReadOnly && setEditingField('proofOfComplete')}
                                className={`w-full h-full bg-slate-800 border border-dashed border-slate-600 rounded-md p-2 overflow-y-auto transition-colors ${!isReadOnly ? 'hover:border-solid hover:border-cyan-500 cursor-pointer' : ''}`}
                            >
                                {formData.proofOfComplete ? (
                                    <HtmlRenderer htmlString={formData.proofOfComplete} accessToken={accessToken} />
                                ) : (
                                    <span className="text-slate-500 italic">Click to add proof of completion...</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column for metadata - Independent scrolling */}
                <div className="md:col-span-1 space-y-4 h-full overflow-y-auto pr-2">
                     <div>
                        <label htmlFor="assigneeId" className="block text-sm font-medium text-slate-300 mb-1">Assignee</label>
                        <select
                            id="assigneeId"
                            name="assigneeId"
                            value={formData.assigneeId}
                            onChange={handleInputChange}
                            className={formElementClasses}
                            disabled={isReadOnly}
                        >
                            <option value="">Unassigned</option>
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
                            disabled={isReadOnly}
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
                            disabled={isReadOnly}
                        >
                            <option>N/A</option>
                            <option>Low</option>
                            <option>Medium</option>
                            <option>High</option>
                        </select>
                    </div>
                     <div>
                        <label htmlFor="start-date" className="block text-sm font-medium text-slate-300 mb-1">Start Date</label>
                        <input
                            type="date"
                            id="start-date"
                            name="startDate"
                            value={formData.startDate}
                            onChange={handleInputChange}
                            className={formElementClasses}
                            disabled={isReadOnly}
                        />
                    </div>
                    <div>
                        <label htmlFor="end-date" className="block text-sm font-medium text-slate-300 mb-1">End Date</label>
                        <input
                            type="date"
                            id="end-date"
                            name="endDate"
                            value={formData.endDate}
                            onChange={handleInputChange}
                            className={formElementClasses}
                            disabled={isReadOnly}
                        />
                    </div>
                    
                    <div className="pt-4 border-t border-slate-700 relative">
                        <div className="flex items-center justify-between mb-2">
                             <label className="block text-sm font-medium text-slate-300">Tech Resource / Deliverable</label>
                             {!isReadOnly && (
                             <button 
                                type="button" 
                                onClick={() => {
                                    setIsCreatingResource(!isCreatingResource);
                                    if (showResourceDropdown) setShowResourceDropdown(false);
                                }}
                                className="text-xs text-cyan-400 hover:text-cyan-300 underline"
                             >
                                {isCreatingResource ? "Select Existing" : "Create New"}
                             </button>
                             )}
                        </div>
                        
                        {isCreatingResource ? (
                            <div className="bg-slate-800 border border-slate-600 rounded-md p-3 space-y-3">
                                <div>
                                    <input 
                                        type="text" 
                                        name="name"
                                        placeholder="Resource Name *" 
                                        value={newResource.name}
                                        onChange={handleNewResourceChange}
                                        className={formElementClasses + " text-sm"}
                                    />
                                </div>
                                <div>
                                    <select 
                                        name="type"
                                        value={newResource.type}
                                        onChange={handleNewResourceChange}
                                        className={formElementClasses + " text-sm"}
                                    >
                                        <option value="">Select Type</option>
                                        {Object.keys(TECH_RESOURCE_TYPE_MAPPING).map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input 
                                        type="text" 
                                        name="version"
                                        placeholder="Version" 
                                        value={newResource.version}
                                        onChange={handleNewResourceChange}
                                        className={formElementClasses + " text-sm"}
                                    />
                                     <input 
                                        type="text" 
                                        name="description"
                                        placeholder="Description" 
                                        value={newResource.description}
                                        onChange={handleNewResourceChange}
                                        className={formElementClasses + " text-sm"}
                                    />
                                </div>
                                <div>
                                     <input 
                                        type="text" 
                                        name="resourceLink"
                                        placeholder="Resource Link (URL)" 
                                        value={newResource.resourceLink}
                                        onChange={handleNewResourceChange}
                                        className={formElementClasses + " text-sm"}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="relative">
                                {/* Invisible Backdrop to close dropdown on click outside */}
                                {showResourceDropdown && (
                                    <div 
                                        className="fixed inset-0 z-10 cursor-default" 
                                        onClick={() => setShowResourceDropdown(false)}
                                    ></div>
                                )}
                                
                                <input
                                    type="text"
                                    placeholder="Search to select a resource..."
                                    value={resourceSearchTerm}
                                    onChange={(e) => {
                                        setResourceSearchTerm(e.target.value);
                                        setShowResourceDropdown(true);
                                        // Optional: clear selection if user types to search new one
                                        if (formData.techResourceId) {
                                            setFormData(prev => ({ ...prev, techResourceId: '' }));
                                        }
                                    }}
                                    onFocus={() => !isReadOnly && setShowResourceDropdown(true)}
                                    className={`${formElementClasses} ${isReadOnly ? 'cursor-default' : ''}`}
                                    disabled={isReadOnly}
                                />
                                {showResourceDropdown && !isReadOnly && (
                                    <ul className="absolute z-20 w-full bg-slate-800 border border-slate-600 mt-1 max-h-60 overflow-y-auto rounded-md shadow-lg custom-scrollbar">
                                        {filteredResources.length > 0 ? (
                                            filteredResources.map(res => (
                                                <li
                                                    key={res.id}
                                                    className="p-2 hover:bg-slate-700 cursor-pointer text-slate-200 border-b border-slate-700 last:border-0"
                                                    onClick={() => {
                                                        setFormData(prev => ({ ...prev, techResourceId: res.id }));
                                                        setResourceSearchTerm(res.name);
                                                        setShowResourceDropdown(false);
                                                    }}
                                                >
                                                    <div className="font-medium">{res.name}</div>
                                                    <div className="flex justify-between text-xs text-slate-500 mt-0.5">
                                                        <span>{res.type || 'Unknown Type'}</span>
                                                        {res.version && <span>v{res.version}</span>}
                                                    </div>
                                                </li>
                                            ))
                                        ) : (
                                            <li className="p-3 text-slate-500 text-sm text-center">
                                                No resources found matching "{resourceSearchTerm}"
                                            </li>
                                        )}
                                    </ul>
                                )}
                            </div>
                        )}
                        
                        {!isCreatingResource && task.techResource && formData.techResourceId === task.techResource.id && (
                             <div className="mt-2 text-sm text-slate-400 bg-slate-800 p-2 rounded border border-slate-700">
                                <p><span className="font-semibold text-slate-300">Linked:</span> {task.techResource.name}</p>
                                {task.techResource.resourceLink && (
                                    <a href={task.techResource.resourceLink} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline text-xs block mt-1 truncate">
                                        {task.techResource.resourceLink}
                                    </a>
                                )}
                             </div>
                        )}
                    </div>
                </div>
            </main>

            <footer className="p-4 border-t border-slate-700 flex justify-between items-center flex-shrink-0">
                <div>
                    {!isReadOnly && (
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isLoading}
                        className="px-4 py-2 rounded-md text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-colors disabled:text-slate-500 disabled:hover:bg-transparent"
                    >
                        Deactivate Task
                    </button>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {error && <ErrorMessage message={error}/>}
                    <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 rounded-md text-sm font-semibold bg-slate-600 hover:bg-slate-500 text-slate-200 transition-colors">
                        {isReadOnly ? 'Close' : 'Cancel'}
                    </button>
                    {!isReadOnly && (
                    <button type="button" onClick={handleSave} disabled={isLoading} className="px-4 py-2 rounded-md text-sm font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors disabled:bg-slate-700 disabled:cursor-not-allowed">
                      {isLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                    )}
                </div>
            </footer>
        </div>
    </div>
  );
};

export default TaskDetailModal;