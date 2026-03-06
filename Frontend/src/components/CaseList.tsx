import { useEffect, useState } from 'react';
import { useCasesStore, Case } from '../stores/useCasesStore';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Clock, User, Calendar, RefreshCw, Brain, Pencil, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { AddPatientDialog } from './AddPatientDialog';

interface CaseListProps {
  selectedCaseId: string;
  onCaseSelect: (caseId: string) => void;
}

export function CaseList({ selectedCaseId, onCaseSelect }: CaseListProps) {
  const { 
    cases, 
    filters, 
    pagination, 
    statistics,
    isLoading, 
    error,
    fetchCases,
    setFilters,
    clearError,
    triggerAnalysis,
    deleteCase,
    updateCase,
  } = useCasesStore();

  // Delete confirmation dialog
  const [deleteTarget, setDeleteTarget] = useState<Case | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit dialog
  const [editTarget, setEditTarget] = useState<Case | null>(null);
  const [editForm, setEditForm] = useState<Partial<Case>>({});
  const [isEditing, setIsEditing] = useState(false);

  // Analyze button loading state (per-case)
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());

  // Local search & pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [localPage, setLocalPage] = useState(1);
  const CASES_PER_PAGE = 3;

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setLocalPage(1);
  }, [searchQuery]);

  useEffect(() => {
    if (error) {
      toast.error('Failed to Load Cases', {
        description: error,
        duration: 8000,
        action: {
          label: 'Retry',
          onClick: () => {
            clearError();
            fetchCases();
          },
        },
      });
    }
  }, [error, clearError, fetchCases]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'URGENT':
        return 'bg-red-500';
      case 'PENDING':
        return 'bg-blue-500';
      case 'REVIEWED':
        return 'bg-green-500';
      default:
        return 'bg-slate-300';
    }
  };

  const formatScanType = (scanType: string) => {
    return scanType.replace(/([A-Z])/g, ' $1').trim();
  };

  const formatTime = (timeString: string) => {
    try {
      // Handle both time strings and full date strings
      if (timeString.includes(':')) {
        return timeString.slice(0, 5); // Get HH:MM format
      }
      return timeString;
    } catch {
      return timeString;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const handleRefresh = () => {
    clearError();
    setSearchQuery('');
    setLocalPage(1);
    fetchCases(1);
    toast.success('Refreshed', { description: 'Case list updated' });
  };

  const handleTriggerAnalysis = async (e: React.MouseEvent, case_: Case) => {
    e.stopPropagation();
    if (analyzingIds.has(case_.id)) return;
    setAnalyzingIds(prev => new Set(prev).add(case_.id));
    try {
      await triggerAnalysis(case_.id);
      toast.success('AI Analysis Started', { description: `${case_.patientName}'s scan is being analyzed.` });
      // Auto-select so polling starts
      onCaseSelect(case_.id);
    } catch (err: any) {
      toast.error('Analysis Failed', {
        description: err?.response?.data?.error?.message || err.message || 'Could not start AI analysis. Please try again.',
      });
    } finally {
      setAnalyzingIds(prev => { const s = new Set(prev); s.delete(case_.id); return s; });
    }
  };

  const openEditDialog = (e: React.MouseEvent, case_: Case) => {
    e.stopPropagation();
    setEditTarget(case_);
    setEditForm({
      patientName: case_.patientName,
      age: case_.age,
      gender: case_.gender,
      scanType: case_.scanType,
      bodyPart: case_.bodyPart,
      clinicalHistory: case_.clinicalHistory ?? '',
      referringPhysician: case_.referringPhysician ?? '',
      priority: case_.priority,
    });
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    setIsEditing(true);
    try {
      await updateCase(editTarget.id, editForm);
      toast.success('Case Updated Successfully', {
        description: `${editForm.patientName || editTarget.patientName}'s case has been saved.`,
      });
      setEditTarget(null);
    } catch (err: any) {
      toast.error('Update Failed', {
        description: err?.response?.data?.error?.message || err.message || 'Could not save changes. Please try again.',
      });
    } finally {
      setIsEditing(false);
    }
  };

  const openDeleteDialog = (e: React.MouseEvent, case_: Case) => {
    e.stopPropagation();
    setDeleteTarget(case_);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteCase(deleteTarget.id);
      toast.success('Case Deleted', {
        description: `${deleteTarget.patientName}'s case has been permanently removed.`,
      });
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error('Delete Failed', {
        description: err?.response?.data?.error?.message || err.message || 'Could not delete this case. Please try again.',
      });
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading && cases.length === 0) {
    return (
      <div className="flex flex-col bg-slate-50 border-r border-slate-200 h-full">
        <div className="p-4 border-b border-slate-200 bg-white">
          <h2 className="text-slate-900 mb-1">Case Queue</h2>
          <p className="text-slate-500 text-sm">Loading cases...</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-slate-600">Loading cases...</p>
          </div>
        </div>
      </div>
    );
  }

  // Filter + paginate cases locally
  const filteredCases = cases.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.patientName.toLowerCase().includes(q) ||
      c.patientId.toLowerCase().includes(q) ||
      c.scanType.toLowerCase().includes(q) ||
      c.bodyPart.toLowerCase().includes(q) ||
      c.status.toLowerCase().includes(q)
    );
  });
  const totalLocalPages = Math.max(1, Math.ceil(filteredCases.length / CASES_PER_PAGE));
  const safePage = Math.min(localPage, totalLocalPages);
  const paginatedCases = filteredCases.slice((safePage - 1) * CASES_PER_PAGE, safePage * CASES_PER_PAGE);

  const list = (
    <div className="flex flex-col bg-slate-50 border-r border-slate-200 h-full">
      {/* Header */}
      <div className="p-3 border-b border-slate-200 bg-white flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-slate-900 text-sm font-semibold">Case Queue</h2>
          <div className="flex items-center gap-1">
            <AddPatientDialog />
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="text-slate-600 hover:text-slate-900 h-7 w-7 p-0"
              title="Refresh cases"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            placeholder="Search by name, ID, scan..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>
        
        <div className="flex items-center justify-between">
          <p className="text-slate-500 text-xs">
            {filteredCases.length} case{filteredCases.length !== 1 ? 's' : ''}
          </p>
          
          {statistics && (
            <div className="flex items-center gap-2">
              {statistics.urgentCases > 0 && (
                <Badge variant="destructive" className="text-xs px-1.5 py-0">
                  {statistics.urgentCases} urgent
                </Badge>
              )}
              {statistics.pendingCases > 0 && (
                <Badge variant="outline" className="text-xs px-1.5 py-0">
                  {statistics.pendingCases} pending
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Quick Filters */}
        <div className="flex items-center gap-1.5 mt-2">
          <Button
            variant={!filters.status && !filters.priority ? "default" : "outline"}
            size="xs"
            onClick={() => setFilters({})}
            className="text-xs h-6"
          >
            All
          </Button>
          <Button
            variant={filters.status === 'PENDING' ? "default" : "outline"}
            size="xs"
            onClick={() => setFilters({ status: 'PENDING' })}
            className="text-xs h-6"
          >
            Pending
          </Button>
          <Button
            variant={filters.priority === 'URGENT' ? "destructive" : "outline"}
            size="xs"
            onClick={() => setFilters({ priority: 'URGENT' })}
            className="text-xs h-6"
          >
            Urgent
          </Button>
        </div>
      </div>
      
      {/* Case List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-3">
          {paginatedCases.length === 0 && !isLoading ? (
            <div className="text-center py-8">
              <User className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-600 text-sm font-medium">{searchQuery ? 'No matching cases' : 'No cases found'}</p>
              <p className="text-slate-400 text-xs mt-1">{searchQuery ? 'Try a different search term' : 'Add a new patient to get started'}</p>
              {!searchQuery && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRefresh}
                  className="mt-3 text-xs"
                >
                  <RefreshCw className="w-3 h-3 mr-1.5" />
                  Refresh
                </Button>
              )}
            </div>
          ) : (
            paginatedCases.map((case_) => (
              <Card
                key={case_.id}
                className={`p-4 cursor-pointer transition-all hover:shadow-md border ${
                  selectedCaseId === case_.id
                    ? 'border-blue-500 bg-blue-50/70 shadow-sm ring-1 ring-blue-200'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
                onClick={() => onCaseSelect(case_.id)}
              >
                {/* Row 1: Name + Status dot */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusColor(case_.status)}`} />
                    <span className="text-sm text-slate-900 font-semibold truncate">{case_.patientName}</span>
                  </div>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${getPriorityColor(case_.priority)}`}>
                    {case_.priority}
                  </Badge>
                </div>

                {/* Row 2: Meta info */}
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-0.5">
                  <span>{case_.age}y</span>
                  <span className="text-slate-300">|</span>
                  <span>{case_.gender}</span>
                  <span className="text-slate-300">|</span>
                  <span className="truncate">{formatScanType(case_.scanType)}</span>
                  <span className="text-slate-300">|</span>
                  <span>{formatDate(case_.date)}</span>
                </div>

                {/* Row 2b: Patient ID */}
                <div className="text-[10px] text-slate-400 mb-3">
                  ID: {case_.patientId}
                </div>

                {/* Row 3: Actions + AI status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-blue-600 hover:bg-blue-50"
                      title="Analyze with AI"
                      disabled={analyzingIds.has(case_.id)}
                      onClick={e => handleTriggerAnalysis(e, case_)}
                    >
                      <Brain className={`w-3.5 h-3.5 ${analyzingIds.has(case_.id) ? 'animate-pulse' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-500 hover:bg-slate-100"
                      title="Edit case"
                      onClick={e => openEditDialog(e, case_)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-400 hover:bg-red-50"
                      title="Delete case"
                      onClick={e => openDeleteDialog(e, case_)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {case_.analysis && (
                    <div className="flex items-center gap-1.5 text-[11px] text-green-600 font-medium">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      AI Complete
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalLocalPages > 1 && (
        <div className="p-2.5 border-t border-slate-200 bg-white flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Page {safePage} of {totalLocalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setLocalPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setLocalPage(p => Math.min(totalLocalPages, p + 1))}
                disabled={safePage === totalLocalPages}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ─── Edit Dialog ───────────────────────────────────────────────────────────
  const editDialog = (
    <Dialog open={!!editTarget} onOpenChange={open => { if (!open) setEditTarget(null); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Case</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="edit-name">Patient Name</Label>
              <Input
                id="edit-name"
                value={editForm.patientName ?? ''}
                onChange={e => setEditForm(f => ({ ...f, patientName: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-age">Age</Label>
              <Input
                id="edit-age"
                type="number"
                min={0}
                max={200}
                value={editForm.age ?? ''}
                onChange={e => setEditForm(f => ({ ...f, age: parseInt(e.target.value) || undefined }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Gender</Label>
              <Select value={editForm.gender ?? ''} onValueChange={v => setEditForm(f => ({ ...f, gender: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select value={editForm.priority ?? ''} onValueChange={v => setEditForm(f => ({ ...f, priority: v as any }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-scan">Scan Type</Label>
              <Input
                id="edit-scan"
                value={editForm.scanType ?? ''}
                onChange={e => setEditForm(f => ({ ...f, scanType: e.target.value }))}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="edit-bodypart">Body Part</Label>
              <Input
                id="edit-bodypart"
                value={editForm.bodyPart ?? ''}
                onChange={e => setEditForm(f => ({ ...f, bodyPart: e.target.value }))}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="edit-history">Clinical History</Label>
              <Input
                id="edit-history"
                value={editForm.clinicalHistory ?? ''}
                onChange={e => setEditForm(f => ({ ...f, clinicalHistory: e.target.value }))}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="edit-physician">Referring Physician</Label>
              <Input
                id="edit-physician"
                value={editForm.referringPhysician ?? ''}
                onChange={e => setEditForm(f => ({ ...f, referringPhysician: e.target.value }))}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
          <Button onClick={handleEditSave} disabled={isEditing}>
            {isEditing ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ─── Delete Confirm Dialog ──────────────────────────────────────────────────
  const deleteDialog = (
    <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Case?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove the case for{' '}
            <strong>{deleteTarget?.patientName}</strong> ({deleteTarget?.patientId}).
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={handleDeleteConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <>
      {list}
      {editDialog}
      {deleteDialog}
    </>
  );
}
