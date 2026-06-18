// client/src/pages/EngineerDocs.jsx
// Project-scoped markdown documents (master–detail). The active project comes
// from ?project=<id>. The left column lists the project's documents; the right
// column is a markdown editor (@uiw/react-md-editor) for the selected/new doc,
// with title + doc_type fields, save (POST/PATCH), delete, and a preview toggle.

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, FileText, Trash2, Eye, Pencil } from 'lucide-react';
import { DocAttachmentUploader } from '../components/engineer/DocAttachmentUploader';
import { DocAttachmentList } from '../components/engineer/DocAttachmentList';

import api from '../lib/api';
import { useApi } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';
import useDocumentTitle from '../hooks/useDocumentTitle';

import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { ListSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';

import { ProjectScopePicker } from '../components/engineer/ProjectScopePicker';
import { MarkdownEditor, MarkdownPreview } from '../components/engineer/MarkdownEditor';

const DOC_TYPES = [
  { value: '',          label: 'General' },
  { value: 'design',    label: 'Design' },
  { value: 'runbook',   label: 'Runbook' },
  { value: 'reference', label: 'Reference' },
  { value: 'spec',      label: 'Specification' },
];

const DOC_TYPE_LABEL = DOC_TYPES.reduce((acc, t) => { acc[t.value] = t.label; return acc; }, {});

// A blank draft (id null = unsaved new document).
const blankDraft = () => ({ id: null, title: '', doc_type: '', content: '' });

export default function EngineerDocs() {
  useDocumentTitle('Engineering — Docs');
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('project') ?? '';
  const { addToast } = useToast();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [draft, setDraft] = useState(null);        // null = nothing open; else editing buffer
  const [mode, setMode] = useState('edit');          // 'edit' | 'preview'
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [attachRefreshKey, setAttachRefreshKey] = useState(0);

  // ── Data fetching ───────────────────────────────────────────────────────────
  const { data: projects } = useApi(() => api.get('/api/engineer'), []);

  const { data: docs, loading, error, refetch } = useApi(
    () => projectId
      ? api.get(`/api/engineer/projects/${projectId}/documents`)
      : Promise.resolve({ data: [] }),
    [projectId]
  );

  // Close the editor when switching projects.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setDraft(null); }, [projectId]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const setProject = (id) => {
    if (id) setSearchParams({ project: id });
    else setSearchParams({});
  };

  const openNew = () => { setDraft(blankDraft()); setMode('edit'); };
  const openDoc = (doc) => {
    setDraft({ id: doc.id, title: doc.title, doc_type: doc.doc_type ?? '', content: doc.content ?? '' });
    setMode('edit');
  };

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.title.trim()) {
      addToast({ type: 'error', title: 'Title required', message: 'Give the document a title before saving.' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: draft.title.trim(),
        content: draft.content,
        doc_type: draft.doc_type || undefined,
      };
      if (draft.id) {
        const res = await api.patch(`/api/engineer/documents/${draft.id}`, payload);
        setDraft(d => ({ ...d, ...res.data, doc_type: res.data.doc_type ?? '' }));
      } else {
        const res = await api.post(`/api/engineer/projects/${projectId}/documents`, payload);
        setDraft({ id: res.data.id, title: res.data.title, doc_type: res.data.doc_type ?? '', content: res.data.content ?? '' });
      }
      addToast({ type: 'success', title: 'Document saved' });
      refetch();
    } catch (err) {
      addToast({ type: 'error', title: 'Save failed', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!draft?.id) return;
    setDeleting(true);
    try {
      await api.delete(`/api/engineer/documents/${draft.id}`);
      addToast({ type: 'success', title: 'Document deleted' });
      setConfirmDelete(false);
      setDraft(null);
      refetch();
    } catch (err) {
      addToast({ type: 'error', title: 'Delete failed', message: err.message });
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

      {/* PAGE HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">
            Docs
          </h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">
            Design notes, runbooks, and references — in Markdown, per project.
          </p>
        </div>
        {projectId && (
          <Button variant="primary" size="md" onClick={openNew}>
            <Plus size={16} />
            New Document
          </Button>
        )}
      </div>

      {/* PROJECT SCOPE */}
      {!projectId ? (
        <ProjectScopePicker projects={projects} selectedId={projectId} onSelect={setProject} />
      ) : (
        <Card>
          <CardBody>
            <Select
              id="docs-project"
              label="Project"
              value={projectId}
              onChange={(e) => setProject(e.target.value)}
            >
              <option value="">Select a project…</option>
              {(projects ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </CardBody>
        </Card>
      )}

      {/* MASTER–DETAIL */}
      {projectId && (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">

          {/* LIST */}
          <Card>
            <CardHeader title="Documents" subtitle={docs?.length ? `${docs.length} total` : undefined} />
            <CardBody className="p-0">
              {loading && <ListSkeleton rows={4} />}
              {error && !loading && <ErrorState message={error} onRetry={refetch} />}
              {!loading && !error && (!docs || docs.length === 0) && (
                <EmptyState
                  icon={FileText}
                  title="No documents"
                  message="Create the first document for this project."
                  action={
                    <Button variant="primary" size="sm" onClick={openNew}>
                      <Plus size={14} />
                      New Document
                    </Button>
                  }
                />
              )}
              {!loading && !error && docs && docs.length > 0 && (
                <div className="divide-y divide-stone-100 dark:divide-gray-700">
                  {docs.map(doc => {
                    const isActive = draft?.id === doc.id;
                    return (
                      <button
                        key={doc.id}
                        onClick={() => openDoc(doc)}
                        className={`w-full text-left px-6 py-3 transition-colors duration-100
                          ${isActive
                            ? 'bg-moss-50 dark:bg-moss-950/30'
                            : 'hover:bg-stone-50 dark:hover:bg-gray-700/50'}`}
                      >
                        <p className="text-sm font-medium text-stone-900 dark:text-gray-50 truncate">
                          {doc.title}
                        </p>
                        <p className="text-[11px] text-stone-400 dark:text-gray-500 mt-0.5">
                          {DOC_TYPE_LABEL[doc.doc_type ?? ''] ?? doc.doc_type}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          {/* EDITOR */}
          <Card>
            {draft ? (
              <CardBody className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-4">
                  <Input
                    id="doc-title"
                    label="Title"
                    placeholder="e.g. Firmware architecture"
                    value={draft.title}
                    onChange={(e) => setDraft(d => ({ ...d, title: e.target.value }))}
                  />
                  <Select
                    id="doc-type"
                    label="Type"
                    value={draft.doc_type}
                    onChange={(e) => setDraft(d => ({ ...d, doc_type: e.target.value }))}
                  >
                    {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </Select>
                </div>

                {/* Edit / Preview toggle */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMode('edit')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150
                      ${mode === 'edit'
                        ? 'bg-moss-50 dark:bg-moss-950/50 text-moss-700 dark:text-moss-400'
                        : 'bg-white dark:bg-gray-800 border border-stone-200 dark:border-gray-700 text-stone-600 dark:text-gray-400 hover:bg-stone-50 dark:hover:bg-gray-700'}`}
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  <button
                    onClick={() => setMode('preview')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150
                      ${mode === 'preview'
                        ? 'bg-moss-50 dark:bg-moss-950/50 text-moss-700 dark:text-moss-400'
                        : 'bg-white dark:bg-gray-800 border border-stone-200 dark:border-gray-700 text-stone-600 dark:text-gray-400 hover:bg-stone-50 dark:hover:bg-gray-700'}`}
                  >
                    <Eye size={13} /> Preview
                  </button>
                </div>

                {mode === 'edit' ? (
                  <MarkdownEditor
                    value={draft.content}
                    onChange={(md) => setDraft(d => ({ ...d, content: md }))}
                  />
                ) : (
                  <div className="rounded-lg border border-stone-200 dark:border-gray-700 bg-stone-50 dark:bg-gray-900 p-4 min-h-[200px]">
                    <MarkdownPreview source={draft.content} />
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-2">
                  <div>
                    {draft.id && (
                      <Button variant="danger" size="md" onClick={() => setConfirmDelete(true)} disabled={saving || deleting}>
                        <Trash2 size={16} />
                        Delete
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="secondary" size="md" onClick={() => setDraft(null)} disabled={saving}>
                      Close
                    </Button>
                    <Button variant="primary" size="md" onClick={handleSave} disabled={saving}>
                      {saving ? 'Saving…' : (draft.id ? 'Save Changes' : 'Save Document')}
                    </Button>
                  </div>
                </div>

                {/* Attachments — only shown for saved documents */}
                {draft.id && (
                  <div className="border-t border-stone-200 dark:border-gray-700 pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-stone-500 dark:text-gray-400 uppercase tracking-wide">
                        Attachments
                      </p>
                      <DocAttachmentUploader
                        documentId={draft.id}
                        onUploaded={() => setAttachRefreshKey(k => k + 1)}
                      />
                    </div>
                    <DocAttachmentList
                      documentId={draft.id}
                      refreshKey={attachRefreshKey}
                    />
                  </div>
                )}
              </CardBody>
            ) : (
              <CardBody className="p-0">
                <EmptyState
                  icon={FileText}
                  title="No document open"
                  message="Select a document from the list, or create a new one."
                  action={
                    <Button variant="primary" size="sm" onClick={openNew}>
                      <Plus size={14} />
                      New Document
                    </Button>
                  }
                />
              </CardBody>
            )}
          </Card>
        </div>
      )}

      {/* DELETE CONFIRMATION */}
      <Modal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete Document"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" size="md" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-stone-600 dark:text-gray-400">
          Delete{' '}
          <span className="font-semibold text-stone-900 dark:text-gray-50">"{draft?.title}"</span>?
          This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
