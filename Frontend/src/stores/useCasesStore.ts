// Cases Store using Zustand

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { casesApi } from '../services/api';

export interface Case {
  id: string;
  patientId: string;
  patientName: string;
  age: number;
  gender: string;
  scanType: string;
  bodyPart: string;
  clinicalHistory?: string;
  accessionNumber: string;
  referringPhysician?: string;
  status: 'PENDING' | 'REVIEWED' | 'URGENT';
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  date: string;
  time: string;
  createdAt: string;
  updatedAt: string;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  };
  analysis?: {
    id: string;
    status: string;
    summary?: string;
    findings: number;
    recommendations: number;
  };
  imageCount: number;
  images: Array<{ id: string; storageUrl: string; isPrimary: boolean }>;
}

export interface CaseAnalysis {
  id: string;
  caseId: string;
  status: string;
  modelVersion: string;
  processingTimeMs?: number;
  imageQuality?: string;
  summary?: string;
  clinicalSignificance?: string;
  keyFindings?: string[];
  analyzedAt?: string;
  createdAt: string;
  findings: Array<{
    id: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    finding: string;
    confidence: number;
    location: string;
    details?: string;
    boundingBox?: any;
  }>;
  recommendations: string[];
  heatmap?: {
    width: number;
    height: number;
    regions: Array<{ x: number; y: number; width: number; height: number; intensity: number; label: string }>;
  };
  reportSections?: {
    indication: string;
    technique: string;
    findings: string;
    impression: string;
  };
}

export interface CaseFilters {
  status?: string;
  priority?: string;
  scanType?: string;
}

interface CasesState {
  cases: Case[];
  selectedCase: Case | null;
  selectedCaseAnalysis: CaseAnalysis | null;
  filters: CaseFilters;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  statistics: {
    totalCases: number;
    pendingCases: number;
    reviewedCases: number;
    urgentCases: number;
    casesToday: number;
  } | null;
  isLoading: boolean;
  error: string | null;
}

interface CasesActions {
  fetchCases: (page?: number) => Promise<void>;
  selectCase: (caseId: string) => Promise<void>;
  updateCaseStatus: (caseId: string, status: string) => Promise<void>;
  fetchCaseAnalysis: (caseId: string) => Promise<void>;
  submitFeedback: (caseId: string, feedback: any) => Promise<void>;
  fetchStatistics: () => Promise<void>;
  createCase: (formData: FormData) => Promise<void>;
  triggerAnalysis: (caseId: string) => Promise<void>;
  deleteCase: (caseId: string) => Promise<void>;
  updateCase: (caseId: string, data: Partial<Pick<Case, 'patientName' | 'age' | 'gender' | 'scanType' | 'bodyPart' | 'clinicalHistory' | 'referringPhysician' | 'priority'>>) => Promise<void>;
  setFilters: (filters: CaseFilters) => void;
  clearError: () => void;
  clearSelectedCase: () => void;
}

export const useCasesStore = create<CasesState & CasesActions>()(
  devtools(
    (set, get) => ({
      // Initial state
      cases: [],
      selectedCase: null,
      selectedCaseAnalysis: null,
      filters: {},
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
      statistics: null,
      isLoading: false,
      error: null,

      // Actions
      fetchCases: async (page = 1) => {
        set({ isLoading: true, error: null });
        
        try {
          const { filters } = get();
          const response = await casesApi.getCases({
            ...filters,
            page,
            limit: 20,
          });

          const { data, meta } = response.data;

          set({
            cases: data,
            pagination: meta ? {
              page: meta.page ?? 1,
              limit: meta.limit ?? 20,
              total: meta.total ?? 0,
              totalPages: meta.totalPages ?? 0,
            } : get().pagination,
            isLoading: false,
            error: null,
          });
        } catch (error: any) {
          const errorMessage = error.response?.data?.error?.message || 'Failed to fetch cases';
          set({
            error: errorMessage,
            isLoading: false,
          });
        }
      },

      selectCase: async (caseId: string) => {
        // Clear stale analysis immediately so ImageViewer heatmap and AIReportPanel
        // both reset before the new case's data arrives
        set({ isLoading: true, error: null, selectedCaseAnalysis: null });
        
        try {
          const response = await casesApi.getCaseById(caseId);
          const caseData = response.data.data;

          set({
            selectedCase: caseData,
            isLoading: false,
            error: null,
          });

          // Also fetch analysis for the selected case
          get().fetchCaseAnalysis(caseId);
        } catch (error: any) {
          const errorMessage = error.response?.data?.error?.message || 'Failed to fetch case';
          set({
            error: errorMessage,
            isLoading: false,
          });
        }
      },

      updateCaseStatus: async (caseId: string, status: string) => {
        try {
          await casesApi.updateCaseStatus(caseId, status);
          
          // Update the case in the cases list
          const { cases, selectedCase } = get();
          const updatedCases = cases.map(c => 
            c.id === caseId ? { ...c, status: status as any } : c
          );
          
          set({
            cases: updatedCases,
            selectedCase: selectedCase?.id === caseId ? 
              { ...selectedCase, status: status as any } : selectedCase,
          });

          // Refetch cases to get updated data
          get().fetchCases(get().pagination.page);
        } catch (error: any) {
          const errorMessage = error.response?.data?.error?.message || 'Failed to update case status';
          set({ error: errorMessage });
          throw new Error(errorMessage);
        }
      },

      fetchCaseAnalysis: async (caseId: string) => {
        try {
          const response = await casesApi.getCaseAnalysis(caseId);
          const analysisData = response.data.data;

          set({
            selectedCaseAnalysis: analysisData,
          });
        } catch (error: any) {
          console.warn('Failed to fetch case analysis:', error);
          // Don't set error state for missing analysis
          set({ selectedCaseAnalysis: null });
        }
      },

      submitFeedback: async (caseId: string, feedback: any) => {
        try {
          await casesApi.submitFeedback(caseId, feedback);
          
          // Could refetch analysis to show updated feedback
          get().fetchCaseAnalysis(caseId);
        } catch (error: any) {
          const errorMessage = error.response?.data?.error?.message || 'Failed to submit feedback';
          set({ error: errorMessage });
          throw new Error(errorMessage);
        }
      },

      fetchStatistics: async () => {
        try {
          const response = await casesApi.getStatistics();
          const stats = response.data.data;

          set({ statistics: stats });
        } catch (error: any) {
          console.warn('Failed to fetch case statistics:', error);
          // Don't set error for non-critical stats
        }
      },

      createCase: async (formData: FormData) => {
        set({ isLoading: true, error: null });
        try {
          const response = await casesApi.createCase(formData);
          const newCaseId = response.data?.data?.id as string | undefined;
          // Refetch cases and statistics after creation
          await get().fetchCases(1);
          await get().fetchStatistics();
          // Auto-select the new case so AI analysis begins polling immediately
          if (newCaseId) {
            await get().selectCase(newCaseId);
          }
          set({ isLoading: false });
        } catch (error: any) {
          const errorMessage = error.response?.data?.error?.message || 'Failed to create case';
          set({ error: errorMessage, isLoading: false });
          throw new Error(errorMessage);
        }
      },

      triggerAnalysis: async (caseId: string) => {
        try {
          await casesApi.triggerAnalysis(caseId);
          // Start polling analysis for this case if it is currently selected
          if (get().selectedCase?.id === caseId) {
            get().fetchCaseAnalysis(caseId);
          }
        } catch (error: any) {
          const errorMessage = error.response?.data?.error?.message || 'Failed to trigger analysis';
          set({ error: errorMessage });
          throw new Error(errorMessage);
        }
      },

      deleteCase: async (caseId: string) => {
        try {
          await casesApi.deleteCase(caseId);
          // Remove from list and clear selection if it was selected
          const { cases, selectedCase } = get();
          set({
            cases: cases.filter(c => c.id !== caseId),
            selectedCase: selectedCase?.id === caseId ? null : selectedCase,
            selectedCaseAnalysis: selectedCase?.id === caseId ? null : get().selectedCaseAnalysis,
          });
          // Refresh stats
          get().fetchStatistics();
        } catch (error: any) {
          const errorMessage = error.response?.data?.error?.message || 'Failed to delete case';
          set({ error: errorMessage });
          throw new Error(errorMessage);
        }
      },

      updateCase: async (caseId, data) => {
        try {
          await casesApi.updateCase(caseId, data);
          // Patch the updated fields in the list without a full refetch
          const { cases, selectedCase } = get();
          const patch = (c: Case) => c.id === caseId ? { ...c, ...data } : c;
          set({
            cases: cases.map(patch),
            selectedCase: selectedCase?.id === caseId ? patch(selectedCase) : selectedCase,
          });
        } catch (error: any) {
          const errorMessage = error.response?.data?.error?.message || 'Failed to update case';
          set({ error: errorMessage });
          throw new Error(errorMessage);
        }
      },

      setFilters: (filters: CaseFilters) => {
        set({ filters });
        // Automatically refetch cases with new filters
        get().fetchCases(1);
      },

      clearError: () => set({ error: null }),

      clearSelectedCase: () => set({ 
        selectedCase: null, 
        selectedCaseAnalysis: null 
      }),
    }),
    {
      name: 'cases-store',
    }
  )
);