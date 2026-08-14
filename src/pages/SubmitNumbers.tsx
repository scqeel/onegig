import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Search,
  Send,
  ShieldCheck,
  CheckCircle2,
  Loader2,
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

interface BatchSummary {
  received: number;
  unique: number;
  submitted: number;
  existing: number;
  duplicates: number;
}

const emptySummary: BatchSummary = { received: 0, unique: 0, submitted: 0, existing: 0, duplicates: 0 };

function normalizePhone(raw: string): string | null {
  let p = raw.replace(/\D/g, "");
  if (p.startsWith("233") && p.length === 12) p = "0" + p.slice(3);
  if (p.startsWith("0") && p.length === 10) return p;
  return null;
}

export default function SubmitNumbersPage() {
  const { toast } = useToast();
  const [rawInput, setRawInput] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<BatchSummary | null>(null);

  const { validNumbers, invalidCount } = useMemo(() => {
    const tokens = rawInput.split(/[\n,]+|\s{2,}|\s(?=0|\+?233)/).map((t) => t.trim()).filter(Boolean);
    const seen = new Set<string>();
    let invalid = 0;
    for (const t of tokens) {
      const n = normalizePhone(t);
      if (n) seen.add(n);
      else if (t) invalid++;
    }
    return { validNumbers: Array.from(seen), invalidCount: invalid };
  }, [rawInput]);

  const total = validNumbers.length;
  const batchCount = Math.max(1, Math.ceil(total / BATCH_SIZE));
  const overCap = total > TOTAL_CAP;

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

  return (
    <div className="dark min-h-screen bg-background text-foreground flex flex-col justify-between overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-0 grid-pattern-dark opacity-40" />

      {/* Floating Pill Header Navbar */}
      <header className="fixed left-0 right-0 top-4 z-50 px-4 md:px-8 pointer-events-none">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between rounded-full border border-border bg-background/90 backdrop-blur-md px-4 md:px-6 pointer-events-auto transition-all">
          <Logo size="md" />

          <nav className="flex items-center gap-2">
            <Link
              to="/verify-number"
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Verify Number
            </Link>
            <Link
              to="/track"
              className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Search className="h-3.5 w-3.5" /> Track Order
            </Link>
            <Button asChild className="h-9 rounded-full px-5 text-xs">
              <Link to="/buy">
                Buy Data <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Submit Numbers</h1>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl">
            Paste phone numbers to submit them for approval to be added to our beneficiary list. Numbers are added automatically. Maximum {TOTAL_CAP} per submission, sent to the network in batches of {BATCH_SIZE}.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            To check whether numbers are already verified, use{" "}
            <Link to="/verify-number" className="text-primary font-semibold hover:underline">
              Verify Number
            </Link>
            .
          </p>
        </div>

        <div className="rounded-[1.75rem] border border-border bg-card p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Phone numbers
            </label>
            <span className={`text-xs font-semibold tabular-nums ${overCap ? "text-destructive" : "text-muted-foreground"}`}>
              {total} / {TOTAL_CAP} · ~{batchCount} batch{batchCount === 1 ? "" : "es"}
            </span>
          </div>

          <textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            rows={12}
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

          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={total === 0 || overCap || submitting}
            size="lg"
            className="w-full rounded-xl"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting batch {batchProgress.done + 1} of {batchProgress.total}...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Submit {total || ""} number{total === 1 ? "" : "s"} for approval
              </>
            )}
          </Button>
        </div>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <DialogTitle>Submission complete</DialogTitle>
            </div>
            <DialogDescription className="text-emerald-500">
              Submission complete. Received {result?.received ?? 0} · unique {result?.unique ?? 0} · submitted for approval {result?.submitted ?? 0} · already on list {result?.existing ?? 0} · duplicates {result?.duplicates ?? 0}
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

          <Button onClick={() => { setResult(null); setRawInput(""); }} className="w-full rounded-xl mt-1">
            Done
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}