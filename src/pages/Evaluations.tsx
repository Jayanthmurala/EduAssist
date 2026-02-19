import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Play, Eye, Loader2, Star, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

interface AnswerWithQuestion {
  id: string;
  student_name: string | null;
  image_path: string;
  ocr_text: string | null;
  ocr_confidence: number | null;
  question_id: string;
  uploaded_at: string | null;
  questions: { question_text: string; ideal_answer: string; max_marks: number } | null;
  evaluations: {
    id: string;
    marks: number | null;
    final_score: number | null;
    explanation: string | null;
    strengths: string | null;
    weaknesses: string | null;
    missing_concepts: string[] | null;
    suggestions: string | null;
    similarity_score: number | null;
    concept_coverage: number | null;
  }[] | null;
}

export default function Evaluations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [answers, setAnswers] = useState<AnswerWithQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<AnswerWithQuestion | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [teacherScore, setTeacherScore] = useState('');
  const [teacherFeedback, setTeacherFeedback] = useState('');
  const [ocrDialogOpen, setOcrDialogOpen] = useState(false);
  const [editingOcr, setEditingOcr] = useState('');
  const [ocrTarget, setOcrTarget] = useState<AnswerWithQuestion | null>(null);

  const fetchAnswers = async () => {
    const { data, error } = await supabase
      .from('student_answers')
      .select('*, questions(question_text, ideal_answer, max_marks), evaluations(*)')
      .order('uploaded_at', { ascending: false });

    if (data) setAnswers(data as unknown as AnswerWithQuestion[]);
    setLoading(false);
  };

  useEffect(() => { fetchAnswers(); }, []);

  const evaluate = async (answer: AnswerWithQuestion) => {
    if (!user) return;
    setEvaluating(answer.id);

    try {
      // Get a signed URL for the image to pass to the AI
      const { data: signedUrl } = await supabase.storage
        .from('answer-images')
        .createSignedUrl(answer.image_path, 300);

      const { data, error } = await supabase.functions.invoke('evaluate-answer', {
        body: {
          answerId: answer.id,
          questionText: answer.questions?.question_text,
          idealAnswer: answer.questions?.ideal_answer,
          maxMarks: answer.questions?.max_marks,
          ocrText: answer.ocr_text,
          imageUrl: signedUrl?.signedUrl,
        },
      });

      if (error) throw error;
      toast({ title: 'Evaluation complete!' });
      fetchAnswers();
    } catch (err: any) {
      const errorMessage = err.message || '';
      if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
        toast({
          title: 'AI System Busy (Rate Limit)',
          description: 'Gemini Free Tier limit reached. Please wait 1 minute before trying again.',
          variant: 'destructive'
        });
      } else {
        toast({ title: 'Evaluation failed', description: errorMessage, variant: 'destructive' });
      }
    } finally {
      setEvaluating(null);
    }
  };

  const saveOcr = async () => {
    if (!ocrTarget) return;
    const { error } = await supabase
      .from('student_answers')
      .update({ ocr_text: editingOcr, ocr_confidence: 1.0 }) // Set to 1.0 because teacher corrected it
      .eq('id', ocrTarget.id);

    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'OCR corrected' });
      setOcrDialogOpen(false);
      fetchAnswers();
    }
  };

  const submitFeedback = async () => {
    if (!user || !selectedAnswer) return;
    const evaluation = selectedAnswer.evaluations?.[0];
    if (!evaluation) return;

    const { error } = await supabase.from('feedback').insert({
      evaluation_id: evaluation.id,
      teacher_id: user.id,
      teacher_score: teacherScore ? parseFloat(teacherScore) : null,
      teacher_feedback: teacherFeedback.trim() || null,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Feedback submitted' });
      setFeedbackOpen(false);
      setTeacherScore('');
      setTeacherFeedback('');
    }
  };

  const getImageUrl = (path: string) => {
    const { data } = supabase.storage.from('answer-images').getPublicUrl(path);
    return data.publicUrl;
  };

  const scoreColor = (score: number | null, max: number) => {
    if (score === null) return '';
    const pct = score / max;
    if (pct >= 0.7) return 'text-success';
    if (pct >= 0.4) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Evaluations</h1>
        <p className="text-muted-foreground mt-1">View uploaded answers, run AI evaluation, and review results.</p>
      </div>

      {loading ? (
        <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : answers.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-16 text-center text-muted-foreground">
            No answers uploaded yet. Go to Upload Answers to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {answers.map(answer => {
            const evaluation = answer.evaluations?.[0];
            const hasEval = !!evaluation;
            return (
              <Card key={answer.id} className="glass-card">
                <CardContent className="py-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {answer.student_name && <span className="font-medium text-foreground">{answer.student_name}</span>}
                        {hasEval ? (
                          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                            <CheckCircle2 className="h-3 w-3 mr-1" />Evaluated
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground">Pending Evaluation</Badge>
                        )}
                        {answer.ocr_text && (
                          <Badge
                            variant="outline"
                            className={answer.ocr_confidence && answer.ocr_confidence < 0.7
                              ? "bg-destructive/10 text-destructive border-destructive/20 cursor-pointer"
                              : "bg-primary/10 text-primary border-primary/20 cursor-pointer"}
                            onClick={() => { setOcrTarget(answer); setEditingOcr(answer.ocr_text || ''); setOcrDialogOpen(true); }}
                          >
                            <AlertCircle className="h-3 w-3 mr-1" />
                            OCR: {answer.ocr_confidence ? (answer.ocr_confidence * 100).toFixed(0) : '??'}%
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{answer.questions?.question_text}</p>
                      {hasEval && (
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className={`font-bold text-lg ${scoreColor(evaluation.marks, answer.questions?.max_marks || 10)}`}>
                            {evaluation.marks?.toFixed(1)} / {answer.questions?.max_marks}
                          </span>
                          {evaluation.similarity_score !== null && (
                            <span className="text-muted-foreground">Similarity: {(evaluation.similarity_score * 100).toFixed(0)}%</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {hasEval && (
                        <Button variant="outline" size="sm" onClick={() => { setSelectedAnswer(answer); }}>
                          <Eye className="h-4 w-4 mr-1" />View
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={hasEval ? 'outline' : 'default'}
                        onClick={() => evaluate(answer)}
                        disabled={evaluating === answer.id}
                      >
                        {evaluating === answer.id ? (
                          <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Evaluating...</>
                        ) : (
                          <><Play className="h-4 w-4 mr-1" />{hasEval ? 'Re-evaluate' : 'Evaluate'}</>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Evaluation detail dialog */}
      <Dialog open={!!selectedAnswer} onOpenChange={(v) => { if (!v) setSelectedAnswer(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedAnswer && selectedAnswer.evaluations?.[0] && (() => {
            const ev = selectedAnswer.evaluations![0];
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="font-display">Evaluation Details</DialogTitle>
                </DialogHeader>
                <div className="space-y-5">
                  <div>
                    <Label className="text-xs text-muted-foreground">Question</Label>
                    <p className="font-medium">{selectedAnswer.questions?.question_text}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <Card className="glass-card">
                      <CardContent className="py-3 text-center">
                        <div className={`text-2xl font-bold ${scoreColor(ev.marks, selectedAnswer.questions?.max_marks || 10)}`}>
                          {ev.marks?.toFixed(1)}
                        </div>
                        <div className="text-xs text-muted-foreground">/ {selectedAnswer.questions?.max_marks} marks</div>
                      </CardContent>
                    </Card>
                    <Card className="glass-card">
                      <CardContent className="py-3 text-center">
                        <div className="text-2xl font-bold text-primary">{ev.similarity_score ? (ev.similarity_score * 100).toFixed(0) : '—'}%</div>
                        <div className="text-xs text-muted-foreground">Similarity</div>
                      </CardContent>
                    </Card>
                    <Card className="glass-card">
                      <CardContent className="py-3 text-center">
                        <div className="text-2xl font-bold text-secondary">{ev.concept_coverage ? (ev.concept_coverage * 100).toFixed(0) : '—'}%</div>
                        <div className="text-xs text-muted-foreground">Coverage</div>
                      </CardContent>
                    </Card>
                  </div>

                  {ev.explanation && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Overall Assessment</Label>
                      <p className="text-sm mt-1">{ev.explanation}</p>
                    </div>
                  )}

                  {ev.strengths && (
                    <div>
                      <Label className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" />Strengths</Label>
                      <p className="text-sm mt-1">{ev.strengths}</p>
                    </div>
                  )}

                  {ev.weaknesses && (
                    <div>
                      <Label className="text-xs text-muted-foreground flex items-center gap-1"><AlertCircle className="h-3 w-3 text-warning" />Areas for Improvement</Label>
                      <p className="text-sm mt-1">{ev.weaknesses}</p>
                    </div>
                  )}

                  {ev.missing_concepts && ev.missing_concepts.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground flex items-center gap-1"><XCircle className="h-3 w-3 text-destructive" />Missing Concepts</Label>
                      <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                        {ev.missing_concepts.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    </div>
                  )}

                  {ev.suggestions && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Suggestions</Label>
                      <p className="text-sm mt-1">{ev.suggestions}</p>
                    </div>
                  )}

                  <div className="border-t border-border pt-4">
                    <Button variant="outline" onClick={() => { setFeedbackOpen(true); }}>
                      <Star className="h-4 w-4 mr-2" />Provide Feedback
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Feedback dialog */}
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Teacher Feedback</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Your Score (optional)</Label>
              <Input type="number" value={teacherScore} onChange={e => setTeacherScore(e.target.value)} placeholder="Override AI score" min="0" max={String(selectedAnswer?.questions?.max_marks || 10)} />
            </div>
            <div className="space-y-2">
              <Label>Feedback</Label>
              <Textarea value={teacherFeedback} onChange={e => setTeacherFeedback(e.target.value)} rows={4} placeholder="What did the AI get right or wrong?" />
            </div>
            <Button onClick={submitFeedback} className="w-full">Submit Feedback</Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* OCR Correction dialog */}
      <Dialog open={ocrDialogOpen} onOpenChange={setOcrDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Correct OCR Extraction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg overflow-hidden border border-border">
              {ocrTarget && (
                <img src={getImageUrl(ocrTarget.image_path)} alt="Student Answer" className="w-full h-48 object-contain bg-muted" />
              )}
            </div>
            <div className="space-y-2">
              <Label>Extracted Text</Label>
              <Textarea
                value={editingOcr}
                onChange={e => setEditingOcr(e.target.value)}
                rows={8}
                placeholder="Correct the OCR text here..."
                className="font-mono text-sm"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setOcrDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveOcr}>Save Correction</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
