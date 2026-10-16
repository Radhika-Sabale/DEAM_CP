/**
 * @file AppShell.tsx
 * Master responsive application shell providing accessible header, inline project title editing,
 * project management modals (New, Switch, Import, Export, Delete), collapsible navigation drawer,
 * and skip links.
 */

import {
  type FC,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { MODULE_REGISTRY } from '../../modules/registry';
import { exportProjectToJson, importProject } from '../../store/projectIO';
import { isStorageAvailable } from '../../store/persistence';
import {
  selectCurrentProject,
  selectIsDirty,
  selectProjectSummaries,
  useProjectStore,
} from '../../store/projectStore';
import {
  selectCurrentModule,
  selectSidebarOpen,
  useUiStore,
} from '../../store/uiStore';
import { Button } from '../ui/Button';
import {
  CloseIcon,
  DownloadIcon,
  EditIcon,
  FolderOpenIcon,
  MenuIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
} from '../ui/Icons';
import { Modal } from '../ui/Modal';
import { ToastContainer } from '../ui/Toast';
import { ExamplesMenu } from './ExamplesMenu';
import { PipelineStepper } from './PipelineStepper';
import { ThemeToggle } from './ThemeToggle';

export interface AppShellProps {
  children: ReactNode;
}

export const AppShell: FC<AppShellProps> = ({ children }) => {
  const currentModule = useUiStore(selectCurrentModule);
  const setModule = useUiStore((state) => state.setModule);
  const sidebarOpen = useUiStore(selectSidebarOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const pushToast = useUiStore((state) => state.pushToast);

  const project = useProjectStore(selectCurrentProject);
  const summaries = useProjectStore(selectProjectSummaries);
  const isDirty = useProjectStore(selectIsDirty);
  const renameProject = useProjectStore((state) => state.renameProject);
  const createProject = useProjectStore((state) => state.createProject);
  const loadProject = useProjectStore((state) => state.loadProject);
  const deleteProject = useProjectStore((state) => state.deleteProject);
  const setProject = useProjectStore((state) => state.setProject);

  // Inline rename state
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(project.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Modals
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [switchModalOpen, setSwitchModalOpen] = useState(false);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [examplesModalOpen, setExamplesModalOpen] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState(false);

  useEffect(() => {
    if (!isStorageAvailable()) {
      setStorageBlocked(true);
    }
  }, []);

  useEffect(() => {
    setTempName(project.name);
  }, [project.name]);

  useEffect(() => {
    if (isEditingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [isEditingName]);

  const commitNameEdit = (): void => {
    if (tempName.trim()) {
      renameProject(tempName.trim());
    } else {
      setTempName(project.name);
    }
    setIsEditingName(false);
  };

  const handleExportJson = (): void => {
    const jsonString = exportProjectToJson(project);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.toLowerCase().replace(/\s+/g, '-')}-${project.id}.json`;
    a.click();
    URL.revokeObjectURL(url);

    pushToast({
      level: 'success',
      title: 'Project Exported',
      message: 'DesignProject exported to JSON file.',
    });
    setProjectMenuOpen(false);
  };

  const handleImportSubmit = (): void => {
    if (!importJsonText.trim()) return;
    const existingIds = summaries.map((s) => s.id);
    const result = importProject(importJsonText, existingIds);

    if (result.ok) {
      setProject(result.value);
      setImportModalOpen(false);
      setImportJsonText('');
      setProjectMenuOpen(false);
      pushToast({
        level: 'success',
        title: 'Project Imported',
        message: `Imported project "${result.value.name}" successfully.`,
      });
    } else {
      const errorMsg =
        result.error.fieldErrors && result.error.fieldErrors.length > 0
          ? `${result.error.message} Offending field: ${result.error.fieldErrors[0]?.field}`
          : result.error.message;

      pushToast({
        level: 'error',
        title: 'Import Failed',
        message: errorMsg,
      });
    }
  };

  const renderNavModule = (mod: (typeof MODULE_REGISTRY)[number]) => {
    if (mod.isAvailable) {
      const isActive = currentModule === mod.id;
      return (
        <li key={mod.id}>
          <button
            type="button"
            onClick={() => {
              setModule(mod.id);
              if (window.innerWidth < 768) {
                setSidebarOpen(false);
              }
            }}
            aria-current={isActive ? 'page' : undefined}
            className={`flex w-full flex-col rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
              isActive
                ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            <span className="text-sm">{mod.title}</span>
          </button>
        </li>
      );
    }

    return (
      <li key={mod.id}>
        <div
          aria-disabled="true"
          className="flex w-full flex-col rounded-lg px-3 py-2 text-left opacity-60 cursor-not-allowed"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {mod.title}
            </span>
            <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              Coming soon
            </span>
          </div>
        </div>
      </li>
    );
  };

  const navigationGroups = [
    { title: 'Foundations', ids: ['number-systems', 'boolean-tool'] },
    { title: 'Combinational design', ids: ['kmap-solver', 'circuit-simulator'] },
    { title: 'Sequential design', ids: ['flipflop-simulator', 'sequential-designer'] },
    { title: 'Practice and research', ids: ['practice', 'quiz', 'prepost-test', 'sus-survey', 'teacher-dashboard'] },
    { title: 'Processor systems', ids: ['alu', '8086-cpu', 'interrupt-controller'] },
  ];
  const knownModuleIds = navigationGroups.flatMap((group) => group.ids);
  const otherModules = MODULE_REGISTRY.filter((mod) => !knownModuleIds.includes(mod.id));
  if (otherModules.length) navigationGroups.push({ title: 'Other', ids: otherModules.map((mod) => mod.id) });

  return (
    <div className="app-shell flex min-h-screen flex-col">
      {/* Accessible Skip Link */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>

      {/* Global Notifications */}
      <ToastContainer />

      {/* Storage Unavailable / Blocked Banner */}
      {storageBlocked && (
        <div
          role="alert"
          aria-live="polite"
          className="bg-amber-100 border-b border-amber-300 text-amber-900 px-4 py-2 text-xs font-semibold text-center flex items-center justify-center gap-2"
        >
          <span>
            Storage is disabled or blocked. Running in in-memory session mode. Changes will not persist across reloads.
          </span>
        </div>
      )}

      {/* Top Application Header */}
      <header className="app-header sticky top-0 z-30 flex h-[66px] items-center justify-between border-b border-gray-200 bg-white/80 px-3 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/80 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? 'Collapse navigation menu' : 'Expand navigation menu'}
            className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-blue-600 shrink-0"
          >
            <MenuIcon className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <span aria-hidden="true" className="brand-mark hidden shrink-0 sm:inline-block" />
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-blue-600 dark:text-blue-400 sm:text-lg truncate">
              Digital Electronics Virtual Lab
            </h1>

            <span className="hidden text-gray-300 dark:text-gray-700 sm:inline">|</span>

            {/* Inline Project Rename */}
            <div className="hidden sm:flex items-center gap-1.5">
              {isEditingName ? (
                <input
                  ref={nameInputRef}
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onBlur={commitNameEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitNameEdit();
                    if (e.key === 'Escape') {
                      setTempName(project.name);
                      setIsEditingName(false);
                    }
                  }}
                  className="rounded border border-blue-500 bg-white px-2 py-0.5 text-xs font-semibold text-gray-900 focus:outline-none dark:bg-gray-800 dark:text-gray-100"
                  aria-label="Edit project name"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingName(true)}
                  title="Click to rename project"
                  className="group flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  <span className="max-w-[140px] truncate sm:max-w-xs">{project.name}</span>
                  <EditIcon className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  {isDirty && (
                    <span
                      title="Unsaved changes pending autosave"
                      className="ml-1 text-[11px] font-bold text-amber-600 dark:text-amber-400"
                    >
                      *
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {/* Project Actions Dropdown Menu */}
          <div className="relative">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setProjectMenuOpen(!projectMenuOpen)}
              aria-expanded={projectMenuOpen}
              aria-haspopup="menu"
            >
              Project Menu
            </Button>

            {projectMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 z-40 mt-1.5 w-48 rounded-lg border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-800 dark:bg-gray-900"
              >
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setProjectMenuOpen(false);
                    setNewProjectName('');
                    setNewModalOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span>New Project</span>
                </button>

                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setProjectMenuOpen(false);
                    setSwitchModalOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <FolderOpenIcon className="h-4 w-4" />
                  <span>Open / Switch...</span>
                </button>

                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setProjectMenuOpen(false);
                    setExamplesModalOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <FolderOpenIcon className="h-4 w-4" />
                  <span>Open Example...</span>
                </button>

                <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

                <button
                  role="menuitem"
                  type="button"
                  onClick={handleExportJson}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <DownloadIcon className="h-4 w-4" />
                  <span>Export JSON</span>
                </button>

                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setProjectMenuOpen(false);
                    setImportJsonText('');
                    setImportModalOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <UploadIcon className="h-4 w-4" />
                  <span>Import JSON...</span>
                </button>

                <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setProjectMenuOpen(false);
                    setDeleteConfirmOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  <TrashIcon className="h-4 w-4" />
                  <span>Delete Project</span>
                </button>
              </div>
            )}
          </div>

          <ThemeToggle />
        </div>
      </header>

      {/* Main Body with Sidebar Drawer */}
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile Backdrop */}
        {sidebarOpen && (
          <div
            role="presentation"
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-xs md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Collapsible Sidebar */}
        <aside
          aria-label="Module Navigation"
          className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-gray-200 bg-white transition-transform duration-200 dark:border-gray-800 dark:bg-gray-900 md:static md:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full md:-ml-72'
          }`}
        >
          <div className="flex h-14 items-center justify-between border-b border-gray-100 px-4 dark:border-gray-800 md:hidden">
            <span className="font-bold text-sm">Navigation</span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Close sidebar"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-5">
            {navigationGroups.map((group) => (
              <div key={group.title}>
                <div className="mb-2 px-2 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {group.title}
                </div>
                <ul className="space-y-1">
                  {MODULE_REGISTRY.filter((mod) => group.ids.includes(mod.id)).map(renderNavModule)}
                </ul>
              </div>
            ))}
          </nav>

        </aside>

        {/* Main Content Area */}
        <main
          id="main"
          className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-8 focus:outline-none"
        >
          <div className="mx-auto max-w-6xl min-w-0">
            <PipelineStepper />
            {children}
          </div>
        </main>
      </div>

      {/* Modals */}
      {/* 1. New Project Modal */}
      <Modal
        isOpen={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        title="Create New Project"
      >
        <div className="space-y-4">
          <label className="block text-xs font-semibold uppercase text-gray-500">
            Project Name
            <input
              type="text"
              value={newProjectName}
              placeholder="e.g. 4-bit Binary Adder"
              onChange={(e) => setNewProjectName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setNewModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                createProject(newProjectName.trim() || 'Untitled Project');
                setNewModalOpen(false);
                pushToast({
                  level: 'success',
                  message: 'New design project created.',
                });
              }}
            >
              Create
            </Button>
          </div>
        </div>
      </Modal>

      {/* 2. Switch Project Modal */}
      <Modal
        isOpen={switchModalOpen}
        onClose={() => setSwitchModalOpen(false)}
        title="Open Project"
      >
        <div className="space-y-3">
          {summaries.length === 0 ? (
            <p className="text-sm italic text-gray-500">No saved projects found.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800 max-h-60 overflow-y-auto">
              {summaries.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between py-2.5 px-2 hover:bg-gray-50 rounded dark:hover:bg-gray-800/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {s.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      Updated: {new Date(s.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={project.id === s.id ? 'primary' : 'secondary'}
                    onClick={() => {
                      loadProject(s.id);
                      setSwitchModalOpen(false);
                      pushToast({
                        level: 'info',
                        message: `Switched to project "${s.name}".`,
                      });
                    }}
                  >
                    {project.id === s.id ? 'Active' : 'Open'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end pt-2">
            <Button variant="ghost" onClick={() => setSwitchModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* 3. Import JSON Modal */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Project JSON"
      >
        <div className="space-y-4">
          <label className="block text-xs font-semibold uppercase text-gray-500">
            Paste DesignProject JSON content:
            <textarea
              rows={6}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="Paste JSON envelope or raw DesignProject object here..."
              className="mt-1 block w-full font-mono text-xs rounded-md border border-gray-300 p-2 text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setImportModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!importJsonText.trim()}
              onClick={handleImportSubmit}
            >
              Validate & Import
            </Button>
          </div>
        </div>
      </Modal>

      {/* 4. Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Delete Project"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Are you sure you want to delete project{' '}
            <span className="font-bold text-gray-900 dark:text-gray-100">
              "{project.name}"
            </span>
            ? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                deleteProject(project.id);
                setDeleteConfirmOpen(false);
                pushToast({
                  level: 'info',
                  message: 'Project deleted.',
                });
              }}
            >
              Delete Permanently
            </Button>
          </div>
        </div>
      </Modal>

      {/* 5. Examples Modal */}
      <ExamplesMenu
        isOpen={examplesModalOpen}
        onClose={() => setExamplesModalOpen(false)}
      />
    </div>
  );
};
