// client/src/pages/Contacts.jsx
// /contacts — Startup Founder CRM (Roadmap Wave 4). Track clients, partners,
// suppliers, investors, and mentors; filter by type/status; search; and link each
// contact to projects, receivables, and payables via Universal Links (Wave 1).

import { useState, useEffect, useCallback } from 'react';
import { Plus, Users, Search, UserCheck, Briefcase, Handshake, Sparkles } from 'lucide-react';

import api from '../lib/api';
import useDocumentTitle from '../hooks/useDocumentTitle';

import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { StatCard } from '../components/ui/StatCard';
import { DataTable } from '../components/ui/DataTable';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';

import { CreateContactModal } from '../components/contacts/CreateContactModal';
import { ContactDetailModal } from '../components/contacts/ContactDetailModal';

const TYPE_VARIANTS = {
  client: 'moss', partner: 'terracotta', supplier: 'amber',
  investor: 'ember', mentor: 'blue', other: 'gray',
};
const STATUS_VARIANTS = { active: 'moss', inactive: 'gray', lead: 'ember' };

const TYPE_TABS = [
  { key: '',          label: 'All' },
  { key: 'client',    label: 'Clients' },
  { key: 'partner',   label: 'Partners' },
  { key: 'supplier',  label: 'Suppliers' },
  { key: 'investor',  label: 'Investors' },
  { key: 'mentor',    label: 'Mentors' },
];

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {[...Array(5)].map((_, i) => (
        <Card key={i}>
          <CardBody>
            <div className="h-3 w-20 rounded bg-stone-200 dark:bg-gray-700 animate-pulse mb-3" />
            <div className="h-7 w-12 rounded bg-stone-200 dark:bg-gray-700 animate-pulse" />
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

export default function Contacts() {
  useDocumentTitle('Contacts');

  const [contacts, setContacts]     = useState([]);
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [activeType, setActiveType] = useState('');
  const [search, setSearch]         = useState('');

  const [showCreate, setShowCreate]         = useState(false);
  const [editContact, setEditContact]       = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ per_page: '50' });
      if (activeType)    params.set('type', activeType);
      if (search.trim()) params.set('search', search.trim());

      const [listRes, statsRes] = await Promise.all([
        api.get(`/api/contacts?${params.toString()}`),
        api.get('/api/contacts/stats'),
      ]);

      setContacts(listRes.data ?? []);
      setStats(statsRes.data);
    } catch (err) {
      setError(err.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [activeType, search]);

  // Debounce so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(fetchContacts, 300);
    return () => clearTimeout(timer);
  }, [fetchContacts]);

  const handleSaved = () => { setShowCreate(false); setEditContact(null); fetchContacts(); };
  const openEdit = (contact) => { setSelectedContact(null); setEditContact(contact); setShowCreate(true); };

  const columns = [
    {
      key: 'name', header: 'Name', sortable: true, render: (row) => (
        <button
          type="button"
          onClick={() => setSelectedContact(row)}
          className="font-medium text-stone-800 dark:text-gray-100 hover:text-moss-600 dark:hover:text-moss-400 transition-colors duration-150 text-left"
        >
          {row.name}
        </button>
      ),
    },
    { key: 'company', header: 'Company', render: (row) => (
      <span className="text-sm text-stone-600 dark:text-gray-400">{row.company || '—'}</span>
    ) },
    { key: 'type', header: 'Type', render: (row) => (
      <Badge variant={TYPE_VARIANTS[row.type] ?? 'gray'}>{row.type}</Badge>
    ) },
    { key: 'status', header: 'Status', render: (row) => (
      <Badge variant={STATUS_VARIANTS[row.status] ?? 'gray'}>{row.status}</Badge>
    ) },
    { key: 'email', header: 'Email', render: (row) => (
      <span className="text-sm text-stone-500 dark:text-gray-400">{row.email || '—'}</span>
    ) },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">Contacts</h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">
            {stats ? `${stats.total} contact${stats.total === 1 ? '' : 's'} in your network` : 'Your startup CRM — clients, partners, and stakeholders.'}
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => { setEditContact(null); setShowCreate(true); }}>
          <Plus size={16} />
          Add Contact
        </Button>
      </div>

      {/* STAT CARDS */}
      {loading && !stats ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Total"    value={stats?.total ?? 0}    icon={Users} />
          <StatCard label="Active"   value={stats?.active ?? 0}   icon={UserCheck} />
          <StatCard label="Clients"  value={stats?.clients ?? 0}  icon={Briefcase} />
          <StatCard label="Partners" value={stats?.partners ?? 0} icon={Handshake} />
          <StatCard label="Leads"    value={stats?.leads ?? 0}    icon={Sparkles} />
        </div>
      )}

      {/* TYPE TABS + SEARCH */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {TYPE_TABS.map((tab) => {
            const isActive = activeType === tab.key;
            return (
              <button
                key={tab.key || 'all'}
                onClick={() => setActiveType(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-moss-500 dark:focus:ring-moss-400 ${
                  isActive
                    ? 'bg-moss-50 dark:bg-moss-950/50 text-moss-700 dark:text-moss-400 border border-moss-200 dark:border-moss-800'
                    : 'bg-white dark:bg-gray-800 text-stone-600 dark:text-gray-400 border border-stone-200 dark:border-gray-700 hover:bg-stone-50 dark:hover:bg-gray-700 hover:text-stone-900 dark:hover:text-gray-100'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-gray-500 pointer-events-none" />
          <Input
            placeholder="Search contacts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search contacts"
          />
        </div>
      </div>

      {/* TABLE / STATES */}
      {error && contacts.length === 0 ? (
        <ErrorState message={error} onRetry={fetchContacts} />
      ) : loading && contacts.length === 0 ? (
        <Card><CardBody><div className="h-64 animate-pulse bg-stone-100 dark:bg-gray-800 rounded-lg" /></CardBody></Card>
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title={activeType ? `No ${activeType}s yet` : 'No contacts yet'}
          message={search.trim() ? 'No contacts match your search.' : 'Add clients, partners, suppliers, and stakeholders to build your CRM.'}
          action={<Button variant="primary" size="sm" onClick={() => { setEditContact(null); setShowCreate(true); }}><Plus size={14} /> Add Contact</Button>}
        />
      ) : (
        <Card>
          <CardBody className="p-0">
            <DataTable columns={columns} items={contacts} initialSortKey="name" />
          </CardBody>
        </Card>
      )}

      {/* CREATE / EDIT MODAL */}
      <CreateContactModal
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setEditContact(null); }}
        onSaved={handleSaved}
        contact={editContact}
      />

      {/* DETAIL MODAL */}
      {selectedContact && (
        <ContactDetailModal
          isOpen={!!selectedContact}
          onClose={() => { setSelectedContact(null); fetchContacts(); }}
          contact={selectedContact}
          onEdit={() => openEdit(selectedContact)}
        />
      )}
    </div>
  );
}
