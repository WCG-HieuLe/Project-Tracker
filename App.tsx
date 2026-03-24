import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ProjectList from './components/ProjectList';
import ErrorMessage from './components/ErrorMessage';
import LoadingSpinner from './components/LoadingSpinner';
import Dashboard from './components/Dashboard';
import ProjectDetail from './components/ProjectDetail';
import AddProjectModal from './components/AddProjectModal';
import WeeklyReportModal from './components/WeeklyReportModal';
import { getProjects, getProductMembers, createProject, createTask, getWeCareSystems, getTasksForProjects } from './services/dataverseService';
import { login, logout, getDataverseToken, getLoggedInUser, canEdit as checkCanEdit, clearMsalCache } from './services/authService';
import { cacheClearAll } from './services/apiCache';
import { useApiData } from './hooks/useApiData';
import { DEFAULT_TASKS } from './constants';
import type { Project, ProductMember, NewProjectPayload, NewTaskPayload, WeCareSystem, Task } from './types';

interface LoggedInUser {
  id: string;
  name: string;
  email?: string;
}

const GENERAL_DEP_ID = 191920006;
const DEFAULT_DEP_FILTER = GENERAL_DEP_ID;

/**
 * Helper: acquire Dataverse token, or clear stale MSAL cache and throw.
 * Centralizes token acquisition + stale-cache handling.
 */
async function acquireTokenOrClear(): Promise<string> {
  return getDataverseToken();
}

const App: React.FC = () => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [view, setView] = useState<'dashboard' | 'project'>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<LoggedInUser | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [msalReady, setMsalReady] = useState(false);
  const [tokenError, setTokenError] = useState(false);

  const [departmentFilter, setDepartmentFilter] = useState<number | number[] | null | undefined>(DEFAULT_DEP_FILTER);

  const isAuthenticated = loggedInUser !== null && !tokenError;
  const isEditor = isAuthenticated && checkCanEdit();

  // Compute dep key for cache invalidation
  const depKey = useMemo(() => {
    if (departmentFilter === null) return 'all';
    if (departmentFilter === undefined) return 'default';
    if (Array.isArray(departmentFilter)) return departmentFilter.sort().join('_');
    return String(departmentFilter);
  }, [departmentFilter]);

  const depToFetch = useMemo(() => {
    if (departmentFilter === null) return undefined;
    if (departmentFilter !== undefined) return departmentFilter;
    return undefined;
  }, [departmentFilter]);

  // MSAL init — check if user is already authenticated
  useEffect(() => {
    setMsalReady(true);
    const user = getLoggedInUser();
    if (user) {
      setLoggedInUser(user);
    }
  }, []);

  // ─── useApiData hooks — stale-while-revalidate ────────────────

  // Token fetcher (shared by all hooks)
  const getToken = useCallback(async (): Promise<string> => {
    try {
      const token = await acquireTokenOrClear();
      setAccessToken(token);
      setTokenError(false);
      return token;
    } catch (err) {
      console.warn('⚠️ Token stale/expired, clearing MSAL cache...', err);
      clearMsalCache();
      setLoggedInUser(null);
      setAccessToken(null);
      setTokenError(true);
      throw err;
    }
  }, []);

  // 1. Projects — primary data, cache 10 min
  const projectsFetcher = useCallback(async () => {
    const token = await getToken();
    return getProjects(token, depToFetch);
  }, [getToken, depToFetch]);

  const {
    data: projects,
    loading: projectsLoading,
    error: projectsError,
    refresh: refreshProjects,
  } = useApiData<Project[]>({
    key: `projects_${depKey}`,
    fetcher: projectsFetcher,
    enabled: msalReady && !!loggedInUser && !tokenError,
    initialData: [],
  });

  // 2. Product Members — cache 30 min (rarely changes)
  const membersFetcher = useCallback(async () => {
    const token = await getToken();
    return getProductMembers(token);
  }, [getToken]);

  const { data: productMembers } = useApiData<ProductMember[]>({
    key: 'product_members',
    fetcher: membersFetcher,
    ttl: 30 * 60 * 1000,
    enabled: msalReady && !!loggedInUser && !tokenError,
    initialData: [],
  });

  // 3. WeCare Systems — cache 30 min (rarely changes)
  const systemsFetcher = useCallback(async () => {
    const token = await getToken();
    return getWeCareSystems(token);
  }, [getToken]);

  const { data: weCareSystems } = useApiData<WeCareSystem[]>({
    key: 'wecare_systems',
    fetcher: systemsFetcher,
    ttl: 30 * 60 * 1000,
    enabled: msalReady && !!loggedInUser && !tokenError,
    initialData: [],
  });

  // 4. Tasks — lazy, only fetch AFTER projects loaded
  const projectIds = useMemo(
    () => projects.map(p => p.ai_processid),
    [projects]
  );

  const tasksFetcher = useCallback(async () => {
    const token = await getToken();
    return projectIds.length > 0 ? getTasksForProjects(projectIds, token) : [];
  }, [getToken, projectIds]);

  const {
    data: allTasks,
    loading: tasksLoading,
  } = useApiData<Task[]>({
    key: `tasks_${depKey}`,
    fetcher: tasksFetcher,
    enabled: msalReady && !!loggedInUser && !tokenError && projects.length > 0,
    initialData: [],
  });

  // ─── Refresh all data (used after creating project) ───────────
  const refreshAllData = useCallback(() => {
    refreshProjects();
    // Tasks will auto-refresh when projects change (different projectIds → different cache key)
  }, [refreshProjects]);

  // ─── Handlers ──────────────────────────────────────────────────

  const handleLogin = async () => {
    try {
      await login();
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  const handleLogout = async () => {
    try {
      cacheClearAll();
      await logout();
    } catch {
      setLoggedInUser(null);
      setAccessToken(null);
      setDepartmentFilter(DEFAULT_DEP_FILTER);
    }
  };

  const handleSelectView = (newView: 'dashboard' | 'project', projectId?: string) => {
    setView(newView);
    if (newView === 'project' && projectId) {
      setSelectedProjectId(projectId);
    } else if (newView === 'dashboard') {
      setSelectedProjectId(null);
    }
    setIsSidebarOpen(false);
  };

  const handleAddProject = async (projectData: NewProjectPayload) => {
    if (!accessToken) {
      throw new Error("Authentication token is not available.");
    }

    try {
      const newProject = await createProject(projectData, accessToken);
      const newProjectId = newProject.ai_processid;

      const taskCreationPromises = DEFAULT_TASKS.map(task => {
        const taskPayload: NewTaskPayload = {
          name: task.name,
          description: task.description,
          projectId: newProjectId,
          status: 'To Do',
          priority: 'Medium'
        };
        return createTask(taskPayload, accessToken);
      });
      await Promise.all(taskCreationPromises);

      setIsAddProjectModalOpen(false);
      refreshAllData();
      handleSelectView('project', newProjectId);

    } catch (err) {
      console.error("Failed to create project with default tasks:", err);
      throw err;
    }
  };

  const selectedProject = projects.find(p => p.ai_processid === selectedProjectId) || null;

  const renderMainContent = () => {
    if (!msalReady) {
      return (
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner message="Initializing..." />
        </div>
      );
    }

    if (!isAuthenticated) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <div className="text-6xl">🔒</div>
            <h2 className="text-2xl font-bold text-white">Project Tracker</h2>
            <p className="text-slate-400">Đăng nhập bằng tài khoản Microsoft để tiếp tục</p>
            <button
              onClick={handleLogin}
              className="px-6 py-3 rounded-lg text-sm font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors flex items-center gap-2 mx-auto"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 23 23" fill="currentColor">
                <path d="M0 0h11v11H0zM12 0h11v11H12zM0 12h11v11H0zM12 12h11v11H12z"/>
              </svg>
              Đăng nhập với Microsoft
            </button>
          </div>
        </div>
      );
    }

    if (projectsLoading && projects.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner message="Đang tải dữ liệu..." />
        </div>
      );
    }

    if (projectsError) {
      return (
        <div className="p-6">
          <ErrorMessage message={projectsError} />
        </div>
      );
    }

    if (view === 'project') {
      if (selectedProject && accessToken) {
        return <ProjectDetail
          key={selectedProject.ai_processid}
          project={selectedProject}
          accessToken={accessToken}
          productMembers={productMembers}
          onProjectUpdate={refreshAllData}
          isAuthenticated={isAuthenticated}
          canEdit={isEditor}
        />;
      }
    }

    return <Dashboard
      projects={projects}
      allTasks={allTasks}
      onSelectProject={(projectId) => handleSelectView('project', projectId)}
      isLoading={projectsLoading}
      isTasksLoading={tasksLoading}
      loggedInUser={loggedInUser}
      onGenerateReport={() => setIsReportModalOpen(true)}
      selectedDepartment={departmentFilter}
      onDepartmentChange={setDepartmentFilter}
    />;
  };

  return (
    <>
      <div className="min-h-screen font-sans text-slate-300 lg:grid lg:grid-cols-[296px_1fr]">
        {isSidebarOpen && (
          <div className="lg:hidden">
            <div
              className="fixed inset-0 bg-black/60 z-30"
              onClick={() => setIsSidebarOpen(false)}
              aria-hidden="true"
            ></div>
            <aside className="fixed inset-y-0 left-0 z-40 w-72 bg-slate-900 p-4">
              <ProjectList
                projects={projects}
                currentView={view}
                selectedProjectId={selectedProjectId}
                onSelectView={handleSelectView}
                isLoading={projectsLoading && projects.length === 0}
                isAuthenticated={isAuthenticated}
                canEdit={isEditor}
                onAddProject={() => {
                  setIsSidebarOpen(false);
                  setIsAddProjectModalOpen(true);
                }}
                onLoginRequest={handleLogin}
                onLogout={handleLogout}
              />
            </aside>
          </div>
        )}

        <aside className="h-screen sticky top-0 bg-slate-900 pt-4 pb-4 pl-4 hidden lg:block">
          <ProjectList
            projects={projects}
            currentView={view}
            selectedProjectId={selectedProjectId}
            onSelectView={handleSelectView}
            isLoading={projectsLoading && projects.length === 0}
            isAuthenticated={isAuthenticated}
            canEdit={isEditor}
            onAddProject={() => setIsAddProjectModalOpen(true)}
            onLoginRequest={handleLogin}
            onLogout={handleLogout}
          />
        </aside>

        <main className="h-screen overflow-y-auto bg-slate-900">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-4 p-4 bg-slate-900/80 backdrop-blur-sm border-b border-slate-700 lg:hidden">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-1 text-slate-400 hover:text-white"
              aria-label="Mở menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold text-white truncate">
              {view === 'dashboard' ? 'Dashboard' : (selectedProject?.ai_name || 'Chi tiết dự án')}
            </h2>
            <div className="w-6" />
          </header>
          {renderMainContent()}
        </main>
      </div>
      {isEditor && isAddProjectModalOpen && (
        <AddProjectModal
          onClose={() => setIsAddProjectModalOpen(false)}
          onSave={handleAddProject}
          weCareSystems={weCareSystems}
        />
      )}
      {isAuthenticated && isReportModalOpen && accessToken && (
        <WeeklyReportModal
          onClose={() => setIsReportModalOpen(false)}
          productMembers={productMembers}
          accessToken={accessToken}
          loggedInUser={loggedInUser}
        />
      )}
    </>
  );
};

export default App;