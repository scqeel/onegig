import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Search,
  Send,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  UploadCloud,
  FileSpreadsheet,
  Download,
  Zap,
  History,
  Trash2,
  Check,
  AlertCircle,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const TOTAL_CAP = 500;
const BATCH_SIZE = 30;
const STORAGE_KEY = "onegig_submission_history";

interface BatchSummary {
  received: number;
  unique: number;
  submitted: number;
  existing: number;
  duplicates: number;
}

interface HistoryItem {
  id: string;
  timestamp: string;
  total: number;
  submitted: number;
  existing: number;
  numbers: string[];
}

const emptySummary: BatchSummary = { received: 0, unique: 0, submitted: 0, existing: 0, duplicates: 0 };

function normalizePhone(raw: string): string | null {
  let p = raw.replace(/\D/g, "");
  if (p.startsWith("233") && p.length === 12) p = "0" + p.slice(3);
  if (p.startsWith("0") && p.length === 10) return p;
  return null;
}

function detectNetwork(phone: string): "mtn" | "telecel" | "airteltigo" | "other" {
  const clean = phone.replace(/\D/g, "");
  const prefix = clean.length === 10 ? clean.slice(0, 3) : (clean.startsWith("233") ? "0" + clean.slice(3, 5) : "");
  if (["024", "054", "055", "059", "053"].includes(prefix)) return "mtn";
  if (["020", "050"].includes(prefix)) return "telecel";
  if (["027", "057", "026", "056"].includes(prefix)) return "airteltigo";
  return "other";
}

function downloadCSV(numbers: string[], filename = "beneficiary_submission_report.csv") {
  const rows = [["Phone Number", "Network Carrier", "Status", "Date Submitted"]];
  const dateStr = new Date().toLocaleString();
  numbers.forEach((num) => {
    const net = detectNetwork(num).toUpperCase();
    rows.push([num, net, "Submitted for Approval", dateStr]);
  });
  const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.map(cell => `"${cell}"`).join(",")).join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function SubmitNumbersPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [rawInput, setRawInput] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<BatchSummary | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load persistent submission history
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHistory(JSON.parse(saved));
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Pre-fill phone param if coming from Verify Number page
  useEffect(() => {
    const phone = searchParams.get("phone");
    if (phone) {
      setRawInput(phone);
    }
  }, [searchParams]);

  // Real-time network detection & parsing
  const { validNumbers, invalidCount, carrierStats } = useMemo(() => {
    const tokens = rawInput.split(/[\n,]+|\s{2,}|\s(?=0|\+?233)/).map((t) => t.trim()).filter(Boolean);
    const seen = new Set<string>();
    let invalid = 0;
    const stats = { mtn: 0, telecel: 0, airteltigo: 0, other: 0 };
    
    for (const t of tokens) {
      const n = normalizePhone(t);
      if (n) {
        if (!seen.has(n)) {
          seen.add(n);
          stats[detectNetwork(n)]++;
        }
      } else if (t) {
        invalid++;
      }
    }
    return { validNumbers: Array.from(seen), invalidCount: invalid, carrierStats: stats };
  }, [rawInput]);

  const total = validNumbers.length;
  const batchCount = Math.max(1, Math.ceil(total / BATCH_SIZE));
  const overCap = total > TOTAL_CAP;

  // File parsing handler (.csv, .xlsx, .txt, .tsv)
  const handleFileRead = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || "");
      const matches = text.match(/(?:0|\+?233)\d{9}/g) || [];
      if (matches.length === 0) {
        toast({
          title: "No valid phone numbers found",
          description: "Could not find Ghanaian phone numbers in the uploaded file.",
          variant: "destructive",
        });
        return;
      }
      const uniqueNew = Array.from(new Set(matches.map((m) => normalizePhone(m)).filter(Boolean))) as string[];
      const combined = Array.from(new Set([...validNumbers, ...uniqueNew])).join("\n");
      setRawInput(combined);
      toast({
        title: "File Loaded! 📄",
        description: `Extracted ${uniqueNew.length} phone numbers from ${file.name}.`,
      });
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileRead(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    setBatchProgress({ done: 0, total: batchCount });

    const aggregate: BatchSummary = { ...emptySummary };
    let batchesDone = 0;

    try {
      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = validNumbers.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase.functions.invoke("admin-provider-action", {
          body: { action: "submit_numbers", numbers: batch },
        });

        if (error || data?.success === false) {
          throw new Error(data?.error || error?.message || "Failed to submit a batch");
        }

        const summary = data?.data?.summary;
        if (summary) {
          aggregate.received += Number(summary.received || 0);
          aggregate.unique += Number(summary.unique || 0);
          aggregate.submitted += Number(summary.submitted || 0);
          aggregate.existing += Number(summary.existing || 0);
          aggregate.duplicates += Number(summary.duplicates || 0);
        } else {
          aggregate.received += batch.length;
          aggregate.unique += batch.length;
          aggregate.submitted += Number(data?.data?.submitted || 0);
          aggregate.existing += Number(data?.data?.existing || 0);
        }

        batchesDone++;
        setBatchProgress({ done: batchesDone, total: batchCount });
      }

      setResult(aggregate);

      // Save submission history item
      const newItem: HistoryItem = {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleString(),
        total,
        submitted: aggregate.submitted || total,
        existing: aggregate.existing || 0,
        numbers: [...validNumbers],
      };
      const updatedHistory = [newItem, ...history].slice(0, 20);
      setHistory(updatedHistory);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));

    } catch (err: any) {
      toast({
        title: "Submission failed",
        description: err.message || "Could not submit numbers at this time.",
        variant: "destructive",
      });
      if (batchesDone > 0) setResult(aggregate);
    } finally {
      setSubmitting(false);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
    toast({ title: "History Cleared" });
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground flex flex-col justify-between overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-0 grid-pattern-dark opacity-40" />

      {/* Floating Pill Header Navbar */}
      <header className="fixed left-0 right-0 top-4 z-50 px-4 md:px-8 pointer-events-none">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between rounded-full border border-border bg-background/90 backdrop-blur-md px-4 md:px-6 pointer-events-auto transition-all">
          <Logo size="md" />

          <nav className="flex items-center gap-1.5 sm:gap-2">
            <Link
              to="/verify-number"
              className="inline-flex h-8 sm:h-9 items-center gap-1 sm:gap-1.5 rounded-full px-2.5 sm:px-4 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Verify</span><span className="xs:hidden">Verify</span>
            </Link>
            <Link
              to="/track"
              className="inline-flex h-8 sm:h-9 items-center gap-1 sm:gap-1.5 rounded-full px-2.5 sm:px-4 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Search className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Track Order</span><span className="xs:hidden">Track</span>
            </Link>
            <Button asChild className="h-8 sm:h-9 rounded-full px-3 sm:px-5 text-xs">
              <Link to="/buy">
                Buy <ArrowRight className="ml-1 h-3.5 w-3.5 hidden sm:inline" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto w-full space-y-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Submit Numbers</h1>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl">
            Upload or paste phone numbers to submit them for approval to be added to our beneficiary list. Maximum {TOTAL_CAP} per submission, sent to the network in batches of {BATCH_SIZE}.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            To check whether numbers are already verified, use{" "}
            <Link to="/verify-number" className="text-primary font-semibold hover:underline">
              Verify Number
            </Link>
            .
          </p>
        </div>

        {/* Form Container */}
        <div className="rounded-[1.75rem] border border-border bg-card p-6 sm:p-8 space-y-5 shadow-xl">
          
          {/* File Upload Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition-all ${
              isDragging ? "border-primary bg-primary/10 scale-[0.99]" : "border-border bg-background/50 hover:border-primary/50 hover:bg-background/80"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.xlsx,.tsv"
              onChange={(e) => e.target.files?.[0] && handleFileRead(e.target.files[0])}
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UploadCloud className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold text-foreground">
                <span className="text-primary font-bold">Click to upload file</span> or drag & drop CSV / TXT list
              </p>
              <p className="text-[11px] text-muted-foreground">
                Supports .CSV, .TXT, .XLSX files containing phone numbers
              </p>
            </div>
          </div>

          {/* Real-time Carrier Breakdown Badges */}
          {total > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1 animate-in fade-in duration-300">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">
                Detected Carrier Breakdown:
              </span>
              {carrierStats.mtn > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-400">
                  🟡 MTN: {carrierStats.mtn}
                </span>
              )}
              {carrierStats.telecel > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/30 px-3 py-1 text-xs font-bold text-red-400">
                  🔴 Telecel: {carrierStats.telecel}
                </span>
              )}
              {carrierStats.airteltigo > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/30 px-3 py-1 text-xs font-bold text-blue-400">
                  🔵 AirtelTigo: {carrierStats.airteltigo}
                </span>
              )}
              {carrierStats.other > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-3 py-1 text-xs font-bold text-muted-foreground">
                  ⚪ Standard: {carrierStats.other}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Phone numbers input
            </label>
            <span className={`text-xs font-semibold tabular-nums ${overCap ? "text-destructive" : "text-muted-foreground"}`}>
              {total} / {TOTAL_CAP} · ~{batchCount} batch{batchCount === 1 ? "" : "es"}
            </span>
          </div>

          <textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            rows={10}
            placeholder={"0547603024\n0241234567\n0551234569"}
            className="w-full rounded-xl border border-border bg-background p-4 text-sm font-mono text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>One per line, or separated by commas/spaces. Accepts 0XXXXXXXXX or 233XXXXXXXXX.</span>
            {invalidCount > 0 && (
              <span className="text-amber-500 font-semibold">{invalidCount} entr{invalidCount === 1 ? "y" : "ies"} skipped (invalid format)</span>
            )}
          </div>

          {overCap && (
            <p className="text-xs font-semibold text-destructive">
              You've pasted {total} numbers — trim to {TOTAL_CAP} or fewer to submit.
            </p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={total === 0 || overCap || submitting}
              size="lg"
              className="flex-1 rounded-xl"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting batch {batchProgress.done + 1} of {batchProgress.total}...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit {total || ""} Number{total === 1 ? "" : "s"} For Approval
                </>
              )}
            </Button>

            {total > 0 && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => downloadCSV(validNumbers)}
                className="rounded-xl shrink-0"
                title="Export list to CSV"
              >
                <Download className="h-4 w-4 mr-1.5" /> CSV
              </Button>
            )}
          </div>
        </div>

        {/* Submission History Section */}
        {history.length > 0 && (
          <div className="rounded-[1.75rem] border border-border bg-card p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-base text-foreground">Recent Submission History</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={clearHistory} className="text-xs text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear Log
              </Button>
            </div>

            <div className="divide-y divide-border">
              {history.map((item) => (
                <div key={item.id} className="py-3.5 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-foreground">{item.total} Numbers Submitted</p>
                    <p className="text-[11px] text-muted-foreground">{item.timestamp}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-500">
                      {item.submitted} Submitted
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => downloadCSV(item.numbers, `submission_${item.timestamp.replace(/[/,:\s]/g, "_")}.csv`)}
                      className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border bg-background py-8 text-center text-xs text-muted-foreground">
        <div className="mx-auto max-w-5xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} OneGig Reseller Platform. Secured by DataHub GH.</p>
          <div className="flex items-center gap-4 font-semibold">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link to="/buy" className="hover:text-foreground transition-colors">Buy Data</Link>
            <Link to="/track" className="hover:text-foreground transition-colors">Track Order</Link>
          </div>
        </div>
      </footer>

      {/* Confirm dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit for approval?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1.5">
                <p>
                  You are about to submit <strong className="text-foreground">{total}</strong> number{total === 1 ? "" : "s"} for approval to be added to our beneficiary list.
                </p>
                <p>This will be sent in <strong className="text-foreground">{batchCount}</strong> batch{batchCount === 1 ? "" : "es"} of up to {BATCH_SIZE}.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit}>
              <Send className="mr-2 h-4 w-4" /> Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Success dialog */}
      <Dialog open={!!result} onOpenChange={(open) => { if (!open) { setResult(null); setRawInput(""); } }}>
        <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <DialogTitle>Submission Complete</DialogTitle>
            </div>
            <DialogDescription className="text-emerald-500">
              Successfully processed. Received {result?.received ?? 0} · unique {result?.unique ?? 0} · submitted for approval {result?.submitted ?? 0} · already on list {result?.existing ?? 0}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="rounded-xl border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Received</p>
              <p className="text-xl font-bold text-foreground tabular-nums">{result?.received ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Unique</p>
              <p className="text-xl font-bold text-foreground tabular-nums">{result?.unique ?? 0}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
              <p className="text-xs text-muted-foreground">Submitted</p>
              <p className="text-xl font-bold text-emerald-500 tabular-nums">{result?.submitted ?? 0}</p>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground">Already on list</p>
              <p className="text-xl font-bold text-primary tabular-nums">{result?.existing ?? 0}</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">Batches completed: {batchProgress.done}/{batchProgress.total}</p>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              onClick={() => navigate(`/buy?phone=${validNumbers[0] || ""}`)}
              className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-bold"
            >
              <Zap className="mr-2 h-4 w-4" /> Buy Data For Valid Numbers
            </Button>
            <Button
              variant="outline"
              onClick={() => downloadCSV(validNumbers)}
              className="w-full rounded-xl"
            >
              <Download className="mr-2 h-4 w-4" /> Download CSV Audit Report
            </Button>
            <Button
              variant="ghost"
              onClick={() => { setResult(null); setRawInput(""); }}
              className="w-full rounded-xl text-xs"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}