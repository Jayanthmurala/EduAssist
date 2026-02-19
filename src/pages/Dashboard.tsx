import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Upload, FileCheck, TrendingUp, AlertCircle, CheckCircle2, History } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';

interface Stats {
  questions: number;
  answers: number;
  evaluations: number;
  avgScore: number | null;
  avgConfidence: number | null;
  scoreDistribution: { range: string; count: number }[];
  confidenceTrend: { name: string; confidence: number }[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    questions: 0,
    answers: 0,
    evaluations: 0,
    avgScore: null,
    avgConfidence: null,
    scoreDistribution: [],
    confidenceTrend: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      // Use the optimized SQL function for performance (FR-12)
      const { data, error } = await supabase.rpc('get_dashboard_stats');

      if (error) {
        console.error('Failed to load dashboard stats:', error);
        setLoading(false);
        return;
      }

      // Transform raw SQL result into chart format
      if (!data || data.length === 0) {
        setLoading(false);
        return;
      }
      const result = data[0];

      const distributionMap = new Map();
      ['0-2', '2-4', '4-6', '6-8', '8-10'].forEach(r => distributionMap.set(r, 0));
      ((result.score_distribution as any[]) || []).forEach((d: any) => distributionMap.set(d.range, d.count));

      const dist = Array.from(distributionMap.entries()).map(([range, count]) => ({ range, count }));

      const trend = ((result.confidence_trend as any[]) || []).map((t: any, i: number) => ({
        name: `A${i + 1}`,
        confidence: Math.round(Number(t.confidence || 0) * 100),
      })).reverse(); // Show oldest to newest

      setStats({
        questions: result.total_questions || 0,
        answers: result.total_answers || 0,
        evaluations: result.total_evaluations || 0,
        avgScore: result.avg_score || 0,
        avgConfidence: result.avg_ocr_confidence || 0,
        scoreDistribution: dist,
        confidenceTrend: trend
      });
      setLoading(false);
    }
    load();
  }, [user]);

  const cards = [
    { label: 'Total Questions', value: stats.questions, icon: BookOpen, color: 'text-primary' },
    { label: 'Answers Logged', value: stats.answers, icon: Upload, color: 'text-secondary' },
    { label: 'Evaluations Done', value: stats.evaluations, icon: FileCheck, color: 'text-success' },
    { label: 'OCR Reliability', value: stats.avgConfidence !== null ? `${(stats.avgConfidence * 100).toFixed(0)}%` : '—', icon: AlertCircle, color: 'text-warning' },
  ];

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe'];

  return (
    <div className="space-y-8 pb-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">Research-grade insights into student performance and AI accuracy.</p>
        </div>
        <div className="hidden sm:block text-right">
          <p className="text-xs text-muted-foreground">Session Performance</p>
          <p className="text-xl font-bold text-success">Optimal</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map(card => (
          <Card key={card.label} className="glass-card overflow-hidden relative">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {loading ? <span className="animate-pulse">...</span> : card.value}
              </div>
            </CardContent>
            <div className={`absolute bottom-0 left-0 h-1 w-full bg-current opacity-20 ${card.color}`} />
          </Card>
        ))}
      </div>

      {/* RAG Reference Library Upload Section */}
      <Card className="glass-card mt-6">
        <CardHeader>
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Reference Library (Textbook Context)
          </CardTitle>
          <p className="text-sm text-muted-foreground">Upload textbook chapters or notes. The AI will search this material to verify student answers.</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <textarea
              id="rag-text"
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
              placeholder="Paste textbook chapter content or lecture notes here..."
            />
            <div className="flex justify-end">
              <button
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 gap-2"
                onClick={async () => {
                  const items = (document.getElementById('rag-text') as HTMLTextAreaElement);
                  const text = items.value;
                  if (!text) return alert("Please enter text");

                  // Simple loading state
                  const btn = document.activeElement as HTMLButtonElement;
                  const originalText = btn.innerText;
                  btn.innerText = "Indexing...";
                  btn.disabled = true;

                  try {
                    const { error } = await supabase.functions.invoke('ingest-document', {
                      body: { title: "Teacher Notes " + new Date().toLocaleDateString(), textContent: text }
                    });
                    if (error) throw error;
                    alert("Reference material uploaded & indexed! The AI will now use this for grading.");
                    items.value = "";
                  } catch (e: any) {
                    alert("Upload failed: " + e.message);
                  } finally {
                    btn.innerText = originalText;
                    btn.disabled = false;
                  }
                }}
              >
                <Upload className="w-4 h-4" />
                Upload Context
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg font-display">Score Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.scoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="range" stroke="#888" fontSize={12} />
                <YAxis stroke="#888" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg font-display">OCR Confidence Trend (Recent)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.confidenceTrend}>
                <defs>
                  <linearGradient id="colorConf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" hide />
                <YAxis domain={[0, 100]} stroke="#888" fontSize={12} />
                <Tooltip />
                <Area type="monotone" dataKey="confidence" stroke="#82ca9d" fillOpacity={1} fill="url(#colorConf)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass-card md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-display">System Status</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 p-3 rounded-lg bg-success/5 border border-success/10">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <div className="flex-1">
                <p className="text-sm font-medium">Vector Engine Online</p>
                <p className="text-xs text-muted-foreground">pgvector is properly indexed for historical consistency checks.</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">OCR Model: GPT-4o Vision</p>
                <p className="text-xs text-muted-foreground">Highest precision achieved for handwritten samples.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg font-display">Data Summary</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center pt-0">
            <div className="text-5xl font-bold mb-2">{(stats.avgScore || 0).toFixed(1)}</div>
            <div className="text-sm text-muted-foreground uppercase tracking-widest">Avg Marks</div>
            <div className="w-full mt-6 space-y-2">
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${(stats.avgScore || 0) * 10}%` }} />
              </div>
              <p className="text-center text-[10px] text-muted-foreground">Performance against benchmark questions</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
