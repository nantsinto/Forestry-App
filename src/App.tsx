import { useEffect, useState } from 'react';
import { NavTab, TopNav } from './components/TopNav';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AuditReportView } from './components/AuditReportView';
import { PassportsView } from './views/PassportsView';
import { PublicPassportView } from './views/PublicPassportView';
import { GisView } from './views/GisView';
import { BrainView } from './views/BrainView';
import { QueueView } from './views/QueueView';
import { NativeView } from './views/NativeView';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { db, initializeDatabase } from './services/db';
import { syncPassportQueue } from './services/passport';
import { AlertTriangle } from 'lucide-react';

const PUBLIC_PREFIX = '#/p/';

const TABS: { id: NavTab; label: string }[] = [
  { id: 'passport', label: 'Passports' },
  { id: 'audit', label: 'Audit' },
  { id: 'gis', label: 'GIS' },
  { id: 'brain', label: 'Central Brain' },
  { id: 'queue', label: 'Queue' },
  { id: 'apk', label: 'Native' },
];

export default function App() {
  const [hash, setHash] = useState<string>(() => window.location.hash);
  const [activeTab, setActiveTab] = useState<NavTab>('passport');
  const [toast, setToast] = useState<string | null>(null);
  const { isOnline, isSyncing, unsyncedCount, syncQueueToCloud, refreshUnsyncedCount } = useOnlineStatus();

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    initializeDatabase();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timeout);
  }, [toast]);

  const handleSync = async () => {
    await syncQueueToCloud();
    await syncPassportQueue();
    await refreshUnsyncedCount();
  };

  const handleEmergencyBroadcast = async () => {
    await db.dispatchAlerts.add({
      alertId: `ALT-${Math.floor(1000 + Math.random() * 9000)}`,
      severity: 'high',
      title: 'Field emergency broadcast raised',
      location: 'Active patrol sector',
      coordinates: [0, 0],
      timestamp: new Date().toISOString(),
      status: 'Active',
      unitAssigned: 'Nearest ranger unit',
    });
    setToast('Emergency broadcast queued to the nearest units.');
  };

  // Buyer-facing passport opened from a QR label — no shell, no account.
  if (hash.startsWith(PUBLIC_PREFIX)) {
    return <PublicPassportView token={hash.slice(PUBLIC_PREFIX.length)} />;
  }

  return (
    <div className="min-h-screen bg-[#05070a] text-slate-100">
      <TopNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isOnline={isOnline}
        isSyncing={isSyncing}
        unsyncedCount={unsyncedCount}
        onSync={handleSync}
        onEmergencyBroadcast={handleEmergencyBroadcast}
      />

      {/* Mobile tab strip — the desktop nav is hidden below lg. */}
      <nav className="flex gap-1 overflow-x-auto border-b border-slate-800/80 bg-[#05070a] px-3 py-2 lg:hidden">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              activeTab === tab.id ? 'bg-slate-800 text-white' : 'text-slate-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main>
        {activeTab === 'passport' && <PassportsView />}
        {activeTab === 'audit' && <AuditReportView />}
        {activeTab === 'gis' && <GisView />}
        {activeTab === 'brain' && <BrainView />}
        {activeTab === 'queue' && <QueueView isOnline={isOnline} isSyncing={isSyncing} onSync={handleSync} />}
        {activeTab === 'apk' && <NativeView />}
      </main>

      <OfflineIndicator
        isOnline={isOnline}
        unsyncedCount={unsyncedCount}
        isSyncing={isSyncing}
        onSync={handleSync}
      />

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-rose-800/70 bg-rose-950/90 px-3.5 py-2 text-xs text-rose-200 shadow-xl">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
