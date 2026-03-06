import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import {
  FileText,
  Search,
  Star,
  StarOff,
  ChevronRight,
  CheckCircle2,
  Clock,
  Download,
  Send,
  Edit3,
  RotateCcw,
  Copy,
  Printer,
  BookOpen,
  Stethoscope,
  Brain,
  Wind,
  Activity,
  FlaskConical,
  Plus,
  X,
  Save,
  AlertCircle
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Template {
  id: string;
  name: string;
  category: string;
  scanType: string;
  description: string;
  tags: string[];
  isFavorite: boolean;
  lastUsed?: string;
  sections: ReportSection[];
}

interface ReportSection {
  id: string;
  label: string;
  content: string;
  placeholder: string;
}

interface Category {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  count: number;
}

// ─── Template Data ────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  { id: 'all', label: 'All Templates', icon: BookOpen, color: 'text-slate-600', count: 0 },
  { id: 'chest-xray', label: 'Chest X-Ray', icon: Wind, color: 'text-blue-600', count: 0 },
  { id: 'ct-thorax', label: 'CT Thorax', icon: Activity, color: 'text-purple-600', count: 0 },
  { id: 'ct-abdomen', label: 'CT Abdomen', icon: FlaskConical, color: 'text-orange-600', count: 0 },
  { id: 'mri-brain', label: 'MRI Brain', icon: Brain, color: 'text-green-600', count: 0 },
  { id: 'favorites', label: 'Favorites', icon: Star, color: 'text-yellow-500', count: 0 },
];

const TEMPLATES: Template[] = [
  // ── Chest X-Ray ──
  {
    id: 'cxr-normal',
    name: 'Normal Chest X-Ray',
    category: 'chest-xray',
    scanType: 'X-Ray',
    description: 'Standard template for a normal chest radiograph with no acute findings.',
    tags: ['Normal', 'Routine'],
    isFavorite: false,
    sections: [
      { id: 'indication', label: 'Indication', placeholder: 'Enter clinical indication...', content: 'Routine chest radiograph.' },
      { id: 'technique', label: 'Technique', placeholder: 'Describe the technique...', content: 'PA and lateral chest radiograph obtained in good inspiratory effort.' },
      { id: 'findings', label: 'Findings', placeholder: 'Describe imaging findings...', content: 'The lungs are clear bilaterally without evidence of focal consolidation, pleural effusion, or pneumothorax.\n\nThe cardiomediastinal silhouette is within normal limits. The heart size is normal. The mediastinal contours are unremarkable.\n\nThe osseous structures are intact. No acute osseous abnormality identified.\n\nSoft tissues are unremarkable.' },
      { id: 'impression', label: 'Impression', placeholder: 'Provide conclusion/impression...', content: 'No acute cardiopulmonary abnormality.' },
    ],
  },
  {
    id: 'cxr-pneumonia',
    name: 'Pneumonia',
    category: 'chest-xray',
    scanType: 'X-Ray',
    description: 'Template for lobar or bronchopneumonia pattern on chest X-ray.',
    tags: ['Abnormal', 'Infection'],
    isFavorite: false,
    sections: [
      { id: 'indication', label: 'Indication', placeholder: 'Enter clinical indication...', content: 'Fever, cough, shortness of breath. Rule out pneumonia.' },
      { id: 'technique', label: 'Technique', placeholder: 'Describe the technique...', content: 'PA and lateral chest radiograph.' },
      { id: 'findings', label: 'Findings', placeholder: 'Describe imaging findings...', content: 'There is [right/left] [upper/middle/lower] lobe consolidation with [air bronchograms]. The contralateral lung is clear.\n\nNo pleural effusion identified on this study.\n\nThe heart size is normal. The mediastinal contours are unremarkable.\n\nOsseous structures are intact.' },
      { id: 'impression', label: 'Impression', placeholder: 'Provide conclusion/impression...', content: '1. [Right/Left] [upper/middle/lower] lobe pneumonia.\n2. Clinical correlation and follow-up radiograph recommended after treatment to confirm resolution.' },
    ],
  },
  {
    id: 'cxr-pleural-effusion',
    name: 'Pleural Effusion',
    category: 'chest-xray',
    scanType: 'X-Ray',
    description: 'Template for unilateral or bilateral pleural effusion findings.',
    tags: ['Abnormal', 'Effusion'],
    isFavorite: false,
    sections: [
      { id: 'indication', label: 'Indication', placeholder: 'Enter clinical indication...', content: 'Dyspnea and decreased breath sounds. Evaluate for pleural effusion.' },
      { id: 'technique', label: 'Technique', placeholder: 'Describe the technique...', content: 'PA and lateral chest radiograph. Comparison made with prior study dated [DATE].' },
      { id: 'findings', label: 'Findings', placeholder: 'Describe imaging findings...', content: 'There is a [small/moderate/large] [right/left/bilateral] pleural effusion with blunting of the [right/left] costophrenic angle.\n\nThere is [no/mild/moderate] associated compressive atelectasis at the [right/left] base.\n\nThe remaining lung fields are clear.\n\nThe cardiac silhouette is [normal/mildly enlarged]. Mediastinal contours are unremarkable.' },
      { id: 'impression', label: 'Impression', placeholder: 'Provide conclusion/impression...', content: '1. [Small/Moderate/Large] [right/left/bilateral] pleural effusion.\n2. [No/Mild] associated compressive atelectasis.\n3. [Findings are new/increased/decreased] compared to prior study.' },
    ],
  },
  {
    id: 'cxr-cardiomegaly',
    name: 'Cardiomegaly',
    category: 'chest-xray',
    scanType: 'X-Ray',
    description: 'Template for enlarged cardiac silhouette with or without pulmonary vascular congestion.',
    tags: ['Abnormal', 'Cardiac'],
    isFavorite: false,
    sections: [
      { id: 'indication', label: 'Indication', placeholder: 'Enter clinical indication...', content: 'Known heart failure. Evaluate for cardiomegaly and pulmonary edema.' },
      { id: 'technique', label: 'Technique', placeholder: 'Describe the technique...', content: 'AP portable chest radiograph. Limited study.' },
      { id: 'findings', label: 'Findings', placeholder: 'Describe imaging findings...', content: 'The cardiac silhouette is [mildly/moderately/markedly] enlarged with a cardiothoracic ratio of approximately [VALUE].\n\nThere is [no/mild/moderate/severe] pulmonary vascular congestion. [No/Trace/Small/Moderate] bilateral pleural effusions noted.\n\nThe lungs demonstrate [clear fields / interstitial edema / alveolar edema].\n\nThe bony thorax is intact.' },
      { id: 'impression', label: 'Impression', placeholder: 'Provide conclusion/impression...', content: '1. [Mild/Moderate/Marked] cardiomegaly.\n2. [No acute / Mild / Moderate] pulmonary edema.\n3. Recommend clinical correlation with echocardiogram for further evaluation.' },
    ],
  },
  // ── CT Thorax ──
  {
    id: 'ct-thorax-normal',
    name: 'Normal CT Thorax',
    category: 'ct-thorax',
    scanType: 'CT Scan',
    description: 'Template for a normal CT of the chest without contrast.',
    tags: ['Normal', 'Routine'],
    isFavorite: false,
    sections: [
      { id: 'indication', label: 'Indication', placeholder: 'Enter clinical indication...', content: 'Persistent cough. Rule out pulmonary pathology.' },
      { id: 'technique', label: 'Technique', placeholder: 'Describe the technique...', content: 'CT chest performed [with/without] IV contrast in [supine] position. Multiplanar reconstructions performed. DLP: [VALUE] mGy·cm.' },
      { id: 'findings', label: 'Findings', placeholder: 'Describe imaging findings...', content: 'Lungs: The lungs are clear. No focal consolidation, ground-glass opacity, mass, or nodule identified. No pleural effusion or pneumothorax.\n\nAirways: The central airways are patent. No bronchiectasis.\n\nPleura: No pleural thickening or effusion.\n\nMediastinum: Normal mediastinal contours. No mediastinal lymphadenopathy (no node > 1 cm short axis).\n\nHeart and great vessels: Heart size is normal. The aorta is normal in caliber.\n\nChest wall and bones: No acute osseous abnormality. Soft tissues are unremarkable.\n\nAbdominal organs (limited views): Partially imaged upper abdominal organs appear unremarkable.' },
      { id: 'impression', label: 'Impression', placeholder: 'Provide conclusion/impression...', content: 'No acute intrathoracic abnormality identified on CT chest.' },
    ],
  },
  {
    id: 'ct-pulmonary-embolism',
    name: 'Pulmonary Embolism (CTPA)',
    category: 'ct-thorax',
    scanType: 'CT Scan',
    description: 'Template for CT pulmonary angiography findings with pulmonary emboli.',
    tags: ['Abnormal', 'Urgent', 'Vascular'],
    isFavorite: false,
    sections: [
      { id: 'indication', label: 'Indication', placeholder: 'Enter clinical indication...', content: 'Acute onset dyspnea and pleuritic chest pain. Rule out pulmonary embolism.' },
      { id: 'technique', label: 'Technique', placeholder: 'Describe the technique...', content: 'CT pulmonary angiography performed with IV iodinated contrast. Bolus tracking used with adequate pulmonary arterial enhancement (HU > 200). DLP: [VALUE] mGy·cm.' },
      { id: 'findings', label: 'Findings', placeholder: 'Describe imaging findings...', content: 'Pulmonary vasculature: Filling defects are identified within the [right/left/bilateral] [main/lobar/segmental/subsegmental] pulmonary arteries, consistent with acute pulmonary emboli.\n\nRight heart: The right ventricle to left ventricle ratio is [VALUE] ([normal <1 / >1 suggesting right heart strain]).\n\nLungs: [No / Wedge-shaped] pulmonary infarct(s) identified in the [location].\n\nPleura: [No / Trace] pleural effusion.\n\nDeep veins (if assessed): [Not assessed on this study].' },
      { id: 'impression', label: 'Impression', placeholder: 'Provide conclusion/impression...', content: '1. Acute [saddle/bilateral/right/left] pulmonary embolism.\n2. [No / Evidence of] right heart strain.\n3. Urgent clinical management recommended. Suggest anticoagulation therapy and hematology consultation.' },
    ],
  },
  {
    id: 'ct-lung-mass',
    name: 'Lung Mass / Nodule',
    category: 'ct-thorax',
    scanType: 'CT Scan',
    description: 'Template for solitary pulmonary nodule or lung mass characterization.',
    tags: ['Abnormal', 'Oncology'],
    isFavorite: false,
    sections: [
      { id: 'indication', label: 'Indication', placeholder: 'Enter clinical indication...', content: 'Incidental lung nodule on prior chest X-ray. Further characterization.' },
      { id: 'technique', label: 'Technique', placeholder: 'Describe the technique...', content: 'High-resolution CT chest with and without IV contrast. Thin-slice (1 mm) reconstructions in axial, coronal, and sagittal planes.' },
      { id: 'findings', label: 'Findings', placeholder: 'Describe imaging findings...', content: 'Pulmonary nodule/mass: A [solid/part-solid/ground-glass] [nodule/mass] measuring [VALUE] cm is identified in the [right/left] [upper/middle/lower] lobe [location description]. Margins are [smooth/spiculated/lobulated]. [No/Calcification] [No/Satellite nodules].\n\nRemainder of lungs: [No / Additional nodules]. No consolidation or ground-glass opacity.\n\nMediastinum: [No / Enlarged] mediastinal or hilar lymphadenopathy.\n\nPleura: [No] pleural effusion or thickening.\n\nLung-RADS score: [1–4X] – [Benign/Probably benign/Suspicious/Very suspicious].' },
      { id: 'impression', label: 'Impression', placeholder: 'Provide conclusion/impression...', content: '1. [Solid/Part-solid] [nodule/mass] in [location], measuring [VALUE] cm. Lung-RADS [score].\n2. Recommend [12-month follow-up CT / PET-CT / tissue biopsy] per Fleischner Society guidelines.\n3. Clinical correlation with smoking history and oncology consultation recommended.' },
    ],
  },
  // ── CT Abdomen ──
  {
    id: 'ct-abdomen-normal',
    name: 'Normal CT Abdomen & Pelvis',
    category: 'ct-abdomen',
    scanType: 'CT Scan',
    description: 'Template for a normal CT of the abdomen and pelvis.',
    tags: ['Normal', 'Routine'],
    isFavorite: false,
    sections: [
      { id: 'indication', label: 'Indication', placeholder: 'Enter clinical indication...', content: 'Abdominal pain. Rule out acute abdominal pathology.' },
      { id: 'technique', label: 'Technique', placeholder: 'Describe the technique...', content: 'CT abdomen and pelvis performed with IV and oral contrast in portal venous phase. Coronal and sagittal reconstructions provided.' },
      { id: 'findings', label: 'Findings', placeholder: 'Describe imaging findings...', content: 'Liver: Normal size and attenuation. No focal lesion.\nGallbladder: Normal. No cholelithiasis or wall thickening.\nBile ducts: Not dilated.\nPancreas: Normal morphology. No ductal dilation.\nSpleen: Normal size and attenuation.\nAdrenal glands: Normal bilaterally.\nKidneys: Normal size and enhancement bilaterally. No hydronephrosis or calculi.\nBladder: Normal.\nBowel: No bowel obstruction or wall thickening. Appendix is visualized and normal.\nVascular: Aorta normal caliber.\nLymph nodes: No lymphadenopathy.\nBones: No acute osseous abnormality.' },
      { id: 'impression', label: 'Impression', placeholder: 'Provide conclusion/impression...', content: 'No acute abnormality identified in the abdomen and pelvis.' },
    ],
  },
  {
    id: 'ct-appendicitis',
    name: 'Appendicitis',
    category: 'ct-abdomen',
    scanType: 'CT Scan',
    description: 'Template for acute appendicitis findings on CT abdomen.',
    tags: ['Abnormal', 'Urgent', 'Surgical'],
    isFavorite: false,
    sections: [
      { id: 'indication', label: 'Indication', placeholder: 'Enter clinical indication...', content: 'Right lower quadrant pain, elevated WBC. Rule out appendicitis.' },
      { id: 'technique', label: 'Technique', placeholder: 'Describe the technique...', content: 'CT abdomen and pelvis with IV contrast. Oral contrast not administered due to urgent presentation.' },
      { id: 'findings', label: 'Findings', placeholder: 'Describe imaging findings...', content: 'Appendix: The appendix is visualized and measures [VALUE] cm in diameter (normal < 6 mm). There is [periappendiceal fat stranding / appendicolith / pericecal free fluid].\n\n[No / Perforation with extraluminal gas and/or abscess formation].\n\nRemainder of abdomen: No bowel obstruction. No free intraperitoneal air. Remaining abdominal organs are unremarkable.' },
      { id: 'impression', label: 'Impression', placeholder: 'Provide conclusion/impression...', content: '1. Findings consistent with acute appendicitis.\n2. [No / Suspected] perforation.\n3. Urgent surgical consultation recommended.' },
    ],
  },
  {
    id: 'ct-bowel-obstruction',
    name: 'Bowel Obstruction',
    category: 'ct-abdomen',
    scanType: 'CT Scan',
    description: 'Template for small or large bowel obstruction on CT.',
    tags: ['Abnormal', 'Urgent', 'Surgical'],
    isFavorite: false,
    sections: [
      { id: 'indication', label: 'Indication', placeholder: 'Enter clinical indication...', content: 'Abdominal distension, vomiting, and obstipation. Rule out bowel obstruction.' },
      { id: 'technique', label: 'Technique', placeholder: 'Describe the technique...', content: 'CT abdomen and pelvis with IV contrast.' },
      { id: 'findings', label: 'Findings', placeholder: 'Describe imaging findings...', content: '[Small/Large] bowel: There is [mild/moderate/severe] dilation of the [small/large] bowel measuring up to [VALUE] cm. A transition point is identified at [location].\n\nCause: [Adhesion / Hernia / Mass] is the suspected cause.\n\nClosed-loop / strangulation: [No / Possible] signs of strangulation (loss of wall enhancement, pneumatosis, mesenteric venous gas).\n\nFree fluid / air: [No / Small] amount of free fluid. No free intraperitoneal air.' },
      { id: 'impression', label: 'Impression', placeholder: 'Provide conclusion/impression...', content: '1. [High-grade / Low-grade] [small/large] bowel obstruction.\n2. [No / Suspected] strangulation.\n3. Surgical or gastroenterology consultation recommended.' },
    ],
  },
  // ── MRI Brain ──
  {
    id: 'mri-brain-normal',
    name: 'Normal MRI Brain',
    category: 'mri-brain',
    scanType: 'MRI',
    description: 'Template for a normal MRI of the brain with standard sequences.',
    tags: ['Normal', 'Routine'],
    isFavorite: false,
    sections: [
      { id: 'indication', label: 'Indication', placeholder: 'Enter clinical indication...', content: 'Headache. Rule out intracranial pathology.' },
      { id: 'technique', label: 'Technique', placeholder: 'Describe the technique...', content: 'MRI brain performed with and without gadolinium contrast. Sequences include: axial T1, T2, FLAIR, DWI, ADC, and T1 post-contrast. No contraindications noted.' },
      { id: 'findings', label: 'Findings', placeholder: 'Describe imaging findings...', content: 'Brain parenchyma: No diffusion restriction to suggest acute ischemia. No intracranial hemorrhage. No focal white matter signal abnormality. Gray-white differentiation preserved.\n\nVentricles: Normal size and configuration. No hydrocephalus.\n\nExtra-axial spaces: No extra-axial collection or midline shift.\n\nPost-contrast: No abnormal parenchymal or meningeal enhancement.\n\nCerebellum and brainstem: Unremarkable.\n\nVascular flow voids: Present and symmetric.' },
      { id: 'impression', label: 'Impression', placeholder: 'Provide conclusion/impression...', content: 'No acute intracranial abnormality on MRI brain with and without contrast.' },
    ],
  },
  {
    id: 'mri-brain-stroke',
    name: 'Acute Ischemic Stroke',
    category: 'mri-brain',
    scanType: 'MRI',
    description: 'Template for acute ischemic stroke findings on brain MRI.',
    tags: ['Abnormal', 'Urgent', 'Neurology'],
    isFavorite: false,
    sections: [
      { id: 'indication', label: 'Indication', placeholder: 'Enter clinical indication...', content: 'Acute onset left-sided weakness and facial droop. Rule out acute stroke. Code Stroke activation.' },
      { id: 'technique', label: 'Technique', placeholder: 'Describe the technique...', content: 'Emergent MRI brain without contrast with DWI/ADC sequences. MRA of the head and neck also performed.' },
      { id: 'findings', label: 'Findings', placeholder: 'Describe imaging findings...', content: 'DWI/ADC: Acute diffusion restriction identified in the [right/left] [territory: MCA/ACA/PCA/posterior fossa] territory involving the [location: cortex/basal ganglia/thalamus] measuring approximately [VALUE] cm.\n\nFLAIR: [No / Subtle] corresponding FLAIR signal change (suggesting [hyperacute/acute] timing).\n\nHemorrhage: No hemorrhagic transformation identified.\n\nMass effect: [No / Mild] mass effect or midline shift.\n\nMRA: [Patent / Occlusion of] the [vessel] identified.' },
      { id: 'impression', label: 'Impression', placeholder: 'Provide conclusion/impression...', content: '1. Acute ischemic infarct in the [right/left] [territory] territory.\n2. [No hemorrhagic transformation].\n3. [Vessel occlusion / No occlusion] on MRA.\n4. Immediate neurology consultation. Consider IV tPA / mechanical thrombectomy per stroke protocol.' },
    ],
  },
];

// ─── Helper utils ─────────────────────────────────────────────────────────────

const getScanTypeBadgeColor = (scanType: string) => {
  switch (scanType) {
    case 'X-Ray': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'CT Scan': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'MRI': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-slate-100 text-slate-600 border-slate-200';
  }
};

const getTagColor = (tag: string) => {
  if (tag === 'Normal') return 'bg-green-100 text-green-700';
  if (tag === 'Abnormal') return 'bg-red-100 text-red-700';
  if (tag === 'Urgent') return 'bg-red-100 text-red-700';
  if (tag === 'Routine') return 'bg-slate-100 text-slate-600';
  return 'bg-slate-100 text-slate-600';
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ReportTemplates() {
  const [templates, setTemplates] = useState<Template[]>(TEMPLATES);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [editedSections, setEditedSections] = useState<ReportSection[]>([]);
  const [reportStatus, setReportStatus] = useState<'draft' | 'final'>('draft');
  const [saved, setSaved] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [patientInfo, setPatientInfo] = useState({
    name: '',
    id: '',
    dob: '',
    orderingPhysician: '',
    referralDate: '',
    accessionNo: '',
  });

  const filteredTemplates = templates.filter((t) => {
    const matchesCategory =
      selectedCategory === 'all' ||
      t.category === selectedCategory ||
      (selectedCategory === 'favorites' && t.isFavorite);
    const matchesSearch =
      searchQuery === '' ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setEditedSections(template.sections.map((s) => ({ ...s })));
    setReportStatus('draft');
    setSaved(false);
    setFinalized(false);
  };

  const handleSectionChange = (sectionId: string, newContent: string) => {
    setEditedSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, content: newContent } : s))
    );
    setSaved(false);
  };

  const handleToggleFavorite = (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTemplates((prev) =>
      prev.map((t) => (t.id === templateId ? { ...t, isFavorite: !t.isFavorite } : t))
    );
  };

  const handleSaveDraft = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleFinalize = () => {
    setReportStatus('final');
    setFinalized(true);
  };

  const handleResetSection = (sectionId: string) => {
    if (!selectedTemplate) return;
    const original = selectedTemplate.sections.find((s) => s.id === sectionId);
    if (original) handleSectionChange(sectionId, original.content);
  };

  const categoryCount = (catId: string) => {
    if (catId === 'all') return templates.length;
    if (catId === 'favorites') return templates.filter((t) => t.isFavorite).length;
    return templates.filter((t) => t.category === catId).length;
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">
      {/* ── Top Bar: Header + Search + Categories ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {selectedTemplate && (
              <button
                onClick={() => setSelectedTemplate(null)}
                className="mr-2 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
            )}
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="text-slate-900">Report Templates</h2>
          </div>
          {!selectedTemplate && (
            <div className="relative" style={{ width: 260 }}>
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search templates..."
                className="pl-9 h-9 text-sm bg-slate-50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
          )}
        </div>

        {/* Categories (horizontal) */}
        {!selectedTemplate && (
          <div className="flex items-center gap-2 flex-wrap">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : cat.color}`} />
                  <span>{cat.label}</span>
                  <span className={`text-xs ml-1 ${isActive ? 'text-blue-500' : 'text-slate-400'}`}>
                    {categoryCount(cat.id)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      {selectedTemplate ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Report Header */}
          <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-slate-900">{selectedTemplate.name}</h2>
                <Badge
                  variant="outline"
                  className={getScanTypeBadgeColor(selectedTemplate.scanType)}
                >
                  {selectedTemplate.scanType}
                </Badge>
                <Badge
                  variant="outline"
                  className={reportStatus === 'final'
                    ? 'bg-green-100 text-green-800 border-green-200'
                    : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                  }
                >
                  {reportStatus === 'final' ? (
                    <><CheckCircle2 className="w-3 h-3 mr-1" />Finalized</>
                  ) : (
                    <><Edit3 className="w-3 h-3 mr-1" />Draft</>
                  )}
                </Badge>
              </div>
              <p className="text-sm text-slate-500">{selectedTemplate.description}</p>
            </div>

            <div className="flex items-center gap-2">
              {saved && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                </span>
              )}
              <Button variant="outline" size="sm" onClick={handleSaveDraft}>
                <Save className="w-4 h-4 mr-1.5" />
                Save Draft
              </Button>
              <Button variant="outline" size="sm">
                <Printer className="w-4 h-4 mr-1.5" />
                Print
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-1.5" />
                Export PDF
              </Button>
              {reportStatus !== 'final' && (
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleFinalize}
                >
                  <Send className="w-4 h-4 mr-1.5" />
                  Finalize Report
                </Button>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6 max-w-5xl mx-auto">
              {finalized && (
                <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-green-900 text-sm">Report finalized and signed by Dr. Sarah Chen on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.</p>
                    <p className="text-green-700 text-xs mt-0.5">This report has been locked. Contact the department to request an amendment.</p>
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
                  {[
                    { label: 'Patient Name', key: 'name', value: patientInfo.name },
                    { label: 'Patient ID', key: 'id', value: patientInfo.id },
                    { label: 'Date of Birth', key: 'dob', value: patientInfo.dob },
                    { label: 'Ordering Physician', key: 'orderingPhysician', value: patientInfo.orderingPhysician },
                    { label: 'Referral Date', key: 'referralDate', value: patientInfo.referralDate },
                    { label: 'Accession No.', key: 'accessionNo', value: patientInfo.accessionNo },
                  ].map(({ label, key, value }) => (
                    <div key={key}>
                      <p className="text-xs text-slate-400 mb-1">{label}</p>
                      <Input
                        value={value}
                        onChange={(e) =>
                          setPatientInfo((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className="h-8 text-sm"
                        disabled={reportStatus === 'final'}
                      />
                    </div>
                  ))}
                </div>
              </Card>

              {/* Report Sections */}
              {editedSections.map((section, idx) => (
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
                          variant="ghost"
                          size="sm"
                          className="text-slate-400 hover:text-slate-600 h-7 px-2"
                          onClick={() => handleResetSection(section.id)}
                          title="Reset to template default"
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" />
                          <span className="text-xs">Reset</span>
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="p-4">
                    <Textarea
                      value={section.content}
                      onChange={(e) => handleSectionChange(section.id, e.target.value)}
                      placeholder={section.placeholder}
                      className="min-h-32 text-sm resize-none leading-relaxed"
                      disabled={reportStatus === 'final'}
                    />
                    {section.content.includes('[') && reportStatus !== 'final' && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Fill in all bracketed placeholders [ ] before finalizing.</span>
                      </div>
                    )}
                  </div>
                </Card>
              ))}

              {/* Report Footer */}
              <Card className="border-slate-200 bg-slate-50">
                <div className="p-4 flex items-center justify-between text-sm text-slate-500">
                  <div className="flex items-center gap-4">
                    <span>Reporting Radiologist: <strong className="text-slate-700">Dr. Sarah Chen</strong></span>
                    <Separator orientation="vertical" className="h-4" />
                    <span>AI Model: <strong className="text-slate-700">RadNet-v4.2</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Report ID: <strong className="text-slate-700">RPT-{selectedTemplate.id.toUpperCase()}-{Date.now().toString().slice(-5)}</strong></span>
                  </div>
                </div>
              </Card>
            </div>
          </ScrollArea>
        </div>
      ) : (
        /* ── Template Grid (5 cards per row) ── */
        <ScrollArea className="flex-1">
          <div className="p-6">
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No templates found</p>
              </div>
            ) : (
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
                {filteredTemplates.map((template) => (
                  <Card
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className="p-4 cursor-pointer transition-all hover:shadow-md border-slate-200 bg-white hover:border-blue-300 flex flex-col"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm text-slate-800 leading-snug flex-1 mr-2">
                        {template.name}
                      </p>
                      <button
                        onClick={(e) => handleToggleFavorite(template.id, e)}
                        className="text-slate-300 hover:text-yellow-500 transition-colors flex-shrink-0"
                      >
                        {template.isFavorite
                          ? <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                          : <StarOff className="w-3.5 h-3.5" />
                        }
                      </button>
                    </div>

                    <p className="text-xs text-slate-500 mb-3 line-clamp-2" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {template.description}
                    </p>

                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      <Badge variant="outline" className={`text-xs py-0 ${getScanTypeBadgeColor(template.scanType)}`}>
                        {template.scanType}
                      </Badge>
                      {template.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className={`text-xs px-1.5 py-0.5 rounded ${getTagColor(tag)}`}>
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="mt-auto pt-2 border-t border-slate-100 flex items-center gap-1 text-xs text-slate-400">
                      {template.lastUsed ? (
                        <>
                          <Clock className="w-3 h-3" />
                          <span>Used {template.lastUsed}</span>
                        </>
                      ) : (
                        <span>{template.sections.length} sections</span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
