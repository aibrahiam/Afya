import { useState, useRef } from 'react';
import { useCasesStore } from '../stores/useCasesStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { UserPlus, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

export function AddPatientDialog() {
  const { createCase } = useCasesStore();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    patientName: '',
    patientId: '',
    age: '',
    gender: '',
    scanType: '',
    bodyPart: '',
    clinicalHistory: '',
    referringPhysician: '',
    priority: 'NORMAL',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const resetForm = () => {
    setForm({
      patientName: '',
      patientId: '',
      age: '',
      gender: '',
      scanType: '',
      bodyPart: '',
      clinicalHistory: '',
      referringPhysician: '',
      priority: 'NORMAL',
    });
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!form.patientName || !form.patientId || !form.age || !form.gender || !form.scanType || !form.bodyPart) {
      toast.error('Please fill in all required fields');
      return;
    }

    const age = parseInt(form.age, 10);
    if (isNaN(age) || age < 0 || age > 200) {
      toast.error('Please enter a valid age');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('patientName', form.patientName);
      formData.append('patientId', form.patientId);
      formData.append('age', form.age);
      formData.append('gender', form.gender);
      formData.append('scanType', form.scanType);
      formData.append('bodyPart', form.bodyPart);
      formData.append('priority', form.priority);
      if (form.clinicalHistory) formData.append('clinicalHistory', form.clinicalHistory);
      if (form.referringPhysician) formData.append('referringPhysician', form.referringPhysician);
      if (selectedFile) formData.append('image', selectedFile);

      await createCase(formData);
      toast.success('Patient case created successfully');
      resetForm();
      setOpen(false);
    } catch {
      toast.error('Failed to create patient case');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
          <UserPlus className="w-4 h-4 mr-1.5" />
          Add Patient
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Patient Case</DialogTitle>
          <DialogDescription>
            Enter patient details and upload a medical image. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Patient Name & ID */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="patientName">Patient Name *</Label>
              <Input
                id="patientName"
                placeholder="Full name"
                value={form.patientName}
                onChange={(e) => updateField('patientName', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="patientId">Patient ID *</Label>
              <Input
                id="patientId"
                placeholder="e.g. PAT-001"
                value={form.patientId}
                onChange={(e) => updateField('patientId', e.target.value)}
              />
            </div>
          </div>

          {/* Age, Gender & Priority */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="age">Age *</Label>
              <Input
                id="age"
                type="number"
                min={0}
                max={200}
                placeholder="Age"
                value={form.age}
                onChange={(e) => updateField('age', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Gender *</Label>
              <Select value={form.gender} onValueChange={(v) => updateField('gender', v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => updateField('priority', v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Normal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ROUTINE">Routine</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Scan Type & Body Part */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Scan Type *</Label>
              <Select value={form.scanType} onValueChange={(v) => updateField('scanType', v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select scan type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="XRay">X-Ray</SelectItem>
                  <SelectItem value="CT">CT Scan</SelectItem>
                  <SelectItem value="MRI">MRI</SelectItem>
                  <SelectItem value="Ultrasound">Ultrasound</SelectItem>
                  <SelectItem value="Mammogram">Mammogram</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Body Part *</Label>
              <Select value={form.bodyPart} onValueChange={(v) => updateField('bodyPart', v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select body part" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Chest">Chest</SelectItem>
                  <SelectItem value="Head">Head</SelectItem>
                  <SelectItem value="Abdomen">Abdomen</SelectItem>
                  <SelectItem value="Spine">Spine</SelectItem>
                  <SelectItem value="Extremities">Extremities</SelectItem>
                  <SelectItem value="Pelvis">Pelvis</SelectItem>
                  <SelectItem value="Breast">Breast</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Referring Physician */}
          <div className="space-y-1.5">
            <Label htmlFor="referringPhysician">Referring Physician</Label>
            <Input
              id="referringPhysician"
              placeholder="Dr. Name"
              value={form.referringPhysician}
              onChange={(e) => updateField('referringPhysician', e.target.value)}
            />
          </div>

          {/* Clinical History */}
          <div className="space-y-1.5">
            <Label htmlFor="clinicalHistory">Clinical History</Label>
            <textarea
              id="clinicalHistory"
              rows={2}
              placeholder="Brief clinical history or reason for exam..."
              value={form.clinicalHistory}
              onChange={(e) => updateField('clinicalHistory', e.target.value)}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          {/* Image Upload */}
          <div className="space-y-1.5">
            <Label>Medical Image</Label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
              {selectedFile ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Upload className="w-4 h-4 text-blue-500" />
                    <span className="truncate max-w-[300px]">{selectedFile.name}</span>
                    <span className="text-slate-400">
                      ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleRemoveFile}>
                    <X className="w-4 h-4 text-slate-500" />
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">Click to upload or drag and drop</p>
                  <p className="text-xs text-slate-400 mt-1">DICOM, JPEG, PNG, WebP (max 50MB)</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".dcm,.jpg,.jpeg,.png,.webp,application/dicom,image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSubmitting ? 'Creating...' : 'Create Case'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
