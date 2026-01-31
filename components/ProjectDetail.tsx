


import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Project, Task, NewTaskPayload, UpdateTaskPayload, ProductMember, UpdateProjectPayload, TechResource } from '../types';
import { getTasksForProject, createTask, updateTask, updateProject } from '../services/dataverseService';
import Card from './Card';
import TaskList from './TaskList';
import Tabs from './Tabs';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import AddTaskModal from './AddTaskModal';
import EditProjectModal from './EditProjectModal';
import TechResourceModal from './TechResourceModal';
import WebviewModal from './WebviewModal';
import GenerateDocsModal from './GenerateDocsModal';
import TaskOverviewModal from './TaskOverviewModal';

interface ProjectDetailProps {
    project: Project;
    accessToken: string;
    productMembers: ProductMember[];
    onProjectUpdate: () => void;
    isAuthenticated: boolean;
    loggedInUserId: string | null;
}

const InfoRow: React.FC<{ label: string, value: React.ReactNode, isVertical?: boolean }> = ({ label, value, isVertical = false }) => (
    isVertical ? (
        <div>
            <dt className="text-sm text-slate-400">{label}</dt>
            <dd className="mt-1 text-sm font-semibold text-white">{value || <span className="font-normal text-slate-500">N/A</span>}</dd>
        </div>
    ) : (
        <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm text-slate-400">{label}</dt>
            <dd className="mt-1 text-sm font-semibold text-white sm:col-span-2 sm:mt-0">{value || <span className="font-normal text-slate-500">N/A</span>}</dd>
        </div>
    )
);

const PriorityDisplay: React.FC<{ priority: string | undefined }> = ({ priority }) => {
    const lowerPriority = priority?.toLowerCase();
    let colorClass = 'text-white';
    if (lowerPriority === 'high') {
        colorClass = 'text-red-400';
    } else if (lowerPriority === 'medium') {
        colorClass = 'text-yellow-400';
    } else if (lowerPriority === 'low') {
        colorClass = 'text-green-400';
    }
    return <span className={`font-semibold ${colorClass}`}>{priority || 'N/A'}</span>;
};


const DetailLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 hover:underline">
        {children}
    </a>
)

const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, accessToken, productMembers, onProjectUpdate, isAuthenticated, loggedInUserId }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isTasksLoading, setIsTasksLoading] = useState(true);
    const [tasksError, setTasksError] = useState<string | null>(null);
    const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
    const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
    const [isGenerateDocsModalOpen, setIsGenerateDocsModalOpen] = useState(false);
    const [isTaskOverviewModalOpen, setIsTaskOverviewModalOpen] = useState(false);
    const [selectedResource, setSelectedResource] = useState<TechResource | null>(null);
    const [webviewUrl, setWebviewUrl] = useState<string | null>(null);
    const [expandedTechGroups, setExpandedTechGroups] = useState<string[]>([]);

    const [activeTab, setActiveTab] = useState('Documents');

    const fetchTasks = useCallback(async () => {
        try {
            setIsTasksLoading(true);
            setTasksError(null);
            const fetchedTasks = await getTasksForProject(project.ai_processid, accessToken);
            setTasks(fetchedTasks);
        } catch (err) {
            setTasksError(err instanceof Error ? err.message : 'Failed to load tasks.');
        } finally {
            setIsTasksLoading(false);
        }
    }, [project.ai_processid, accessToken]);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    const progressPercentage = useMemo(() => {
        // Filter out Cancelled tasks from the calculation
        const validTasks = tasks.filter(t => t.status !== 'Cancelled');

        if (validTasks.length === 0) return 0;

        const completedTasks = validTasks.filter(t => t.status === 'Completed').length;
        return (completedTasks / validTasks.length) * 100;
    }, [tasks]);

    const { currentStep, nextStep, blockers } = useMemo(() => {
        const inProgressTasks = tasks.filter((t) => t.status === 'In Progress');
        const toDoTasks = tasks.filter((t) => t.status === 'To Do');
        const pendingTasks = tasks.filter((t) => t.status === 'Pending');

        const currentStep =
            inProgressTasks.length > 0
                ? inProgressTasks.map((t) => t.name).join(', ')
                : 'No tasks are currently in progress.';

        let nextStep = 'No upcoming tasks planned.';

        if (inProgressTasks.length > 0) {
            const validInProgress = inProgressTasks.filter(t => t.endDateRaw && !isNaN(new Date(t.endDateRaw).getTime()));

            if (validInProgress.length > 0) {
                const latestEndDate = new Date(
                    Math.max(...validInProgress.map(t => new Date(t.endDateRaw!).getTime()))
                );

                const upcomingTasks = toDoTasks
                    .filter(t => t.startDateRaw && !isNaN(new Date(t.startDateRaw).getTime()) && new Date(t.startDateRaw) > latestEndDate)
                    .sort((a, b) => new Date(a.startDateRaw!).getTime() - new Date(b.startDateRaw!).getTime());

                if (upcomingTasks.length > 0) {
                    nextStep = upcomingTasks[0].name;
                } else {
                    nextStep = "Review completed tasks or plan next steps.";
                }
            }
        } else if (toDoTasks.length > 0) {
            const sortedToDo = toDoTasks
                .filter(t => t.startDateRaw && !isNaN(new Date(t.startDateRaw).getTime()))
                .sort((a, b) => new Date(a.startDateRaw!).getTime() - new Date(b.startDateRaw!).getTime());

            if (sortedToDo.length > 0) {
                nextStep = sortedToDo[0].name;
            }
        }

        const blockers =
            pendingTasks.length > 0
                ? pendingTasks.map((t) => t.name).join(', ')
                : 'None';

        return { currentStep, nextStep, blockers };
    }, [tasks]);

    const techStackGrouped = useMemo(() => {
        const resources = new Map<string, TechResource>();
        tasks.forEach(task => {
            if (task.techResource) {
                resources.set(task.techResource.id, task.techResource);
            }
        });
        const uniqueResources = Array.from(resources.values());

        const acc: Record<string, TechResource[]> = {};
        for (const resource of uniqueResources) {
            const groupKey = resource.type || 'Others';
            if (!acc[groupKey]) {
                acc[groupKey] = [];
            }
            acc[groupKey].push(resource);
        }
        return acc;
    }, [tasks]);

    const handleAddTask = async (taskData: NewTaskPayload) => {
        try {
            await createTask({
                ...taskData,
                projectId: project.ai_processid
            }, accessToken, loggedInUserId);
            setIsAddTaskModalOpen(false);
            await fetchTasks(); // Refresh the list
        } catch (err) {
            console.error("Failed to create task:", err);
            throw err;
        }
    };

    const handleUpdateTask = async (taskId: string, data: UpdateTaskPayload) => {
        try {
            await updateTask(taskId, data, accessToken, loggedInUserId);
            await fetchTasks(); // Refresh the list on success
        } catch (err) {
            console.error("Failed to update task:", err);
            throw err;
        }
    };

    const handleUpdateProject = async (projectData: UpdateProjectPayload) => {
        try {
            await updateProject(project.ai_processid, projectData, accessToken, loggedInUserId);
            setIsEditProjectModalOpen(false);
            await onProjectUpdate(); // Trigger refresh in App.tsx
        } catch (err) {
            console.error("Failed to update project:", err);
            throw err; // Propagate error to modal to display it
        }
    };

    const handleResourceClick = (resource: TechResource) => {
        if (resource.resourceJson) {
            setSelectedResource(resource);
        } else if (resource.resourceLink) {
            setWebviewUrl(resource.resourceLink);
        }
    };

    const toggleTechGroup = (groupName: string) => {
        setExpandedTechGroups(prev =>
            prev.includes(groupName)
                ? prev.filter(g => g !== groupName)
                : [...prev, groupName]
        );
    };


    const documents = [
        { type: 'Documents', name: 'User Guide', link: project.crdfd_user_guide },
        { type: 'Documents', name: 'Technical Docs', link: project.crdfd_technical_docs },
        { type: 'Documents', name: 'Process URL', link: project.crdfd_processurl },
        { type: 'Documents', name: 'All Steps URL', link: project.crdfd_allstepurl },
    ];

    const renderTechDetailsContent = () => {
        if (activeTab === 'Documents') {
            const availableDocs = documents.filter(d => d.link);
            if (availableDocs.length === 0) {
                return <p className="text-center text-slate-400 py-6">No documents available.</p>;
            }
            return (
                <dl className="mt-4 divide-y divide-slate-700">
                    {availableDocs.map(detail => (
                        <InfoRow
                            key={detail.name}
                            label={detail.name}
                            value={<DetailLink href={detail.link!}>View Document</DetailLink>}
                        />
                    ))}
                </dl>
            );
        }

        if (activeTab === 'Technology Stack') {
            if (Object.keys(techStackGrouped).length === 0) {
                return <p className="text-center text-slate-400 py-6">No technology stack specified in tasks.</p>;
            }
            return (
                <div className="mt-2 -mx-2 space-y-1">
                    {Object.keys(techStackGrouped).sort((a, b) => a.localeCompare(b)).map(groupName => {
                        const resources = techStackGrouped[groupName];
                        const isExpanded = expandedTechGroups.includes(groupName);
                        return (
                            <div key={groupName} className="border-b border-slate-700 last:border-b-0">
                                <button
                                    type="button"
                                    onClick={() => toggleTechGroup(groupName)}
                                    className="w-full flex justify-between items-center py-3 px-2 text-left text-sm font-medium text-slate-200 hover:bg-slate-700/50 rounded-md transition-colors"
                                    aria-expanded={isExpanded ? "true" : "false"}
                                >
                                    <span>{groupName} <span className="text-slate-400">({resources.length})</span></span>
                                    <svg className={`h-5 w-5 transform transition-transform text-slate-400 ${isExpanded ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                                {isExpanded && (
                                    <ul className="pb-2 px-2 divide-y divide-slate-700/50">
                                        {resources.map(resource => {
                                            const isClickable = resource.resourceJson || resource.resourceLink;
                                            return (
                                                <li key={resource.id}>
                                                    <button
                                                        onClick={() => handleResourceClick(resource)}
                                                        disabled={!isClickable}
                                                        className={`w-full text-left py-3 px-2 rounded-md flex justify-between items-center group transition-colors ${isClickable ? 'cursor-pointer hover:bg-slate-700/50' : 'cursor-default'}`}
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-sm font-medium truncate ${isClickable ? 'text-slate-200 group-hover:text-cyan-400' : 'text-slate-400'}`}>{resource.name}</p>
                                                            {resource.description && <p className="text-xs text-slate-500 truncate mt-1">{resource.description}</p>}
                                                        </div>
                                                        {resource.resourceJson ? (
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2 flex-shrink-0 text-slate-500 group-hover:text-cyan-400" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010-1.414l3-3a1 1 0 011.414 1.414L7.414 6l2.707 2.707a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414zm8.586 8.586a1 1 0 01-1.414 0l-3 3a1 1 0 11-1.414-1.414L12.586 14l-2.707-2.707a1 1 0 011.414-1.414l3 3a1 1 0 010 1.414z" clipRule="evenodd" />
                                                            </svg>
                                                        ) : resource.resourceLink ? (
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2 flex-shrink-0 text-slate-500 group-hover:text-cyan-400" viewBox="0 0 20 20" fill="currentColor">
                                                                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                                                                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                                                            </svg>
                                                        ) : null}
                                                    </button>
                                                </li>
                                            )
                                        })}
                                    </ul>
                                )}
                            </div>
                        )
                    })}
                </div>
            );
        }
        return null;
    };

    return (
        <>
            <div className="p-6 h-full flex flex-col">
                <div className="flex-shrink-0">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-white">{project.ai_name}</h1>
                            <p className="mt-1 text-slate-400 min-h-[3rem] line-clamp-2">{project.crdfd_description}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {isAuthenticated && (
                                <button
                                    onClick={() => setIsGenerateDocsModalOpen(true)}
                                    className="px-3 py-2 text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-md transition-colors flex items-center gap-2"
                                    aria-label="Generate project documentation"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M9 2a1 1 0 00-1 1v8a1 1 0 00.553.894l2 1A1 1 0 0012 11V3a1 1 0 00-1-1H9z" />
                                        <path d="M3 4a1 1 0 011-1h4a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h4a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h4a1 1 0 110 2H4a1 1 0 01-1-1z" />
                                        <path fillRule="evenodd" d="M13.878 13.122a1 1 0 00-1.414 0l-2.03 2.03a1 1 0 000 1.414l2.03 2.03a1 1 0 001.414-1.414L13.414 16l1.464-1.464a1 1 0 000-1.414z" clipRule="evenodd" />
                                    </svg>
                                    Generate Docs
                                </button>
                            )}
                            {isAuthenticated && (
                                <button
                                    onClick={() => setIsEditProjectModalOpen(true)}
                                    className="px-3 py-2 text-sm font-semibold bg-slate-600 hover:bg-slate-500 text-white rounded-md transition-colors flex items-center gap-2"
                                    aria-label="Edit project details"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                                        <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                                    </svg>
                                    Edit Project
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* NEW COMPACT LAYOUT: Top info bar + Main content area */}
                <div className="mt-4 flex flex-col flex-1 min-h-0 gap-4">
                    {/* Top Row: Basic Info + Progress - Fixed height, compact */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 shrink-0">
                        {/* Basic Info - Left side, 60% */}
                        <Card className="lg:col-span-3">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-base font-semibold text-white">Basic Information</h3>
                                <a
                                    href="https://wecare-ii.crm5.dynamics.com/main.aspx?appid=b7cc6e53-a6a9-f011-bbd2-000d3aa05f62&pagetype=entitylist&etn=ai_process&viewid=10483d4a-1566-4ca7-a6a3-a28a8b57b35e&viewType=1039"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="View all projects in Dataverse"
                                    className="p-1 text-slate-400 hover:text-white transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                                        <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                                    </svg>
                                </a>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                                <div>
                                    <span className="text-slate-500">Requester</span>
                                    <p className="text-slate-200 font-medium truncate">{project.requester || 'N/A'}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">Department</span>
                                    <p className="text-slate-200 font-medium truncate">{project.department || 'N/A'}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">Start Date</span>
                                    <p className="text-slate-200 font-medium">{project['crdfd_start_date@OData.Community.Display.V1.FormattedValue'] || 'N/A'}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">Priority</span>
                                    <p><PriorityDisplay priority={project.crdfd_priority} /></p>
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <span className="text-slate-500">IT Staff</span>
                                    <p className="text-slate-200 font-medium truncate" title={project.itStaff?.join(', ')}>{project.itStaff?.join(', ') || 'N/A'}</p>
                                </div>
                                <div className="md:col-span-1">
                                    <span className="text-slate-500">Group Chat</span>
                                    <p className="text-slate-200 font-medium truncate">{project.crdfd_groupchat || 'N/A'}</p>
                                </div>
                            </div>
                        </Card>

                        {/* Progress - Right side, 40% */}
                        <Card className="lg:col-span-2">
                            <div className="flex items-center justify-between gap-4 mb-3">
                                <h3 className="text-base font-semibold text-white shrink-0">Progress</h3>
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="flex-1 bg-slate-700 rounded-full h-2">
                                        <div className="bg-cyan-500 h-2 rounded-full transition-all duration-500 ease-out" style={{ width: `${progressPercentage}%` }}></div>
                                    </div>
                                    <span className="text-sm font-bold text-cyan-400 shrink-0">{progressPercentage.toFixed(0)}%</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                <div>
                                    <span className="text-slate-500">Current Step:</span>
                                    <p className="text-slate-200 font-medium truncate" title={currentStep}>{currentStep}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">Next Step:</span>
                                    <p className="text-slate-200 font-medium truncate" title={nextStep}>{nextStep}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">Blockers:</span>
                                    <p className={`font-medium truncate ${blockers !== 'None' ? 'text-yellow-400' : 'text-slate-200'}`} title={blockers}>{blockers}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">Estimated Completion:</span>
                                    <p className="text-slate-200 font-medium">{project['crdfd_end_date@OData.Community.Display.V1.FormattedValue'] || 'N/A'}</p>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Main Content Row: Tasks + Technical Details - 60:40 */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 flex-1 min-h-0">
                        {/* Tasks - 60% */}
                        <Card className="lg:col-span-3 flex flex-col min-h-0">
                            <div className="flex justify-between items-center flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-semibold text-white">Tasks</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isAuthenticated && (
                                        <button
                                            onClick={() => setIsAddTaskModalOpen(true)}
                                            className="px-3 py-1 text-sm font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-md transition-colors flex items-center gap-2"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                            </svg>
                                            Add Task
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setIsTaskOverviewModalOpen(true)}
                                        className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                                        title="Expand View"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                        </svg>
                                    </button>
                                    <a
                                        href="https://wecare-ii.crm5.dynamics.com/main.aspx?appid=b7cc6e53-a6a9-f011-bbd2-000d3aa05f62&pagetype=entitylist&etn=crdfd_tech_tasks&viewid=56cfbfe4-89b0-f011-bbd3-000d3aa25236&viewType=1039"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="View all tasks in Dataverse"
                                        className="p-1 text-slate-400 hover:text-white transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                                            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                                        </svg>
                                    </a>
                                </div>
                            </div>
                            <div className="mt-4 flex-1 min-h-0">
                                {isTasksLoading ? (
                                    <div className="h-full flex items-center justify-center">
                                        <LoadingSpinner message="Đang tải công việc..." />
                                    </div>
                                ) : tasksError ? (
                                    <div className="py-4">
                                        <ErrorMessage message={tasksError} />
                                    </div>
                                ) : (
                                    <TaskList
                                        tasks={tasks}
                                        onUpdateTask={handleUpdateTask}
                                        accessToken={accessToken}
                                        productMembers={productMembers}
                                        isAuthenticated={isAuthenticated}
                                        loggedInUserId={loggedInUserId}
                                        onResourceClick={handleResourceClick}
                                    />
                                )}
                            </div>
                        </Card>

                        {/* Technical Details - 40% */}
                        <Card className="lg:col-span-2 flex flex-col min-h-0">
                            <div className="flex justify-between items-center flex-shrink-0">
                                <h3 className="text-lg font-semibold text-white">Technical Details</h3>
                                <a
                                    href="https://wecare-ii.crm5.dynamics.com/main.aspx?appid=b7cc6e53-a6a9-f011-bbd2-000d3aa05f62&pagetype=entitylist&etn=crdfd_tech_resource&viewid=0cbdda58-c369-4227-9e20-20d81980ed29&viewType=1039"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="View all technical resources in Dataverse"
                                    className="p-1 text-slate-400 hover:text-white transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                                        <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                                    </svg>
                                </a>
                            </div>
                            <div className="mt-4 flex-1 min-h-0 overflow-y-auto pr-2">
                                <Tabs
                                    tabs={['Documents', 'Technology Stack']}
                                    activeTab={activeTab}
                                    onTabClick={setActiveTab}
                                />
                                {renderTechDetailsContent()}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
            {isAuthenticated && isAddTaskModalOpen && (
                <AddTaskModal
                    onClose={() => setIsAddTaskModalOpen(false)}
                    onSave={handleAddTask}
                    productMembers={productMembers}
                    accessToken={accessToken}
                />
            )}
            {isAuthenticated && isEditProjectModalOpen && (
                <EditProjectModal
                    project={project}
                    onClose={() => setIsEditProjectModalOpen(false)}
                    onSave={handleUpdateProject}
                />
            )}
            {isAuthenticated && isGenerateDocsModalOpen && (
                <GenerateDocsModal
                    project={project}
                    tasks={tasks}
                    onClose={() => setIsGenerateDocsModalOpen(false)}
                />
            )}
            {selectedResource && (
                <TechResourceModal
                    resource={selectedResource}
                    onClose={() => setSelectedResource(null)}
                />
            )}
            {webviewUrl && (
                <WebviewModal
                    url={webviewUrl}
                    onClose={() => setWebviewUrl(null)}
                />
            )}
            {isTaskOverviewModalOpen && (
                <TaskOverviewModal
                    tasks={tasks}
                    onClose={() => setIsTaskOverviewModalOpen(false)}
                    onUpdateTask={handleUpdateTask}
                    accessToken={accessToken}
                    productMembers={productMembers}
                    isAuthenticated={isAuthenticated}
                    loggedInUserId={loggedInUserId}
                    projectName={project.ai_name}
                />
            )}
        </>
    );
};

export default ProjectDetail;