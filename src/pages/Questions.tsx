import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Edit } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Question = Tables<'questions'>;

export default function Questions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form state
  const [questionText, setQuestionText] = useState('');
  const [idealAnswer, setIdealAnswer] = useState('');
  const [maxMarks, setMaxMarks] = useState('10');
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState('medium');

  const fetchQuestions = async () => {
    const { data, error } = await supabase.from('questions').select('*').order('created_at', { ascending: false });
    if (data) setQuestions(data);
    setLoading(false);
  };

  useEffect(() => { fetchQuestions(); }, []);

  const resetForm = () => {
    setQuestionText(''); setIdealAnswer(''); setMaxMarks('10'); setSubject(''); setDifficulty('medium'); setEditId(null);
  };

  const openEdit = (q: Question) => {
    setEditId(q.id);
    setQuestionText(q.question_text);
    setIdealAnswer(q.ideal_answer);
    setMaxMarks(String(q.max_marks));
    setSubject(q.subject || '');
    setDifficulty(q.difficulty || 'medium');
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const payload = {
      question_text: questionText.trim(),
      ideal_answer: idealAnswer.trim(),
      max_marks: parseFloat(maxMarks),
      subject: subject.trim() || null,
      difficulty,
      created_by: user.id,
    };

    let error;
    if (editId) {
      ({ error } = await supabase.from('questions').update(payload).eq('id', editId));
    } else {
      ({ error } = await supabase.from('questions').insert(payload));
    }

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: editId ? 'Question updated' : 'Question added' });
      setDialogOpen(false);
      resetForm();
      fetchQuestions();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Question deleted' });
      fetchQuestions();
    }
  };

  const difficultyColor = (d: string | null) => {
    if (d === 'easy') return 'bg-success/10 text-success border-success/20';
    if (d === 'hard') return 'bg-destructive/10 text-destructive border-destructive/20';
    return 'bg-warning/10 text-warning border-warning/20';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Question Bank</h1>
          <p className="text-muted-foreground mt-1">Manage questions and their ideal answers for AI evaluation.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Question</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-display">{editId ? 'Edit Question' : 'New Question'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Question Text</Label>
                <Textarea value={questionText} onChange={e => setQuestionText(e.target.value)} required rows={3} placeholder="What is polymorphism in OOP?" />
              </div>
              <div className="space-y-2">
                <Label>Ideal Answer</Label>
                <Textarea value={idealAnswer} onChange={e => setIdealAnswer(e.target.value)} required rows={6} placeholder="Polymorphism is the ability of objects to take on many forms..." />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Max Marks</Label>
                  <Input type="number" value={maxMarks} onChange={e => setMaxMarks(e.target.value)} min="1" max="100" required />
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Computer Science" />
                </div>
                <div className="space-y-2">
                  <Label>Difficulty</Label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full">{editId ? 'Update' : 'Add Question'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : questions.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground">No questions yet. Add your first question to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {questions.map(q => (
            <Card key={q.id} className="glass-card group">
              <CardContent className="py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {q.subject && <Badge variant="outline" className="text-xs">{q.subject}</Badge>}
                      <Badge variant="outline" className={`text-xs ${difficultyColor(q.difficulty)}`}>{q.difficulty}</Badge>
                      <span className="text-xs text-muted-foreground">Max: {q.max_marks} marks</span>
                    </div>
                    <p className="font-medium text-foreground">{q.question_text}</p>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{q.ideal_answer}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(q)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(q.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
