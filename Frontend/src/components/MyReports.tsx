// My Reports — AI report list with view dialog, edit, delete, and filters

import { useState, useEffect } from 'react';
import { useCasesStore } from '../stores/useCasesStore';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { toast } from 'sonner';
import {
  ClipboardList,
  Eye,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Search,
  ChevronRight,
  Clock,
  Download,
  Send,
  Edit3,
  RotateCcw,
  Printer,
  Stethoscope,
  Trash2,
  Save,
  X,
  AlertCircle,
  BookOpen,
  Star,
  Activity,
  Brain,
  Wind,
  FlaskConical,
} from 'lucide-react';

// ── Filter data ────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { id: 'all',      label: 'All Reports', icon: BookOpen,      color: 'text-slate-600' },
  { id: 'REVIEWED', label: 'Reviewed',    icon: CheckCircle2,  color: 'text-green-600' },
  { id: 'PENDING',  label: 'Pending',     icon: Clock,         color: 'text-yellow-600' },
  { id: 'URGENT',   label: 'Urgent',      icon: AlertTriangle, color: 'text-red-600' },
] as const;

const SCAN_FILTERS = [
  { id: 'all',     label: 'All Scans' },
  { id: 'X-Ray',  label: 'X-Ray' },
  { id: 'CT Scan', label: 'CT Scan' },
  { id: 'MRI',    label: 'MRI' },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

const getScanBadgeColor = (scan: string) => {
  if (scan === 'X-Ray')   return 'bg-blue-100 text-blue-800 border-blue-200';
  if (scan === 'CT Scan') return 'bg-purple-100 text-purple-800 border-purple-200';
  if (scan === 'MRI')     return 'bg-green-100 text-green-800 border-green-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
};

const getScanIcon = (scan: string) => {
  if (scan === 'MRI')     return Brain;
  if (scan === 'X-Ray')  return Wind;
  if (scan.includes('CT')) return Activity;
  return FlaskConical;
};

// ── Component ──────────────────────────────────────────────────────────────────

type SectionKey = 'indication' | 'technique' | 'findings' | 'impression';

interface MyReportsProps {
  onViewCase: (caseId: string) => void;
}

export function MyReports({ onViewCase }: MyReportsProps) {
  const { cases, isLoading, selectedCase, selectedCaseAnalysis, selectCase } = useCasesStore();

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [scanFilter,   setScanFilter]   = useState<string>('all');
  const [searchQuery,  setSearchQuery]  = useState('');

  // ── Detail view ───────────────────────────────────────────────────────────────
  const [selectedId,       setSelectedId]       = useState<string | null>(null);
  const [isLoadingDetail,  setIsLoadingDetail]  = useState(false);
  const [reportStatus,     setReportStatus]     = useState<'draft' | 'final'>('draft');
  const [saved,            setSaved]            = useState(false);
  const [finalized,        setFinalized]        = useState(false);
  const [editedSections,   setEditedSections]   = useState<Record<SectionKey, string>>({
    indication: '', technique: '', findings: '', impression: '',
  });

  // ── Delete state ──────────────────────────────────────────────────────────────
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletedIds,      setDeletedIds]      = useState<Set<string>>(new Set());

  // ── Filtered cases ────────────────────────────────────────────────────────────
  const filteredCases = cases.filter(c => {
    if (deletedIds.has(c.id)) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (scanFilter   !== 'all' && c.scanType !== scanFilter)  return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !c.patientName.toLowerCase().includes(q) &&
        !c.patientId.toLowerCase().includes(q) &&
        !c.scanType.toLowerCase().includes(q) &&
        !c.bodyPart.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const statusCount = (id: string) => {
    const base = cases.filter(c => !deletedIds.has(c.id));
    if (id === 'all') return base.length;
    return base.filter(c => c.status === id).length;
  };

  // ── Open detail ───────────────────────────────────────────────────────────────
  const handleOpenReport = async (caseId: string) => {
    setSelectedId(caseId);
    setIsLoadingDetail(true);
    setReportStatus('draft');
    setSaved(false);
    setFinalized(false);
    await selectCase(caseId);
    setIsLoadingDetail(false);
  };

  // Hydrate sections when case/analysis loads
  useEffect(() => {
    if (selectedCase?.id !== selectedId) return;
    const rs = selectedCaseAnalysis?.reportSections;
    setEditedSections({
      indication: rs?.indication ?? selectedCase?.clinicalHistory ?? 'Clinical indication not provided.',
      technique:  rs?.technique  ?? `${selectedCase?.scanType ?? ''} of ${selectedCase?.bodyPart ?? ''}.`,
      findings:   rs?.findings   ?? (selectedCaseAnalysis?.findings.map(f => `${f.location}: ${f.details ?? f.finding ?? ''}`).join('\n\n') ?? ''),
      impression: rs?.impression  ?? selectedCaseAnalysis?.summary ?? 'No acute findings.',
    });
  }, [selectedCase, selectedCaseAnalysis, selectedId]);

  const handleSectionChange = (id: SectionKey, value: string) => {
    setEditedSections(prev => ({ ...prev, [id]: value }));
    setSaved(false);
  };

  const handleReset = (id: SectionKey) => {
    const rs = selectedCaseAnalysis?.reportSections;
    if (!rs) return;
    setEditedSections(prev => ({ ...prev, [id]: (rs as any)[id] ?? '' }));
  };

  const handleExport = () => {
    if (!selectedCase) return;
    const date = new Date();
    const dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Radiology Report – ${esc(selectedCase.patientId)}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Times New Roman',serif;font-size:11pt;color:#111;background:#fff;padding:1.8cm 2cm;max-width:21cm;margin:0 auto}.hdr{text-align:center;border-bottom:2.5px solid #111;padding-bottom:10px;margin-bottom:14px}.hdr .sub{font-size:9pt;color:#444;letter-spacing:.05em;margin-bottom:4px}.hdr h1{font-size:17pt;font-weight:bold;letter-spacing:.03em}.meta{display:grid;grid-template-columns:1fr 1fr;column-gap:24px;row-gap:3px;margin:12px 0 16px;font-size:10pt}.meta-row{display:flex;gap:5px}.ml{font-weight:bold}hr{border:none;border-top:1px solid #888;margin:12px 0}.sec{margin-bottom:16px}.sh{font-size:11pt;font-weight:bold;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;padding-bottom:3px;border-bottom:1px solid #ccc}.sb{font-size:10.5pt;line-height:1.65;white-space:pre-wrap}.ftr{margin-top:28px;border-top:1px solid #aaa;padding-top:8px;font-size:8.5pt;color:#555;text-align:center;line-height:1.6}.conf{display:inline-block;border:1px solid #666;padding:1px 8px;letter-spacing:.08em;margin-bottom:5px;font-size:8pt}@media print{body{padding:0}@page{margin:1.8cm 2cm}}</style></head><body><div class="hdr"><div class="sub">AfyaDX AI-Assisted Diagnostic Platform</div><h1>RADIOLOGY REPORT</h1></div><div class="meta"><div class="meta-row"><span class="ml">Patient ID:</span><span>${esc(selectedCase.patientId)}</span></div><div class="meta-row"><span class="ml">Date:</span><span>${dateStr}</span></div><div class="meta-row"><span class="ml">Accession:</span><span>${esc(selectedCase.accessionNumber)}</span></div><div class="meta-row"><span class="ml">Time:</span><span>${timeStr}</span></div><div class="meta-row"><span class="ml">AI Model:</span><span>${esc(selectedCaseAnalysis?.modelVersion ?? 'N/A')}</span></div></div><hr><div class="sec"><div class="sh">Indication</div><div class="sb">${esc(editedSections.indication)}</div></div><div class="sec"><div class="sh">Technique</div><div class="sb">${esc(editedSections.technique)}</div></div><div class="sec"><div class="sh">Findings</div><div class="sb">${esc(editedSections.findings)}</div></div><div class="sec"><div class="sh">Impression</div><div class="sb">${esc(editedSections.impression)}</div></div><div class="ftr"><div class="conf">CONFIDENTIAL</div><br>AI-generated report — requires radiologist verification before clinical use.<br>AfyaDX Diagnostic Platform · ${dateStr} ${timeStr}</div><script>window.onload=function(){window.print()}<\/script></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) toast.error('Allow pop-ups to export as PDF');
    else toast.success('Report opened — use Print → Save as PDF');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const handleDelete = (caseId: string) => {
    setDeletedIds(prev => new Set([...prev, caseId]));
    setConfirmDeleteId(null);
    if (selectedId === caseId) setSelectedId(null);
    toast.success('Report removed from list');
  };

  // ── DETAIL VIEW ───────────────────────────────────────────────────────────────
  if (selectedId) {
    const reportCase = cases.find(c => c.id === selectedId);
    const SECTIONS: Array<{ id: SectionKey; label: string; placeholder: string; rows: number }> = [
      { id: 'indication', label: 'Indication', placeholder: 'Enter clinical indication...',    rows: 3 },
      { id: 'technique',  label: 'Technique',  placeholder: 'Describe the technique...',       rows: 3 },
      { id: 'findings',   label: 'Findings',   placeholder: 'Describe imaging findings...',    rows: 8 },
      { id: 'impression', label: 'Impression', placeholder: 'Provide conclusion/impression...', rows: 4 },
    ];

    return (
      <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">
        {/* ── Detail Top Bar ── */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            {/* Left */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedId(null)}
                className="mr-2 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
              <ClipboardList className="w-5 h-5 text-blue-600" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-slate-900">{reportCase?.patientName ?? 'Report'}</h2>
                  <Badge variant="outline" className={getScanBadgeColor(reportCase?.scanType ?? '')}>
                    {reportCase?.scanType}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={reportStatus === 'final'
                      ? 'bg-green-100 text-green-800 border-green-200'
                      : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                    }
                  >
                    {reportStatus === 'final'
                      ? <><CheckCircle2 className="w-3 h-3 mr-1" />Finalized</>
                      : <><Edit3 className="w-3 h-3 mr-1" />Draft</>
                    }
                  </Badge>
                </div>
                <p className="text-sm text-slate-500">
                  {reportCase?.patientId} · {reportCase?.bodyPart} ·{' '}
                  {reportCase?.date ? new Date(reportCase.date).toLocaleDateString() : ''}
                </p>
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-2">
              {saved && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                </span>
              )}
              <Button variant="outline" size="sm" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2500); }}>
                <Save className="w-4 h-4 mr-1.5" />Save Draft
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="w-4 h-4 mr-1.5" />Export
              </Button>
              {reportStatus !== 'final' && (
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => { setReportStatus('final'); setFinalized(true); }}
                >
                  <Send className="w-4 h-4 mr-1.5" />Finalize
                </Button>
              )}
              {confirmDeleteId === selectedId ? (
                <>
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => handleDelete(selectedId)}
                  >
                    Confirm Delete
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                </>
              ) : (
                <Button
                  variant="outline" size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => setConfirmDeleteId(selectedId)}
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />Delete
                </Button>
              )}
              <Button
                variant="outline" size="sm"
                className="text-blue-600 border-blue-300 hover:bg-blue-50"
                onClick={() => onViewCase(selectedId)}
              >
                <Eye className="w-4 h-4 mr-1.5" />Open in Workstation
              </Button>
            </div>
          </div>
        </div>

        {isLoadingDetail ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6 max-w-5xl mx-auto">

              {finalized && (
                <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-green-900 text-sm">
                      Report finalized on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.
                    </p>
                    <p className="text-green-700 text-xs mt-0.5">
                      This report has been locked. Contact the department to request an amendment.
                    </p>
                  </div>
                </div>
              )}

              {/* Patient & Study Info */}
              <Card className="border-slate-200">
                <div className="p-4 border-b border-slate-100 bg-slate-50 rounded-t-lg">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-slate-600" />
                    <h3 className="text-slate-900">Patient & Study Information</h3>
                  </div>
                </div>
                <div className="p-4 grid grid-cols-3 gap-4">
                  {([
                    { label: 'Patient Name',  value: reportCase?.patientName ?? '' },
                    { label: 'Patient ID',    value: reportCase?.patientId ?? '' },
                    { label: 'Age / Gender',  value: reportCase ? `${reportCase.age}y / ${reportCase.gender}` : '' },
                    { label: 'Scan Type',     value: reportCase?.scanType ?? '' },
                    { label: 'Body Part',     value: reportCase?.bodyPart ?? '' },
                    { label: 'Accession No.', value: reportCase?.accessionNumber ?? '' },
                  ] as const).map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs text-slate-400 mb-1">{label}</p>
                      <Input value={value} readOnly className="h-8 text-sm bg-slate-50" />
                    </div>
                  ))}
                </div>
              </Card>

              {/* Report sections */}
              {SECTIONS.map((section, idx) => (
                <Card key={section.id} className="border-slate-200">
                  <div className="p-4 border-b border-slate-100 bg-slate-50 rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">
                          {idx + 1}
                        </div>
                        <h3 className="text-slate-900">{section.label}</h3>
                      </div>
                      {reportStatus !== 'final' && (
                        <Button
                          variant="ghost" size="sm"
                          className="text-slate-400 hover:text-slate-600 h-7 px-2"
                          onClick={() => handleReset(section.id)}
                          title="Reset to AI original"
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" />
                          <span className="text-xs">Reset</span>
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="p-4">
                    <Textarea
                      value={editedSections[section.id]}
                      onChange={e => handleSectionChange(section.id, e.target.value)}
                      placeholder={section.placeholder}
                      className="text-sm resize-none leading-relaxed"
                      style={{ minHeight: `${section.rows * 24}px` }}
                      disabled={reportStatus === 'final'}
                    />
                    {editedSections[section.id].includes('[') && reportStatus !== 'final' && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Fill in all bracketed placeholders before finalizing.</span>
                      </div>
                    )}
                  </div>
                </Card>
              ))}

              {/* Footer */}
              <Card className="border-slate-200 bg-slate-50">
                <div className="p-4 flex items-center justify-between text-sm text-slate-500">
                  <div className="flex items-center gap-4">
                    <span>AI Model: <strong className="text-slate-700">{selectedCaseAnalysis?.modelVersion ?? 'N/A'}</strong></span>
                    <Separator orientation="vertical" className="h-4" />
                    <span>
                      Avg Confidence:{' '}
                      <strong className="text-slate-700">
                        {selectedCaseAnalysis && selectedCaseAnalysis.findings.length > 0
                          ? `${Math.round((selectedCaseAnalysis.findings.reduce((s, f) => s + f.confidence, 0) / selectedCaseAnalysis.findings.length) * 100)}%`
                          : 'N/A'
                        }
                      </strong>
                    </span>
                    <Separator orientation="vertical" className="h-4" />
                    <span>{selectedCaseAnalysis?.findings.length ?? 0} findings · {selectedCaseAnalysis?.recommendations.length ?? 0} recommendations</span>
                  </div>
                  <span>Acc: <strong className="text-slate-700">{reportCase?.accessionNumber ?? ''}</strong></span>
                </div>
              </Card>

            </div>
          </ScrollArea>
        )}
      </div>
    );
  }

  // ── GRID VIEW ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">
      {/* ── Top Bar ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            <h2 className="text-slate-900">My Reports</h2>
          </div>
          {/* Search */}
          <div className="relative" style={{ width: 260 }}>
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search patient or scan..."
              className="pl-9 h-9 text-sm bg-slate-50"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── Filter pills ── */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Status */}
          <div className="flex items-center gap-1.5">
            {STATUS_FILTERS.map(f => {
              const Icon = f.icon;
              const active = statusFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors border ${
                    active
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'text-slate-600 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? 'text-blue-600' : f.color}`} />
                  <span>{f.label}</span>
                  <span className={`text-xs ml-0.5 ${active ? 'text-blue-500' : 'text-slate-400'}`}>
                    {statusCount(f.id)}
                  </span>
                </button>
              );
            })}
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Scan type */}
          <div className="flex items-center gap-1.5">
            {SCAN_FILTERS.map(f => {
              const active = scanFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setScanFilter(f.id)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors border ${
                    active
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'text-slate-600 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Card grid ── */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <FileText className="w-12 h-12 text-slate-300" />
              <h3 className="text-slate-700">No reports found</h3>
              <p className="text-sm text-slate-500">
                {searchQuery || statusFilter !== 'all' || scanFilter !== 'all'
                  ? 'Try adjusting your filters.'
                  : 'Cases will appear here once they have been processed.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
              {filteredCases.map(c => {
                const ScanIcon = getScanIcon(c.scanType);
                return (
                  <Card
                    key={c.id}
                    onClick={() => handleOpenReport(c.id)}
                    className="p-4 cursor-pointer transition-all hover:shadow-md border-slate-200 bg-white hover:border-blue-300 flex flex-col"
                  >
                    {/* Name + scan badge */}
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm text-slate-800 leading-snug flex-1 mr-2 font-medium" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {c.patientName}
                      </p>
                      <Badge variant="outline" className={`text-xs py-0 flex-shrink-0 ${getScanBadgeColor(c.scanType)}`}>
                        {c.scanType}
                      </Badge>
                    </div>

                    {/* Body part */}
                    <p className="text-xs text-slate-500 mb-3 truncate">{c.bodyPart}</p>

                    {/* Status chips */}
                    <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                      {c.status === 'REVIEWED' && <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">Reviewed</span>}
                      {c.status === 'URGENT'   && <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">Urgent</span>}
                      {c.status === 'PENDING'  && <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">Pending</span>}
                      {c.analysis?.status === 'COMPLETED' && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">AI ✓</span>}
                      {c.analysis?.status === 'FAILED'    && <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600">AI ✗</span>}
                    </div>

                    {/* Date + counts */}
                    <div className="mt-auto pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1 text-xs text-slate-400 mb-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(c.date).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {c.analysis?.findings ?? 0}F · {c.analysis?.recommendations ?? 0}R
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div
                      className="flex items-center gap-1 mt-3 pt-2 border-t border-slate-100"
                      onClick={e => e.stopPropagation()}
                    >
                      <Button
                        size="sm" variant="outline"
                        className="flex-1 h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 px-1"
                        onClick={() => handleOpenReport(c.id)}
                      >
                        <Eye className="w-3 h-3 mr-1" />View
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        className="flex-1 h-7 text-xs text-slate-600 px-1"
                        onClick={() => handleOpenReport(c.id)}
                      >
                        <Edit3 className="w-3 h-3 mr-1" />Edit
                      </Button>
                      {confirmDeleteId === c.id ? (
                        <>
                          <Button
                            size="sm"
                            className="flex-1 h-7 text-xs bg-red-600 hover:bg-red-700 text-white px-1"
                            onClick={() => handleDelete(c.id)}
                          >
                            Yes
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            className="flex-1 h-7 text-xs px-1"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            No
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm" variant="outline"
                          className="h-7 w-7 p-0 text-red-400 border-red-200 hover:bg-red-50 flex-shrink-0"
                          onClick={() => setConfirmDeleteId(c.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
