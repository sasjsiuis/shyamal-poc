import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Clock,
  Copy,
  Edit3,
  FolderOpen,
  Image as ImageIcon,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import { useToast } from '../components/Toast';
import { ALL_TEMPLATES, PSD_GREEN_TEMPLATE } from '../data/templates';
import type { SavedProject } from '../types/project';
import {
  MAX_SAVED_PROJECTS,
  deleteProject,
  duplicateProject,
  formatBengaliRelativeTime,
  listProjects,
  renameProject,
  toBengaliDigits,
} from '../utils/projectStorage';

export const MyWorkPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [renamingProject, setRenamingProject] = useState<SavedProject | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const [deletingProject, setDeletingProject] = useState<SavedProject | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listProjects();
      setProjects(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [openMenuId]);

  const templateNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const tpl of ALL_TEMPLATES) {
      map.set(tpl.id, tpl.name);
    }
    return map;
  }, []);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = projects.filter((p) => {
      if (!q) return true;
      const tplName = (templateNameMap.get(p.templateId) || PSD_GREEN_TEMPLATE.name).toLowerCase();
      return p.name.toLowerCase().includes(q) || tplName.includes(q);
    });
    if (sortOrder === 'oldest') {
      return [...list].sort((a, b) => a.updatedAt - b.updatedAt);
    }
    return list;
  }, [projects, searchQuery, sortOrder, templateNameMap]);

  const handleDuplicate = async (project: SavedProject) => {
    setOpenMenuId(null);
    const { project: copy, limitReached } = await duplicateProject(project.id);
    if (limitReached) {
      showToast(
        'সর্বোচ্চ ৫০টি প্রজেক্ট পূর্ণ হয়েছে — নতুন কাজের জন্য পুরনো কাজ মুছে দিন',
        'warning',
        4000
      );
      return;
    }
    if (copy) {
      showToast('কাজটি ডুপ্লিকেট হয়েছে ✓', 'success');
      await loadAll();
    }
  };

  const handleConfirmRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingProject) return;
    const trimmed = renameDraft.trim();
    if (!trimmed) return;
    const ok = await renameProject(renamingProject.id, trimmed);
    if (ok) {
      showToast('নাম পরিবর্তন হয়েছে ✓', 'success');
      setRenamingProject(null);
      await loadAll();
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingProject) return;
    await deleteProject(deletingProject.id);
    setDeletingProject(null);
    showToast('কাজটি মুছে ফেলা হয়েছে', 'info');
    await loadAll();
  };

  const isFull = projects.length >= MAX_SAVED_PROJECTS;
  const pct = Math.min(100, Math.round((projects.length / MAX_SAVED_PROJECTS) * 100));

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8FA] text-[#0F172A] dark:bg-[#0B0F19] dark:text-slate-100">
      <Navbar />

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-8 sm:px-6">
        {/* Page Header + Controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-[#0F172A] sm:text-[32px] dark:text-white">
              আমার কাজ
            </h1>
            <p className="mt-1 text-[14px] text-[#64748B] dark:text-slate-400">
              আপনার সেভ করা সব কার্ড — যেকোনোটা খুলে আবার এডিট করুন
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-0 flex-1 sm:w-[230px] sm:flex-initial">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="নাম দিয়ে খুঁজুন..."
                aria-label="প্রজেক্ট খুঁজুন"
                className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white pl-9 pr-8 text-[13.5px] text-[#0F172A] placeholder:text-[#64748B] focus:border-[#4F46E5] focus:outline-none dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="খোঁজা মুছুন"
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-[#64748B]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSortOrder((s) => (s === 'newest' ? 'oldest' : 'newest'))}
              className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-[13.5px] font-medium text-[#0F172A] hover:bg-slate-50 whitespace-nowrap dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-100 dark:hover:bg-gray-800"
            >
              <span>{sortOrder === 'newest' ? 'নতুন আগে' : 'পুরনো আগে'}</span>
            </button>

            <Link
              to="/templates"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#4F46E5] px-4 text-[13.5px] font-semibold text-white shadow-xs transition-colors hover:bg-[#4338CA] whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>নতুন কার্ড</span>
            </Link>
          </div>
        </div>

        {/* Storage Quota Strip */}
        <div
          className={`mt-5 flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
            isFull
              ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
              : 'border-[#E5E7EB] bg-white dark:border-[#1F2937] dark:bg-[#111827]'
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                isFull
                  ? 'bg-amber-100 text-[#F59E0B] dark:bg-amber-900/50'
                  : 'bg-[#EEF2FF] text-[#4F46E5] dark:bg-indigo-950/60 dark:text-indigo-400'
              }`}
            >
              {isFull ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <FolderOpen className="h-4 w-4" />
              )}
            </span>
            <p className="text-[13px] font-medium text-[#0F172A] dark:text-slate-200">
              {isFull ? (
                <span>
                  সর্বোচ্চ ৫০টি কাজের সীমা পূর্ণ হয়েছে — নতুন কার্ড সেভ করতে কিছু পুরনো কাজ মুছে দিন
                </span>
              ) : (
                <span>
                  <strong>{toBengaliDigits(projects.length)}টি কাজ সেভ আছে</strong> · সর্বোচ্চ ৫০টি
                  · এই ব্রাউজারে অটো সেভ হয়
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-200 dark:bg-gray-800">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isFull ? 'bg-[#F59E0B]' : 'bg-[#4F46E5]'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[12.5px] font-semibold text-[#64748B] tabular-nums dark:text-slate-400">
              {toBengaliDigits(projects.length)}/৫০
            </span>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-3 dark:border-[#1F2937] dark:bg-[#111827]"
              >
                <div className="aspect-square w-full animate-pulse rounded-lg bg-slate-200 dark:bg-gray-800" />
                <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-gray-800" />
                <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-gray-800" />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#E5E7EB] bg-white px-6 py-16 text-center dark:border-[#1F2937] dark:bg-[#111827]">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5] dark:bg-indigo-950/60 dark:text-indigo-400">
              <FolderOpen className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-[18px] font-bold text-[#0F172A] dark:text-slate-100">
              এখনো কোনো কাজ সেভ হয়নি
            </h2>
            <p className="mt-1 max-w-sm text-[14px] text-[#64748B] dark:text-slate-400">
              যেকোনো টেমপ্লেট থেকে এডিট শুরু করলেই তা স্বয়ংক্রিয়ভাবে এখানে সেভ হয়ে থাকবে।
            </p>
            <Link
              to="/templates"
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-[#4F46E5] px-5 text-[14px] font-semibold text-white hover:bg-[#4338CA]"
            >
              <LayoutGrid className="h-4 w-4" />
              <span>টেমপ্লেট দেখুন</span>
            </Link>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="mt-10 rounded-xl border border-[#E5E7EB] bg-white py-14 text-center text-sm text-[#64748B] dark:border-[#1F2937] dark:bg-[#111827] dark:text-slate-400">
            এই নামে কোনো সেভ করা কাজ পাওয়া যায়নি।
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredProjects.map((project) => {
              const tplName =
                templateNameMap.get(project.templateId) ||
                project.state.customTemplate?.name ||
                PSD_GREEN_TEMPLATE.name;

              return (
                <div
                  key={project.id}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all duration-150 hover:border-[#4F46E5]/50 hover:shadow-md dark:border-[#1F2937] dark:bg-[#111827]"
                >
                  {/* Card Preview Thumbnail */}
                  <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-gray-800">
                    <button
                      type="button"
                      onClick={() => navigate(`/editor/${project.templateId}/${project.id}`)}
                      className="block h-full w-full cursor-pointer text-left"
                    >
                      {project.thumbnail ? (
                        <img
                          src={project.thumbnail}
                          alt={project.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#64748B]">
                          <ImageIcon className="h-8 w-8" />
                        </div>
                      )}
                    </button>

                    {/* 3-dot Menu Button */}
                    <div className="absolute right-2.5 top-2.5 z-20">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId((cur) => (cur === project.id ? null : project.id));
                        }}
                        aria-label="প্রজেক্ট অপশন"
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[#E5E7EB] bg-white/95 text-[#0F172A] shadow-sm transition-colors hover:bg-white dark:border-[#1F2937] dark:bg-[#111827]/95 dark:text-slate-100"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>

                      {openMenuId === project.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 mt-1.5 w-44 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-xl dark:border-[#1F2937] dark:bg-[#111827]"
                        >
                          <button
                            type="button"
                            onClick={() => navigate(`/editor/${project.templateId}/${project.id}`)}
                            className="flex w-full cursor-pointer items-center gap-2 px-3.5 py-2 text-left text-[13px] font-medium text-[#0F172A] hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-gray-800"
                          >
                            <Pencil className="h-3.5 w-3.5 text-[#64748B]" />
                            <span>এডিট করুন</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicate(project)}
                            className="flex w-full cursor-pointer items-center gap-2 px-3.5 py-2 text-left text-[13px] font-medium text-[#0F172A] hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-gray-800"
                          >
                            <Copy className="h-3.5 w-3.5 text-[#64748B]" />
                            <span>ডুপ্লিকেট</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              setRenamingProject(project);
                              setRenameDraft(project.name);
                            }}
                            className="flex w-full cursor-pointer items-center gap-2 px-3.5 py-2 text-left text-[13px] font-medium text-[#0F172A] hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-gray-800"
                          >
                            <Edit3 className="h-3.5 w-3.5 text-[#64748B]" />
                            <span>নাম বদলান</span>
                          </button>
                          <div className="my-1 border-t border-[#E5E7EB] dark:border-[#1F2937]" />
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              setDeletingProject(project);
                            }}
                            className="flex w-full cursor-pointer items-center gap-2 px-3.5 py-2 text-left text-[13px] font-medium text-[#EF4444] hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>মুছে ফেলুন</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Info */}
                  <div className="flex flex-1 flex-col justify-between gap-2 p-3.5">
                    <div>
                      <button
                        type="button"
                        onClick={() => navigate(`/editor/${project.templateId}/${project.id}`)}
                        className="block w-full cursor-pointer truncate text-left text-[14.5px] font-bold text-[#0F172A] hover:text-[#4F46E5] dark:text-slate-100 dark:hover:text-indigo-400"
                      >
                        {project.name}
                      </button>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-[#64748B] dark:text-slate-400">
                        <LayoutGrid className="h-3 w-3 shrink-0" />
                        <span className="truncate">{tplName}</span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-[#E5E7EB] pt-2 text-[11.5px] text-[#64748B] dark:border-[#1F2937] dark:text-slate-400">
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Clock className="h-3 w-3" />
                        <span>শেষ এডিট: {formatBengaliRelativeTime(project.updatedAt)}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate(`/editor/${project.templateId}/${project.id}`)}
                        className="cursor-pointer font-semibold text-[#4F46E5] hover:underline dark:text-indigo-400"
                      >
                        এডিট করুন
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Rename Modal */}
      {renamingProject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setRenamingProject(null)}
        >
          <form
            onSubmit={handleConfirmRename}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[400px] space-y-4 rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-2xl dark:border-[#1F2937] dark:bg-[#111827]"
          >
            <h3 className="text-base font-bold text-[#0F172A] dark:text-slate-100">
              প্রজেক্টের নাম বদলান
            </h3>
            <input
              type="text"
              autoFocus
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              placeholder="নতুন নাম লিখুন"
              className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] focus:border-[#4F46E5] focus:outline-none dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-100"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenamingProject(null)}
                className="h-9 cursor-pointer rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-xs font-semibold text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={!renameDraft.trim()}
                className="h-9 cursor-pointer rounded-lg bg-[#4F46E5] px-4 text-xs font-semibold text-white hover:bg-[#4338CA] disabled:opacity-50"
              >
                সেভ করুন
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deletingProject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setDeletingProject(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[400px] space-y-4 rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-2xl dark:border-[#1F2937] dark:bg-[#111827]"
          >
            <h3 className="text-base font-bold text-[#0F172A] dark:text-slate-100">
              কাজটি মুছে ফেলবেন?
            </h3>
            <p className="text-sm text-[#64748B] dark:text-slate-400">
              “{deletingProject.name}” স্থায়ীভাবে ব্রাউজার থেকে মুছে যাবে। এটি আর ফেরত আনা যাবে না।
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingProject(null)}
                className="h-9 cursor-pointer rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-xs font-semibold text-[#0F172A] dark:border-[#1F2937] dark:bg-[#0B0F19] dark:text-slate-200"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="h-9 cursor-pointer rounded-lg bg-[#EF4444] px-4 text-xs font-semibold text-white hover:bg-red-600"
              >
                মুছে ফেলুন
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};
