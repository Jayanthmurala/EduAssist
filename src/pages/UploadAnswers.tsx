import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, Image as ImageIcon, Loader2, X, Wand2 } from 'lucide-react';
import { preprocessImage } from '@/lib/image-utils';
import type { Tables } from '@/integrations/supabase/types';

type Question = Tables<'questions'>;

export default function UploadAnswers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState('');
  const [studentName, setStudentName] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);
  const [shouldPreprocess, setShouldPreprocess] = useState(true);

  useEffect(() => {
    supabase.from('questions').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setQuestions(data); });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []).filter(
      f => ['image/jpeg', 'image/png', 'application/pdf'].includes(f.type) && f.size <= 10 * 1024 * 1024
    );
    if (newFiles.length !== (e.target.files?.length || 0)) {
      toast({ title: 'Some files skipped', description: 'Only JPG, PNG, PDF under 10MB accepted.', variant: 'destructive' });
    }
    setFiles(prev => [...prev, ...newFiles]);
    newFiles.forEach(f => {
      if (f.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => setPreviews(prev => [...prev, ev.target?.result as string]);
        reader.readAsDataURL(f);
      } else {
        setPreviews(prev => [...prev, '']);
      }
    });
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (!user || !selectedQuestion || files.length === 0) return;
    setUploading(true);

    let uploaded = 0;
    for (const file of files) {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: storageError } = await supabase.storage.from('answer-images').upload(path, file);
      if (storageError) {
        toast({ title: 'Upload failed', description: storageError.message, variant: 'destructive' });
        continue;
      }

      const { error: dbError, data: answerData } = await supabase.from('student_answers').insert({
        question_id: selectedQuestion,
        student_name: studentName.trim() || null,
        image_path: path,
        uploaded_by: user.id,
      }).select().single();

      if (dbError) {
        toast({ title: 'Save failed', description: dbError.message, variant: 'destructive' });
      } else if (answerData) {
        uploaded++;
        // Trigger OCR process automatically
        const { data: signedUrl } = await supabase.storage.from('answer-images').createSignedUrl(path, 300);
        if (signedUrl) {
          supabase.functions.invoke('process-ocr', {
            body: { answerId: answerData.id, imageUrl: signedUrl.signedUrl }
          });
        }
      }
    }

    toast({ title: `${uploaded} answer${uploaded > 1 ? 's' : ''} uploaded`, description: 'OCR processing started in background.' });
    setFiles([]);
    setPreviews([]);
    setStudentName('');
    setUploading(false);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl font-bold">Upload Answers</h1>
        <p className="text-muted-foreground mt-1">Upload handwritten student answer images for AI evaluation.</p>
      </div>

      <Card className="glass-card">
        <CardContent className="py-6 space-y-5">
          <div className="space-y-2">
            <Label>Select Question</Label>
            <Select value={selectedQuestion} onValueChange={setSelectedQuestion}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a question..." />
              </SelectTrigger>
              <SelectContent>
                {questions.map(q => (
                  <SelectItem key={q.id} value={q.id}>
                    <span className="truncate">{q.question_text}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Student Name (optional)</Label>
            <Input value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="John Doe" />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="preprocess"
              checked={shouldPreprocess}
              onChange={(e) => setShouldPreprocess(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
            />
            <Label htmlFor="preprocess" className="flex items-center gap-1.5 cursor-pointer">
              <Wand2 className="h-3.5 w-3.5 text-secondary" />
              Auto-enhance image (Grayscale & Contrast)
            </Label>
          </div>

          <div className="space-y-2">
            <Label>Answer Images</Label>
            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Click to select or drag files here</span>
              <span className="text-xs text-muted-foreground mt-1">JPG, PNG, PDF · Max 10MB · Up to 50 files</span>
              <input type="file" className="hidden" accept="image/jpeg,image/png,application/pdf" multiple onChange={handleFileChange} />
            </label>
          </div>

          {files.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {files.map((file, idx) => (
                <div key={idx} className="relative group rounded-lg overflow-hidden border border-border bg-muted">
                  {previews[idx] ? (
                    <img src={previews[idx]} alt="" className="w-full h-28 object-cover" />
                  ) : (
                    <div className="w-full h-28 flex items-center justify-center text-xs text-muted-foreground">PDF</div>
                  )}
                  <button
                    onClick={() => removeFile(idx)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-foreground/60 text-background opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <div className="px-2 py-1 text-xs truncate text-muted-foreground">{file.name}</div>
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={async () => {
              setUploading(true);
              const processedFiles = [];
              for (const f of files) {
                if (shouldPreprocess && f.type.startsWith('image/')) {
                  processedFiles.push(await preprocessImage(f));
                } else {
                  processedFiles.push(f);
                }
              }
              setFiles(processedFiles);
              handleUpload();
            }}
            disabled={!selectedQuestion || files.length === 0 || uploading}
            className="w-full"
          >
            {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing & Uploading...</> : `Upload ${files.length || ''} Answer${files.length > 1 ? 's' : ''}`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
