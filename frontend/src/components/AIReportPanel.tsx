import { useState, useEffect, useRef } from 'react';
import { useCasesStore } from '../stores/useCasesStore';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Textarea } from './ui/textarea';
import { Alert } from './ui/alert';
import { 
  Brain, 
  AlertTriangle, 
  CheckCircle2, 
  ThumbsUp, 
  ThumbsDown, 
  Edit3,
  Lock,
  Shield,
  Download,
  Loader2,
  Save,
  X,
  FileEdit,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';

interface AIReportPanelProps {
  caseId: string;
}

export function AIReportPanel({ caseId }: AIReportPanelProps) {
  const { 
    selectedCase, 
    selectedCaseAnalysis, 
    updateCaseStatus, 
    submitFeedback,
    fetchCaseAnalysis,
    triggerAnalysis
  } = useCasesStore();
  
  const [isEditing, setIsEditing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [isRetriggering, setIsRetriggering] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nullPollCountRef = useRef(0);
  const [analysisTimedOut, setAnalysisTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingStartRef = useRef<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Edit Report state
  const [isEditingReport, setIsEditingReport] = useState(false);
  const [editedSections, setEditedSections] = useState({
    indication: '',
    technique: '',
    findings: '',
    impression: '',
  });

  const openEditReport = () => {
    setEditedSections({
      indication: selectedCaseAnalysis?.reportSections?.indication ||
        selectedCase?.clinicalHistory || 'Clinical indication not provided.',
      technique: selectedCaseAnalysis?.reportSections?.technique ||
        `${selectedCase?.scanType || ''} of ${selectedCase?.bodyPart || ''} performed.`,
      findings: selectedCaseAnalysis?.reportSections?.findings ||
        (selectedCaseAnalysis?.findings.map(f => `${f.location}: ${f.details || f.finding}`).join('\n\n') || 'No findings.'),
      impression: selectedCaseAnalysis?.reportSections?.impression ||
        selectedCaseAnalysis?.summary || 'No acute findings.',
    });
    setIsEditingReport(true);
  };

  const handleExportReport = () => {
    if (!selectedCase || !selectedCaseAnalysis) return;
    const sections = isEditingReport ? editedSections : {
      indication: selectedCaseAnalysis.reportSections?.indication || selectedCase.clinicalHistory || 'Not provided',
      technique: selectedCaseAnalysis.reportSections?.technique || `${selectedCase.scanType} of ${selectedCase.bodyPart}`,
      findings: selectedCaseAnalysis.reportSections?.findings ||
        selectedCaseAnalysis.findings.map(f => `${f.location}: ${f.details || f.finding}`).join('\n\n'),
      impression: selectedCaseAnalysis.reportSections?.impression || selectedCaseAnalysis.summary || '',
    };
    const date = new Date();
    const dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Radiology Report – ${esc(selectedCase.patientId)}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Times New Roman',serif;font-size:11pt;color:#111;background:#fff;padding:1.8cm 2cm;max-width:21cm;margin:0 auto}.hdr{text-align:center;border-bottom:2.5px solid #111;padding-bottom:10px;margin-bottom:14px}.hdr .sub{font-size:9pt;color:#444;letter-spacing:.05em;margin-bottom:4px}.hdr h1{font-size:17pt;font-weight:bold;letter-spacing:.03em}.meta{display:grid;grid-template-columns:1fr 1fr;column-gap:24px;row-gap:3px;margin:12px 0 16px;font-size:10pt}.meta-row{display:flex;gap:5px}.ml{font-weight:bold}hr{border:none;border-top:1px solid #888;margin:12px 0}.sec{margin-bottom:16px}.sh{font-size:11pt;font-weight:bold;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;padding-bottom:3px;border-bottom:1px solid #ccc}.sb{font-size:10.5pt;line-height:1.65;white-space:pre-wrap}.ftr{margin-top:28px;border-top:1px solid #aaa;padding-top:8px;font-size:8.5pt;color:#555;text-align:center;line-height:1.6}.conf{display:inline-block;border:1px solid #666;padding:1px 8px;letter-spacing:.08em;margin-bottom:5px;font-size:8pt}@media print{body{padding:0}@page{margin:1.8cm 2cm}}</style></head><body><div class="hdr"><div class="sub">AfyaDX AI-Assisted Diagnostic Platform</div><h1>RADIOLOGY REPORT</h1></div><div class="meta"><div class="meta-row"><span class="ml">Patient ID:</span><span>${esc(selectedCase.patientId)}</span></div><div class="meta-row"><span class="ml">Date:</span><span>${dateStr}</span></div><div class="meta-row"><span class="ml">Accession:</span><span>${esc(selectedCase.accessionNumber)}</span></div><div class="meta-row"><span class="ml">Time:</span><span>${timeStr}</span></div><div class="meta-row"><span class="ml">AI Model:</span><span>${esc(selectedCaseAnalysis.modelVersion)}</span></div></div><hr><div class="sec"><div class="sh">Indication</div><div class="sb">${esc(sections.indication)}</div></div><div class="sec"><div class="sh">Technique</div><div class="sb">${esc(sections.technique)}</div></div><div class="sec"><div class="sh">Findings</div><div class="sb">${esc(sections.findings)}</div></div><div class="sec"><div class="sh">Impression</div><div class="sb">${esc(sections.impression)}</div></div><div class="ftr"><div class="conf">CONFIDENTIAL</div><br>AI-generated report — requires radiologist verification before clinical use.<br>AfyaDX Diagnostic Platform · ${dateStr} ${timeStr}</div><script>window.onload=function(){window.print()}<\/script></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) toast.error('Allow pop-ups to export as PDF');
    else toast.success('Report opened — use Print → Save as PDF');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  useEffect(() => {
    if (caseId && caseId !== selectedCaseAnalysis?.caseId) {
      fetchCaseAnalysis(caseId);
    }
  }, [caseId, selectedCaseAnalysis?.caseId, fetchCaseAnalysis]);

  // Reset null-poll counter and timeout when caseId changes
  useEffect(() => {
    nullPollCountRef.current = 0;
    setAnalysisTimedOut(false);
    setElapsedSeconds(0);
    pollingStartRef.current = null;
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  }, [caseId]);

  // Poll while analysis is queued or processing, with 90s timeout
  useEffect(() => {
    const status = selectedCaseAnalysis?.status;
    const isInProgress = status === 'QUEUED' || status === 'PROCESSING';
    const shouldPollNull = !selectedCaseAnalysis && nullPollCountRef.current < 5;
    const shouldPoll = (isInProgress || shouldPollNull) && !analysisTimedOut;

    if (caseId && shouldPoll) {
      // Start the 90s timeout timer & elapsed counter when entering polling
      if (!pollingStartRef.current) {
        pollingStartRef.current = Date.now();
        setElapsedSeconds(0);

        timeoutRef.current = setTimeout(() => {
          // Stop polling, show timeout message
          if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
          if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
          setAnalysisTimedOut(true);
        }, 90_000);

        tickRef.current = setInterval(() => {
          if (pollingStartRef.current) {
            setElapsedSeconds(Math.floor((Date.now() - pollingStartRef.current) / 1000));
          }
        }, 1000);
      }

      fetchCaseAnalysis(caseId);
      pollingRef.current = setInterval(() => {
        if (!selectedCaseAnalysis) nullPollCountRef.current += 1;
        if (!selectedCaseAnalysis && nullPollCountRef.current >= 5) {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          return;
        }
        fetchCaseAnalysis(caseId);
      }, 5000);
    } else {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    }

    // Clear timeout & tick when analysis completes
    if (status === 'COMPLETED' || status === 'FAILED') {
      pollingStartRef.current = null;
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    }

    return () => {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    };
  }, [caseId, selectedCaseAnalysis?.status, selectedCaseAnalysis, fetchCaseAnalysis, analysisTimedOut]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'MEDIUM':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'LOW':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const handleFeedbackSubmit = async (rating: 'accurate' | 'needs_review' | 'incorrect') => {
    if (!selectedCaseAnalysis) return;

    setIsSubmittingFeedback(true);
    try {
      await submitFeedback(caseId, {
        rating,
        correctionText: feedback || undefined,
      });
      
      setFeedbackSubmitted(true);
      toast.success('Feedback submitted successfully');
      
      setTimeout(() => {
        setFeedbackSubmitted(false);
        setFeedback('');
        setIsEditing(false);
      }, 2000);
    } catch (error: any) {
      toast.error('Failed to submit feedback', {
        description: error.message,
      });
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleStatusUpdate = async (status: 'PENDING' | 'REVIEWED' | 'URGENT') => {
    try {
      await updateCaseStatus(caseId, status);
      toast.success(`Case status updated to ${status}`);
    } catch (error: any) {
      toast.error('Failed to update case status', {
        description: error.message,
      });
    }
  };

  if (!selectedCase) {
    return (
      <div className="flex flex-col bg-white border-l border-slate-200 h-full">
        <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white">
          <h2 className="text-slate-900">Select a Case</h2>
          <p className="text-slate-600 text-sm">Choose a case from the list to view AI analysis</p>
        </div>
      </div>
    );
  }

  const analysisStatus = selectedCaseAnalysis?.status;

  // Timeout state — show friendly error with retry
  if (analysisTimedOut && analysisStatus !== 'COMPLETED') {
    return (
      <div className="flex flex-col bg-white border-l border-slate-200 h-full">
        <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-amber-50 to-white">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <h2 className="text-slate-900">Analysis Timed Out</h2>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3 px-6">
            <Clock className="w-10 h-10 text-amber-500 mx-auto" />
            <p className="text-slate-700 text-sm font-medium">Analysis is taking longer than expected</p>
            <p className="text-slate-500 text-xs max-w-[220px] mx-auto">
              The AI service didn&apos;t respond within 90 seconds. This can happen during high demand.
            </p>
            <Button
              size="sm"
              disabled={isRetriggering}
              className="mt-2 bg-blue-600 text-white hover:bg-blue-700"
              onClick={async () => {
                setIsRetriggering(true);
                setAnalysisTimedOut(false);
                pollingStartRef.current = null;
                nullPollCountRef.current = 0;
                try {
                  await triggerAnalysis(caseId);
                  fetchCaseAnalysis(caseId);
                } catch { /* store handles error */ }
                setIsRetriggering(false);
              }}
            >
              {isRetriggering ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Brain className="w-3.5 h-3.5 mr-1.5" />}
              Retry Analysis
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // No analysis record exists and we've stopped polling — show "Run Analysis" prompt
  if (!selectedCaseAnalysis && nullPollCountRef.current >= 5) {
    return (
      <div className="flex flex-col bg-white border-l border-slate-200 h-full">
        <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-600" />
            <h2 className="text-slate-900">AI Analysis</h2>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3 px-4">
            <Brain className="w-10 h-10 text-slate-400 mx-auto" />
            <p className="text-slate-600 text-sm">No AI analysis has been run for this case yet.</p>
            <Button
              size="sm"
              disabled={isRetriggering}
              className="mt-2 bg-blue-600 text-white hover:bg-blue-700"
              onClick={async () => {
                setIsRetriggering(true);
                try {
                  await triggerAnalysis(caseId);
                  nullPollCountRef.current = 0; // reset so polling restarts
                  fetchCaseAnalysis(caseId);
                } catch { /* store already sets error */ }
                setIsRetriggering(false);
              }}
            >
              {isRetriggering ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Brain className="w-3.5 h-3.5 mr-1.5" />}
              Run AI Analysis
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedCaseAnalysis || analysisStatus === 'QUEUED' || analysisStatus === 'PROCESSING') {
    // Animated progress steps
    const steps = [
      { label: 'Queued for analysis', threshold: 0 },
      { label: 'Processing image', threshold: 10 },
      { label: 'Analyzing with Gemini AI', threshold: 25 },
      { label: 'Generating diagnostic report', threshold: 55 },
      { label: 'Finalizing results', threshold: 75 },
    ];
    const currentStep = [...steps].reverse().find(s => elapsedSeconds >= s.threshold) ?? steps[0];
    // Progress bar fills smoothly up to ~95% over 90 seconds
    const progressPercent = Math.min(95, Math.round((elapsedSeconds / 90) * 95));

    return (
      <div className="flex flex-col bg-white border-l border-slate-200 h-full">
        <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-blue-600" />
              <h2 className="text-slate-900">AI Analysis</h2>
            </div>
            {analysisStatus && (
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                {analysisStatus}
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-5 px-6 w-full max-w-xs">
            <div className="relative w-14 h-14 mx-auto">
              <Brain className="w-14 h-14 text-blue-100" />
              <Brain className="w-14 h-14 text-blue-600 absolute inset-0 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-medium text-slate-900 mb-1">{currentStep.label}</h3>
              <p className="text-slate-500 text-xs">
                Patient {selectedCase.patientId} &middot; {selectedCase.scanType}
              </p>
            </div>

            {/* Progress bar */}
            <div className="w-full space-y-1.5">
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>{elapsedSeconds}s elapsed</span>
                <span>{progressPercent}%</span>
              </div>
            </div>

            {/* Step indicators */}
            <div className="flex justify-center gap-1.5">
              {steps.map((s, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors duration-500 ${
                    elapsedSeconds >= s.threshold ? 'bg-blue-600' : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>

            <p className="text-slate-400 text-[10px]">Auto-refreshing every 5 seconds</p>
          </div>
        </div>
      </div>
    );
  }

  if (analysisStatus === 'FAILED') {
    return (
      <div className="flex flex-col bg-white border-l border-slate-200 h-full">
        <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-red-50 to-white">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-red-600" />
            <h2 className="text-slate-900">AI Analysis Failed</h2>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3 px-4">
            <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
            <p className="text-slate-600 text-sm">The AI analysis could not be completed for this case.</p>
            <p className="text-slate-400 text-xs">Ensure your Gemini API key is set in <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">backend/.env</code> and restart the server.</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 text-blue-600 border-blue-300 hover:bg-blue-50"
              onClick={() => {
                setAnalysisTimedOut(false);
                pollingStartRef.current = null;
                nullPollCountRef.current = 0;
                triggerAnalysis(caseId).catch(() => {});
                fetchCaseAnalysis(caseId);
              }}
            >
              <Brain className="w-3.5 h-3.5 mr-1.5" />
              Retry Analysis
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col bg-white border-l border-slate-200 h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white flex-shrink-0 z-10">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-600" />
            <h2 className="text-slate-900">AI Diagnostic Report</h2>
          </div>
          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {selectedCaseAnalysis.status === 'COMPLETED' ? 'Completed' : selectedCaseAnalysis.status}
          </Badge>
        </div>
        
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" />
            <span>HIPAA Compliant</span>
          </div>
          <div className="flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" />
            <span>End-to-End Encrypted</span>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4 pb-20">
          {/* AI Summary */}
          {selectedCaseAnalysis.summary && (
            <Card className="p-4 bg-blue-50 border-blue-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="text-blue-900 mb-1">AI Assessment Summary</h3>
                  <p className="text-sm text-blue-800">{selectedCaseAnalysis.summary}</p>
                </div>
              </div>
            </Card>
          )}

          {/* Key Findings */}
          {selectedCaseAnalysis.findings.length > 0 && (
            <div>
              <h3 className="text-slate-900 mb-3">Key Findings ({selectedCaseAnalysis.findings.length})</h3>
              <div className="space-y-3">
                {selectedCaseAnalysis.findings.map((finding) => (
                  <Card key={finding.id} className="p-3 border-slate-200 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getSeverityColor(finding.severity)}`}
                      >
                        {finding.severity}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-600 rounded-full"
                            style={{ width: `${finding.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 ml-1">
                          {Math.round(finding.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                    
                    <h4 className="text-slate-900 mb-1">{finding.finding}</h4>
                    <p className="text-xs text-slate-500 mb-2">
                      <strong>Location:</strong> {finding.location}
                    </p>
                    {finding.details && (
                      <p className="text-sm text-slate-600">{finding.details}</p>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {selectedCaseAnalysis.recommendations.length > 0 && (
            <div>
              <h3 className="text-slate-900 mb-3">AI Recommendations</h3>
              <Card className="p-3 border-slate-200">
                <ul className="space-y-2 text-sm text-slate-700">
                  {selectedCaseAnalysis.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}

          {/* Technical Details */}
          <div>
            <h3 className="text-slate-900 mb-3">Technical Details</h3>
            <Card className="p-3 border-slate-200 bg-slate-50">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500">AI Model:</span>
                  <p className="text-slate-700">{selectedCaseAnalysis.modelVersion}</p>
                </div>
                {selectedCaseAnalysis.processingTimeMs && (
                  <div>
                    <span className="text-slate-500">Processing Time:</span>
                    <p className="text-slate-700">{(selectedCaseAnalysis.processingTimeMs / 1000).toFixed(1)}s</p>
                  </div>
                )}
                {selectedCaseAnalysis.imageQuality && (
                  <div>
                    <span className="text-slate-500">Image Quality:</span>
                    <p className="text-slate-700 capitalize">{selectedCaseAnalysis.imageQuality}</p>
                  </div>
                )}
                <div>
                  <span className="text-slate-500">Analysis Date:</span>
                  <p className="text-slate-700">
                    {selectedCaseAnalysis.analyzedAt 
                      ? new Date(selectedCaseAnalysis.analyzedAt).toLocaleString()
                      : 'N/A'
                    }
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Feedback Section */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-slate-900">Radiologist Feedback</h3>
              {!isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                >
                  <Edit3 className="w-3.5 h-3.5 mr-1" />
                  Add Feedback
                </Button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-3">
                <Textarea
                  placeholder="Provide feedback or corrections to the AI diagnosis..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="min-h-24 text-sm"
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleFeedbackSubmit('accurate')}
                    disabled={isSubmittingFeedback}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <ThumbsUp className="w-3.5 h-3.5 mr-1" />
                    Accurate
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleFeedbackSubmit('needs_review')}
                    disabled={isSubmittingFeedback}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1" />
                    Needs Review
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleFeedbackSubmit('incorrect')}
                    disabled={isSubmittingFeedback}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <ThumbsDown className="w-3.5 h-3.5 mr-1" />
                    Incorrect
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEditing(false);
                      setFeedback('');
                    }}
                    disabled={isSubmittingFeedback}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFeedbackSubmit('accurate')}
                  className="text-green-600 border-green-300 hover:bg-green-50"
                  disabled={isSubmittingFeedback}
                >
                  <ThumbsUp className="w-4 h-4 mr-1" />
                  Accurate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  <ThumbsDown className="w-4 h-4 mr-1" />
                  Needs Review
                </Button>
              </div>
            )}

            {feedbackSubmitted && (
              <Alert className="mt-3 bg-green-50 border-green-200 text-green-800">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm">Feedback submitted successfully. Thank you for improving our AI!</span>
              </Alert>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-200 space-y-2">
            {selectedCase.status === 'PENDING' && (
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => handleStatusUpdate('REVIEWED')}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Mark as Reviewed
              </Button>
            )}
            
            {selectedCase.status === 'REVIEWED' && (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => handleStatusUpdate('PENDING')}
              >
                Reopen Case
              </Button>
            )}

            {/* Edit Report button */}
            <Button
              variant="outline"
              className="w-full text-blue-700 border-blue-300 hover:bg-blue-50"
              onClick={openEditReport}
            >
              <FileEdit className="w-4 h-4 mr-2" />
              Edit Report
            </Button>

            <Button variant="outline" className="w-full" onClick={handleExportReport}>
              <Download className="w-4 h-4 mr-2" />
              Export as PDF
            </Button>
          </div>
        </div>
      </ScrollArea>

      {/* ── Edit Report Overlay ── */}
      {isEditingReport && (
        <div className="absolute inset-0 bg-white flex flex-col z-20">
          <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white flex-shrink-0">
            <div className="flex items-center gap-2">
              <FileEdit className="w-5 h-5 text-blue-600" />
              <h2 className="text-slate-900">Edit Report</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  setIsEditingReport(false);
                  toast.success('Report saved');
                }}
              >
                <Save className="w-3.5 h-3.5 mr-1" />
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditingReport(false)}
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {([
                { id: 'indication', label: 'Indication', placeholder: 'Enter clinical indication...' },
                { id: 'technique', label: 'Technique', placeholder: 'Describe the technique...' },
                { id: 'findings', label: 'Findings', placeholder: 'Describe imaging findings...' },
                { id: 'impression', label: 'Impression', placeholder: 'Provide conclusion/impression...' },
              ] as const).map(section => (
                <div key={section.id}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {section.label}
                  </label>
                  <Textarea
                    value={editedSections[section.id]}
                    onChange={e => setEditedSections(prev => ({ ...prev, [section.id]: e.target.value }))}
                    placeholder={section.placeholder}
                    className="text-sm min-h-[90px] resize-none"
                    rows={section.id === 'findings' ? 6 : 3}
                  />
                </div>
              ))}
              <Button
                className="w-full bg-slate-700 hover:bg-slate-800 text-white"
                onClick={() => {
                  setIsEditingReport(false);
                  handleExportReport();
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Save &amp; Export as PDF
              </Button>
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
