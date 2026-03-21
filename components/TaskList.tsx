import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Task, TaskStatus, UpdateTaskPayload, ProductMember, TechResource } from '../types';
import Tabs from './Tabs';
import Checkbox from './Checkbox';
import TaskDetailModal from './TaskDetailModal';

interface TaskListProps {
  tasks: Task[];
  onUpdateTask: (taskId: string, data: UpdateTaskPayload) => Promise<void>;
  accessToken: string;
  productMembers: ProductMember[];
  isAuthenticated: boolean;

  onResourceClick: (resource: TechResource) => void;
}

type FilterStatus = 'All' | TaskStatus;

const TaskList: React.FC<TaskListProps> = ({ tasks, onUpdateTask, accessToken, productMembers, isAuthenticated, onResourceClick }) => {
  const [activeTab, setActiveTab] = useState<FilterStatus>('All');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [displayTasks, setDisplayTasks] = useState<Task[]>([]);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  
  const visibleTasks = useMemo(() => tasks.filter(t => t.status !== 'Cancelled'), [tasks]);

  // When the external tasks list is refreshed, find the latest version
  // of the selected task and update the modal state to show the new data.
  useEffect(() => {
    if (selectedTask) {
      const updatedTask = tasks.find(t => t.id === selectedTask.id);
      if (updatedTask && updatedTask.status !== 'Cancelled') {
        setSelectedTask(updatedTask);
      } else {
        // If the task was deleted or is no longer in the list, close the modal.
        setSelectedTask(null);
      }
    }
  }, [tasks, selectedTask]);

  // This effect will filter and sort the tasks whenever the source `tasks` or the filter `activeTab` changes.
  useEffect(() => {
    const filtered = activeTab === 'All' || activeTab === 'Unknown'
        ? visibleTasks
        : visibleTasks.filter(task => task.status === activeTab);
    
    const sorted = [...filtered].sort((a, b) => {
        const aHasDate = a.endDateRaw && !isNaN(new Date(a.endDateRaw).getTime());
        const bHasDate = b.endDateRaw && !isNaN(new Date(b.endDateRaw).getTime());

        if (aHasDate && !bHasDate) return -1; // a comes first
        if (!aHasDate && bHasDate) return 1;  // b comes first
        if (!aHasDate && !bHasDate) return 0; // equal

        // Both have valid dates, sort ascending (nearest date first)
        return new Date(a.endDateRaw!).getTime() - new Date(b.endDateRaw!).getTime();
    });
    
    setDisplayTasks(sorted);
  }, [visibleTasks, activeTab]);
  
  const tabCounts = React.useMemo(() => ({
    'All': visibleTasks.length,
    'To Do': visibleTasks.filter(t => t.status === 'To Do').length,
    'In Progress': visibleTasks.filter(t => t.status === 'In Progress').length,
    'Review': visibleTasks.filter(t => t.status === 'Review').length,
    'Completed': visibleTasks.filter(t => t.status === 'Completed').length,
    'Pending': visibleTasks.filter(t => t.status === 'Pending').length,
  }), [visibleTasks]);

  const handleToggleComplete = async (task: Task) => {
    const newStatus = task.status === 'Completed' ? 'To Do' : 'Completed';
    await onUpdateTask(task.id, { status: newStatus });
  };
  
  const handleDelete = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    // No confirmation needed as per user request to fix sandbox issue.
    await onUpdateTask(taskId, { status: 'Cancelled' });
  };

  const handleDragStart = (e: React.DragEvent<HTMLLIElement>, index: number) => {
    dragItem.current = index;
    e.currentTarget.classList.add('opacity-50');
  };

  const handleDragEnter = (e: React.DragEvent<HTMLLIElement>, index: number) => {
    dragOverItem.current = index;
    e.currentTarget.classList.add('bg-slate-800');
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLIElement>) => {
    e.currentTarget.classList.remove('bg-slate-800');
  };

  const handleDrop = (e: React.DragEvent<HTMLLIElement>) => {
    e.currentTarget.classList.remove('bg-slate-800');
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
      return;
    }

    const newTasks = [...displayTasks];
    const draggedItemContent = newTasks.splice(dragItem.current, 1)[0];
    newTasks.splice(dragOverItem.current, 0, draggedItemContent);
    
    dragItem.current = null;
    dragOverItem.current = null;
    
    setDisplayTasks(newTasks);
  };

  const handleDragEnd = (e: React.DragEvent<HTMLLIElement>) => {
    e.currentTarget.classList.remove('opacity-50');
  };

  if (visibleTasks.length === 0) {
      return <p className="text-center text-slate-400 py-8">Không có công việc nào cho dự án này.</p>
  }

  return (
    <div className="h-full flex flex-col">
        <div className="flex-shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-grow">
                    <Tabs 
                        tabs={['All', 'To Do', 'In Progress', 'Review', 'Completed', 'Pending']}
                        counts={tabCounts}
                        activeTab={activeTab}
                        onTabClick={(tab) => setActiveTab(tab as FilterStatus)}
                    />
                </div>
            </div>
        </div>
        <div className="mt-4 flex-1 min-h-0 overflow-y-auto pr-2">
             <ul role="list" className="-my-4 divide-y divide-slate-700">
                {displayTasks.map((task, index) => {
                    const isCompleted = task.status === 'Completed';
                    return (
                        <li 
                            key={task.id} 
                            className={`py-4 flex items-center space-x-4 group transition-colors cursor-pointer`}
                            draggable={isAuthenticated}
                            onDragStart={(e) => isAuthenticated && handleDragStart(e, index)}
                            onDragEnter={(e) => isAuthenticated && handleDragEnter(e, index)}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onDragOver={(e) => isAuthenticated && e.preventDefault()}
                            onDragEnd={handleDragEnd}
                            onClick={() => setSelectedTask(task)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if(e.key === 'Enter') setSelectedTask(task) }}
                        >
                            {isAuthenticated && (
                                <Checkbox 
                                    id={`task-checkbox-${task.id}`} 
                                    checked={isCompleted}
                                    // Prevent modal from opening when clicking the checkbox
                                    onClick={(e) => e.stopPropagation()} 
                                    onChange={() => handleToggleComplete(task)}
                                    aria-label={`Mark task ${task.name} as ${isCompleted ? 'incomplete' : 'complete'}`}
                                />
                            )}
                            <div className={`flex-1 min-w-0 ${!isAuthenticated ? 'ml-2' : ''}`}>
                                <span className={`text-sm font-medium text-slate-200 truncate ${isAuthenticated ? 'group-hover:text-cyan-400' : 'group-hover:text-cyan-400'} transition-colors ${isCompleted ? 'line-through text-slate-500' : ''}`}>
                                    {task.name}
                                </span>
                                <p className="text-xs text-slate-400 mt-1 flex items-center flex-wrap gap-x-2">
                                    <span>{task.assignee}</span>
                                    <span className="text-slate-600">&bull;</span>
                                    <span>Start: {task.startDate}</span>
                                    <span className="text-slate-600">&bull;</span>
                                    <span>Due: {task.dueDate}</span>
                                </p>
                            </div>
                             {isAuthenticated && (
                                <button
                                    onClick={(e) => handleDelete(e, task.id)}
                                    className="ml-2 p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                                    aria-label={`Deactivate task ${task.name}`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            )}
                        </li>
                    )
                })}
             </ul>
             {displayTasks.length === 0 && activeTab !== 'All' && (
                <p className="text-center text-slate-400 py-8">Không có công việc nào khớp với bộ lọc.</p>
             )}
        </div>

        {selectedTask && (
            <TaskDetailModal 
                task={selectedTask} 
                onClose={() => setSelectedTask(null)}
                onSave={onUpdateTask}
                accessToken={accessToken}
                productMembers={productMembers}

            />
        )}
    </div>
  );
};

export default TaskList;