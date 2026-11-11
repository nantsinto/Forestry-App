import React, { useState, useEffect } from 'react';
import { db, AuditFindingRecord, DEFAULT_AUDIT_FINDINGS } from '../services/db';
import {
  FileText,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  Download,
  Plus,
  RefreshCw,
  Printer,
  ChevronRight,
  ShieldCheck,
  Edit2,
  Trash2,
  X,
  UserCheck,
} from 'lucide-react';

export const AuditReportView: React.FC = () => {
  const [findings, setFindings] = useState<AuditFindingRecord[]>([]);
  const [filter, setFilter] = useState<'All' | 'Compliant' | 'Moderate' | 'Critical'>('All');
  const [isAddingFinding, setIsAddingFinding] = useState<boolean>(false);
  const [editingFinding, setEditingFinding] = useState<AuditFindingRecord | null>(null);

  // New finding state
  const [newModule, setNewModule] = useState('');
  const [newScope, setNewScope] = useState('');
  const [newStatus, setNewStatus] = useState<'Compliant' | 'Moderate' | 'Critical'>('Compliant');
  const [newResolution, setNewResolution] = useState('N/A');
  const [newNotes, setNewNotes] = useState('');

  const loadFindings = async () => {
    const records = await db.auditFindings.toArray();
    if (records.length === 0) {
      await db.auditFindings.bulkAdd(DEFAULT_AUDIT_FINDINGS);
      const reloaded = await db.auditFindings.toArray();
      setFindings(reloaded);
    } else {
      setFindings(records);
    }
  };

  useEffect(() => {
    loadFindings();
  }, []);

  // Calculate live compliance metrics
  const totalFindings = findings.length;
  const criticalCount = findings.filter((f) => f.status === 'Critical').length;
  const moderateCount = findings.filter((f) => f.status === 'Moderate').length;
  const compliantCount = findings.filter((f) => f.status === 'Compliant').length;

  // Score algorithm: 100% minus (critical * 25%) minus (moderate * 5%)
  const rawScore = totalFindings > 0
    ? Math.max(0, 100 - criticalCount * 25 - moderateCount * 4.3)
    : 100;
  const complianceScore = rawScore.toFixed(1);

  const overallStatus = criticalCount > 0
    ? 'Critical Action Required'
    : moderateCount > 0
    ? 'Satisfactory (Action Required)'
    : 'Full Compliance';

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModule || !newScope) return;

    await db.auditFindings.add({
      auditId: 'SGA-2026-081',
      module: newModule,
      scope: newScope,
      status: newStatus,
      resolutionDays: newStatus === 'Compliant' ? 'N/A' : newResolution || '14 Days',
      notes: newNotes || 'Added by operations inspector.',
      auditor: 'Sarah Jenkins, Operations & Compliance',
      lastVerified: new Date().toISOString().replace('T', ' ').slice(0, 16),
    });

    setNewModule('');
    setNewScope('');
    setNewStatus('Compliant');
    setNewResolution('N/A');
    setNewNotes('');
    setIsAddingFinding(false);
    loadFindings();
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFinding || !editingFinding.id) return;

    await db.auditFindings.update(editingFinding.id, {
      module: editingFinding.module,
      scope: editingFinding.scope,
      status: editingFinding.status,
      resolutionDays: editingFinding.status === 'Compliant' ? 'N/A' : editingFinding.resolutionDays,
      notes: editingFinding.notes,
      lastVerified: new Date().toISOString().replace('T', ' ').slice(0, 16),
    });

    setEditingFinding(null);
    loadFindings();
  };

  const handleDelete = async (id: number) => {
    await db.auditFindings.delete(id);
    loadFindings();
  };

  const handleReset = async () => {
    if (confirm('Reset audit findings to official SGA-2026-081 baseline?')) {
      await db.auditFindings.clear();
      await db.auditFindings.bulkAdd(DEFAULT_AUDIT_FINDINGS);
      loadFindings();
    }
  };

  const exportJSON = () => {
    const auditData = {
      auditId: 'SGA-2026-081',
      date: '2026-11-10',
      complianceScore: `${complianceScore}%`,
      overallStatus,
      findings,
    };
    const blob = new Blob([JSON.stringify(auditData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `silvaeguard_audit_SGA-2026-081.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportHTML = () => {
    const htmlString = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SilvaeGuard — Operations Audit Report SGA-2026-081</title>
  <style>
    :root {
      --primary: #1b4332;
      --accent: #52b788;
      --bg: #05070a;
      --card-bg: #0a1017;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --border: #1e293b;
      --status-pass: #22c55e;
      --status-warn: #f59e0b;
      --status-fail: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: var(--bg); color: var(--text); line-height: 1.6; padding: 2rem 1rem; }
    .container { max-width: 1000px; margin: 0 auto; }
    header { background: var(--card-bg); padding: 2rem; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 1.5rem; }
    h1 { color: #52b788; font-size: 1.8rem; margin-bottom: 0.5rem; }
    .meta { display: flex; flex-wrap: wrap; gap: 1.5rem; font-size: 0.9rem; color: var(--text-muted); }
    .meta span strong { color: var(--text); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .kpi-card { background: var(--card-bg); padding: 1.25rem; border-radius: 8px; border: 1px solid var(--border); }
    .kpi-title { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .kpi-value { font-size: 1.75rem; font-weight: 700; color: #52b788; font-family: monospace; margin-top: 0.25rem; }
    .card { background: var(--card-bg); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 1.5rem; }
    h2 { font-size: 1.2rem; margin-bottom: 1rem; color: #f1f5f9; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { text-align: left; padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); font-size: 0.88rem; }
    th { background: #0f172a; color: var(--text-muted); font-size: 0.78rem; text-transform: uppercase; }
    .badge { display: inline-block; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
    .badge-pass { background: rgba(34, 197, 94, 0.15); color: var(--status-pass); }
    .badge-warn { background: rgba(245, 158, 11, 0.15); color: var(--status-warn); }
    .badge-fail { background: rgba(239, 68, 68, 0.15); color: var(--status-fail); }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>SilvaeGuard — Operations Audit Report</h1>
      <p class="meta">
        <span><strong>Audit ID:</strong> SGA-2026-081</span>
        <span><strong>Date:</strong> November 10, 2026</span>
        <span><strong>Auditor:</strong> Sarah Jenkins, Operations & Compliance</span>
        <span><strong>Overall Status:</strong> ${overallStatus}</span>
      </p>
    </header>
    <section class="grid">
      <div class="kpi-card"><div class="kpi-title">Compliance Score</div><div class="kpi-value">${complianceScore}%</div></div>
      <div class="kpi-card"><div class="kpi-title">Critical Findings</div><div class="kpi-value">${criticalCount}</div></div>
      <div class="kpi-card"><div class="kpi-title">Moderate Concerns</div><div class="kpi-value">${moderateCount}</div></div>
      <div class="kpi-card"><div class="kpi-title">Compliant Systems</div><div class="kpi-value">${compliantCount} / ${totalFindings}</div></div>
    </section>
    <div class="card">
      <h2>Executive Summary</h2>
      <p>This operational audit assesses the resilience, regulatory compliance, and incident-readiness of the SilvaeGuard system and operational workflows. Key areas reviewed include sensor perimeter uptime, telemetry logging integrity, automated dispatch protocols, and personnel readiness.</p>
    </div>
    <div class="card">
      <h2>Audit Findings by Functional Area</h2>
      <table>
        <thead>
          <tr>
            <th>Module / Area</th>
            <th>Inspection Scope</th>
            <th>Status</th>
            <th>Target Resolution</th>
          </tr>
        </thead>
        <tbody>
          ${findings.map((f) => `
          <tr>
            <td><strong>${f.module}</strong></td>
            <td>${f.scope}</td>
            <td><span class="badge ${f.status === 'Compliant' ? 'badge-pass' : f.status === 'Moderate' ? 'badge-warn' : 'badge-fail'}">${f.status}</span></td>
            <td>${f.resolutionDays}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
    const blob = new Blob([htmlString], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `silvaeguard_operations_audit.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredFindings = findings.filter((f) => {
    if (filter === 'All') return true;
    return f.status === filter;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Audit Header */}
      <div className="bg-[#0a1017] border border-slate-800 rounded-lg p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono tracking-wider uppercase mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Official Operations Inspection</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            SilvaeGuard — Operations Audit Report
          </h1>
          <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-400 mt-2">
            <span><strong>Audit ID:</strong> <span className="font-mono text-slate-200">SGA-2026-081</span></span>
            <span aria-hidden="true">·</span>
            <span><strong>Date:</strong> November 10, 2026</span>
            <span aria-hidden="true">·</span>
            <span><strong>Auditor:</strong> Sarah Jenkins, Operations & Compliance</span>
            <span aria-hidden="true">·</span>
            <span>
              <strong>Status:</strong>{' '}
              <span className={`font-semibold ${
                criticalCount > 0 ? 'text-rose-400' : moderateCount > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {overallStatus}
              </span>
            </span>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-md transition-colors whitespace-nowrap"
            title="Print or save as PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>

          <button
            onClick={exportHTML}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:text-white bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/80 rounded-md transition-colors whitespace-nowrap"
            title="Export standalone silvaeguard_operations_audit.html file"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export HTML</span>
          </button>

          <button
            onClick={exportJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-md transition-colors whitespace-nowrap"
            title="Export findings as JSON"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#0a1017] border border-slate-800 rounded-lg p-5">
          <div className="text-[11px] uppercase tracking-wider text-slate-400">Compliance Score</div>
          <div className="text-3xl font-bold font-mono text-emerald-400 tabular-nums mt-1">
            {complianceScore}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Target benchmark: 90.0%</div>
        </div>

        <div className="bg-[#0a1017] border border-slate-800 rounded-lg p-5">
          <div className="text-[11px] uppercase tracking-wider text-slate-400">Critical Findings</div>
          <div className={`text-3xl font-bold font-mono tabular-nums mt-1 ${criticalCount > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
            {criticalCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Immediate stop-work issues</div>
        </div>

        <div className="bg-[#0a1017] border border-slate-800 rounded-lg p-5">
          <div className="text-[11px] uppercase tracking-wider text-slate-400">Moderate Concerns</div>
          <div className={`text-3xl font-bold font-mono tabular-nums mt-1 ${moderateCount > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
            {moderateCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Remediate within 14–30 days</div>
        </div>

        <div className="bg-[#0a1017] border border-slate-800 rounded-lg p-5">
          <div className="text-[11px] uppercase tracking-wider text-slate-400">Systems Audited</div>
          <div className="text-3xl font-bold font-mono text-white tabular-nums mt-1">
            {compliantCount} / {totalFindings}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">100% telemetry verification</div>
        </div>
      </section>

      {/* Executive Summary & Auditor Profile Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#0a1017] border border-slate-800 rounded-lg p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-white tracking-tight mb-3">
              Executive Summary
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              This operational audit assesses the resilience, regulatory compliance, and incident-readiness of the
              SilvaeGuard system and autonomous operational workflows across the Olympic Boreal Forest reserve. Key areas
              reviewed include solar sensor perimeter uptime, telemetry logging integrity under dense canopy, automated
              drone dispatch protocols, and field personnel labor compliance.
            </p>
            <div className="mt-4 p-3 rounded-md bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span><strong>Perimeter Latency:</strong> 99.8% packet delivery across 34 solar LoRaWAN sensor nodes.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span><strong>Labor Safety:</strong> Zero lone-worker check-in timeouts in the past 90 days.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span><strong>Buffer Redundancy:</strong> Canopy relay Beta-04 scheduled for capacitor expansion.</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800 text-xs text-slate-400">
            <span>Audit Scope: Operational Resilience & Autonomous Forestry Telemetry</span>
            <button
              onClick={handleReset}
              className="text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset to SGA-2026-081 Baseline</span>
            </button>
          </div>
        </div>

        {/* Auditor Profile Card */}
        <div className="bg-[#0a1017] border border-slate-800 rounded-lg p-6 flex flex-col items-center text-center">
          <img
            src="/src/assets/images/lead_auditor_1794355994154.jpg"
            alt="Lead Auditor Sarah Jenkins"
            referrerPolicy="no-referrer"
            className="w-24 h-24 rounded-full object-cover border-2 border-emerald-600/60 shadow-lg mb-3"
          />
          <h3 className="text-sm font-semibold text-white">Sarah Jenkins</h3>
          <p className="text-xs text-emerald-400 font-medium">Chief Operations & Compliance Auditor</p>
          <div className="mt-3 text-xs text-slate-400 leading-relaxed text-left space-y-1 w-full bg-slate-900/60 p-2.5 rounded border border-slate-800/80">
            <div><strong className="text-slate-300">Unit:</strong> Environmental Operations & Safety</div>
            <div><strong className="text-slate-300">Cert:</strong> ISO 14001 Lead Auditor · OSHA Forest Safety</div>
            <div><strong className="text-slate-300">Verification:</strong> FIDO2 Biometric Hardware Key #812</div>
          </div>
        </div>
      </div>

      {/* Audit Findings by Functional Area Table */}
      <div className="bg-[#0a1017] border border-slate-800 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-white tracking-tight">
              Audit Findings by Functional Area
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Inspecting {findings.length} operational systems and compliance mandates
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter buttons */}
            <div className="flex items-center p-0.5 bg-slate-900 rounded-lg border border-slate-800">
              {(['All', 'Compliant', 'Moderate', 'Critical'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    filter === s
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Add Finding Button */}
            <button
              onClick={() => setIsAddingFinding(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Finding</span>
            </button>
          </div>
        </div>

        {/* Findings Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Module / Area</th>
                <th className="py-2.5 px-3">Inspection Scope</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Target Resolution</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredFindings.map((finding) => (
                <tr key={finding.id} className="hover:bg-slate-900/40 transition-colors group">
                  <td className="py-3 px-3 font-semibold text-slate-200">
                    <div>{finding.module}</div>
                    <div className="text-[11px] font-normal text-slate-500 mt-0.5 line-clamp-1">
                      {finding.notes}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-300 max-w-xs">{finding.scope}</td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wider ${
                        finding.status === 'Compliant'
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                          : finding.status === 'Moderate'
                          ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                          : 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                      }`}
                    >
                      {finding.status === 'Compliant' && <CheckCircle className="w-3 h-3" />}
                      {finding.status === 'Moderate' && <AlertTriangle className="w-3 h-3" />}
                      {finding.status === 'Critical' && <AlertOctagon className="w-3 h-3" />}
                      <span>{finding.status}</span>
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-300 whitespace-nowrap">
                    {finding.resolutionDays}
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setEditingFinding(finding)}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Edit finding"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => finding.id && handleDelete(finding.id)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                        title="Delete finding"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Finding Modal */}
      {isAddingFinding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl bg-[#0a1017] border border-slate-800 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <h3 className="text-base font-semibold text-white">Add Operational Audit Finding</h3>
              <button onClick={() => setIsAddingFinding(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Functional Module / Area</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wildlife Corridor Acoustic Fence"
                  value={newModule}
                  onChange={(e) => setNewModule(e.target.value)}
                  className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Inspection Scope & Criteria</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acoustic sensor calibration and boundary beacon uptime"
                  value={newScope}
                  onChange={(e) => setNewScope(e.target.value)}
                  className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Compliance Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as any)}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Compliant">Compliant</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Target Resolution</label>
                  <input
                    type="text"
                    disabled={newStatus === 'Compliant'}
                    placeholder="e.g. 14 Days"
                    value={newStatus === 'Compliant' ? 'N/A' : newResolution}
                    onChange={(e) => setNewResolution(e.target.value)}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Audit Notes & Remediations</label>
                <textarea
                  rows={3}
                  placeholder="Document specific telemetry readings, deviations, or corrective actions..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddingFinding(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors"
                >
                  Save Finding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Finding Modal */}
      {editingFinding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl bg-[#0a1017] border border-slate-800 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <h3 className="text-base font-semibold text-white">Edit Audit Finding</h3>
              <button onClick={() => setEditingFinding(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Module / Area</label>
                <input
                  type="text"
                  required
                  value={editingFinding.module}
                  onChange={(e) => setEditingFinding({ ...editingFinding, module: e.target.value })}
                  className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Inspection Scope</label>
                <input
                  type="text"
                  required
                  value={editingFinding.scope}
                  onChange={(e) => setEditingFinding({ ...editingFinding, scope: e.target.value })}
                  className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
                  <select
                    value={editingFinding.status}
                    onChange={(e) => setEditingFinding({ ...editingFinding, status: e.target.value as any })}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Compliant">Compliant</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Target Resolution</label>
                  <input
                    type="text"
                    value={editingFinding.resolutionDays}
                    onChange={(e) => setEditingFinding({ ...editingFinding, resolutionDays: e.target.value })}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Notes & Remediations</label>
                <textarea
                  rows={3}
                  value={editingFinding.notes}
                  onChange={(e) => setEditingFinding({ ...editingFinding, notes: e.target.value })}
                  className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingFinding(null)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors"
                >
                  Update Finding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
