import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Search, ShieldCheck, Trash2, UserCog, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AdminUserDetailsModal } from "@/components/dashboard/AdminUserDetailsModal";

const AVATAR_COLORS = [
  "bg-sky-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-teal-600",
  "bg-cyan-600",
  "bg-orange-600",
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function getAvatarColor(seed: string) {
  const n = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function UserAvatar({ name }: { name: string }) {
  return (
    <div
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white",
        getAvatarColor(name)
      )}
    >
      {getInitials(name)}
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-border/40", className)} />;
}

export function AdminUsersTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [verifyingUserId, setVerifyingUserId] = useState<string | null>(null);
  const [verifiedUserNames, setVerifiedUserNames] = useState<Record<string, string>>({});

  const detectNetwork = (phone: string) => {
    let num = phone.replace(/\D/g, "");
    if (num.startsWith("233")) {
      num = "0" + num.substring(3);
    }
    const pfx = num.substring(0, 3);
    if (["024", "054", "055", "059", "025", "053"].includes(pfx)) return "MTN";
    if (["020", "050"].includes(pfx)) return "TELECEL";
    if (["027", "057", "026", "056"].includes(pfx)) return "AIRTELTIGO";
    return "MTN";
  };

  const verifyUserMomoName = async (userId: string, phone: string) => {
    setVerifyingUserId(userId);
    let num = phone.replace(/\D/g, "");
    if (num.startsWith("233")) {
      num = "0" + num.substring(3);
    }
    const network = detectNetwork(num);
    try {
      const { data, error } = await supabase.functions.invoke("paystack-resolve", {
        body: { momo_number: num, momo_network: network }
      });
      if (data?.ok && data?.account_name) {
        setVerifiedUserNames(prev => ({ ...prev, [userId]: data.account_name }));
        toast({ title: "Name Verified", description: `${data.account_name}` });
      } else {
        setVerifiedUserNames(prev => ({ ...prev, [userId]: "Not Found" }));
        toast({ title: "Verification Failed", description: data?.error || "Could not resolve name", variant: "destructive" });
      }
    } catch (err: any) {
      setVerifiedUserNames(prev => ({ ...prev, [userId]: "Error" }));
      toast({ title: "Verification Error", description: err.message, variant: "destructive" });
    } finally {
      setVerifyingUserId(null);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [profilesRes, rolesRes, agentProfilesRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, username, email, phone").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("agent_profiles").select("id, user_id, store_name, store_slug, activation_paid"),
      ]);

      const rolesMap = new Map<string, string[]>();
      (rolesRes.data ?? []).forEach((r: any) => {
        const prev = rolesMap.get(r.user_id) ?? [];
        rolesMap.set(r.user_id, [...prev, r.role]);
      });

      const agentProfileMap = new Map<string, any>();
      (agentProfilesRes.data ?? []).forEach((ap: any) => {
        agentProfileMap.set(ap.user_id, ap);
      });

      return (profilesRes.data ?? []).map((p: any) => ({
        ...p,
        roles: rolesMap.get(p.id) ?? ["user"],
        agentProfile: agentProfileMap.get(p.id) ?? null,
      }));
    },
  });

  const removeUser = async (userId: string) => {
    if (!confirm("Are you sure you want to permanently delete this user?")) return;
    setBusyId(userId);
    const { error } = await supabase.functions.invoke("admin-delete-user", { body: { user_id: userId } });
    setBusyId(null);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "User deleted successfully" });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  const makeAgent = async (userId: string) => {
    setBusyId(userId);
    const { error } = await supabase.functions.invoke("admin-convert-agent", { body: { user_id: userId } });
    setBusyId(null);
    if (error) { toast({ title: "Conversion failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Account promoted to agent" });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  const makeAdmin = async (userId: string) => {
    const code = window.prompt("Enter the 4-digit security code to grant admin access:");
    if (!code) return;
    setBusyId(userId);
    const { error } = await supabase.functions.invoke("admin-make-admin", { body: { user_id: userId, code: code.trim() } });
    setBusyId(null);
    if (error) { toast({ title: "Conversion failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Account promoted to admin!" });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border p-6">
          <Skeleton className="mb-2 h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="divide-y divide-border">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-5">
              <Skeleton className="h-11 w-11 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-52" />
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const filtered = (data ?? []).filter((u: any) =>
    !q ||
    (u.full_name ?? "").toLowerCase().includes(q) ||
    (u.username ?? "").toLowerCase().includes(q) ||
    (u.email ?? "").toLowerCase().includes(q) ||
    (u.phone ?? "").includes(q)
  );

  const roleStyle: Record<string, string> = {
    admin: "border-rose-500/30 bg-rose-500/10 text-rose-500",
    agent: "border-amber-500/30 bg-amber-500/10 text-amber-600",
    user:  "border-border bg-secondary text-muted-foreground",
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 border-b border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Platform Users</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Manage accounts and permissions across the system.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <input
              type="text"
              placeholder="Search users…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-56 rounded-xl border border-border bg-background pl-9 pr-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20 hover:border-border/80 transition-all text-foreground placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="shrink-0 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary">
            {filtered.length}{search ? ` of ${data?.length ?? 0}` : " registered"}
          </div>
        </div>
      </div>

      <div className="divide-y divide-border">
        {filtered.map((u: any) => {
          const name = u.full_name || u.username || "Anonymous User";
          return (
            <div key={u.id} className="group flex flex-col gap-4 p-6 transition-all hover:bg-accent md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <UserAvatar name={name} />
                <div>
                  <p className="text-sm font-bold leading-tight text-foreground transition-colors group-hover:text-primary">{name}</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-semibold text-muted-foreground/80 items-center">
                    {u.email && <span>{u.email}</span>}
                    {u.phone && <><span className="hidden sm:inline opacity-40">·</span><span>{u.phone}</span></>}
                    {u.phone && (
                      <>
                        <span className="hidden sm:inline opacity-40">·</span>
                        {verifyingUserId === u.id ? (
                          <span className="flex items-center gap-1 text-[10px] text-primary">
                            <Loader2 className="h-3 w-3 animate-spin" /> Verifying...
                          </span>
                        ) : verifiedUserNames[u.id] ? (
                          <span className={cn(
                            "rounded-full px-2 py-0.5 border text-[9px] font-semibold leading-none",
                            verifiedUserNames[u.id] === "Not Found" || verifiedUserNames[u.id] === "Error"
                              ? "border-rose-500/20 bg-rose-500/10 text-rose-500"
                              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                          )}>
                            {verifiedUserNames[u.id] === "Not Found" || verifiedUserNames[u.id] === "Error"
                              ? `MoMo Name: ${verifiedUserNames[u.id]}`
                              : `Verified: ${verifiedUserNames[u.id]}`
                            }
                          </span>
                        ) : (
                          <button
                            onClick={() => verifyUserMomoName(u.id, u.phone)}
                            className="text-[10px] text-primary hover:underline hover:text-primary/80 transition-colors font-semibold"
                          >
                            Verify Paystack Name
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {u.roles.map((r: string) => (
                      <span key={r} className={cn("rounded-full border px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider", roleStyle[r] ?? roleStyle.user)}>
                        {r}
                      </span>
                    ))}
                    {u.roles.includes("agent") && (
                      u.agentProfile?.activation_paid ? (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                          Active Store
                        </span>
                      ) : (
                        <span className="rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-500 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                          Store Inactive
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:flex items-center gap-2.5 pt-3.5 md:pt-0 border-t border-border md:border-0">
                <Button
                  variant="outline" size="sm"
                  className="col-span-full md:col-auto h-9 md:h-8 rounded-xl border-border bg-background text-xs font-semibold hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                  onClick={() => setSelectedUser(u)}
                >
                  View Details
                </Button>
                {!u.roles.includes("agent") && (
                  <Button
                    variant="outline" size="sm"
                    className="h-9 md:h-8 rounded-xl border-border bg-background text-xs font-semibold hover:border-amber-500/40 hover:bg-amber-500/5 hover:text-amber-600"
                    disabled={busyId === u.id}
                    onClick={() => makeAgent(u.id)}
                  >
                    {busyId === u.id
                      ? <Loader2 className="h-4 w-4 md:h-3.5 md:w-3.5 animate-spin" />
                      : <><UserCog className="mr-1.5 h-3.5 w-3.5 md:h-3 md:w-3" />Agent</>}
                  </Button>
                )}
                {u.roles.includes("agent") && !u.agentProfile?.activation_paid && (
                  <Button
                    variant="outline" size="sm"
                    className="h-9 md:h-8 rounded-xl border-emerald-500/30 bg-background text-xs font-semibold text-emerald-600 hover:border-emerald-500 hover:bg-emerald-500 hover:text-white"
                    disabled={busyId === u.id}
                    onClick={() => makeAgent(u.id)}
                  >
                    {busyId === u.id
                      ? <Loader2 className="h-4 w-4 md:h-3.5 md:w-3.5 animate-spin" />
                      : <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5 md:h-3 md:w-3" />Verify Account</>}
                  </Button>
                )}
                {!u.roles.includes("admin") && (
                  <Button
                    variant="outline" size="sm"
                    className="h-9 md:h-8 rounded-xl border-border bg-background text-xs font-semibold hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-emerald-600"
                    disabled={busyId === u.id}
                    onClick={() => makeAdmin(u.id)}
                  >
                    {busyId === u.id
                      ? <Loader2 className="h-4 w-4 md:h-3.5 md:w-3.5 animate-spin" />
                      : <><ShieldCheck className="mr-1.5 h-3.5 w-3.5 md:h-3 md:w-3" />Admin</>}
                  </Button>
                )}
                <Button
                  variant="ghost" size="sm"
                  className="col-span-full md:col-auto h-9 md:h-8 md:w-8 rounded-xl text-muted-foreground/45 hover:bg-destructive/10 hover:text-destructive border border-border bg-background md:border-0 md:bg-transparent"
                  disabled={busyId === u.id}
                  onClick={() => removeUser(u.id)}
                >
                  {busyId === u.id
                    ? <Loader2 className="h-4 w-4 md:h-3.5 md:w-3.5 animate-spin" />
                    : <><Trash2 className="md:mr-0 mr-1.5 h-3.5 w-3.5" /><span className="md:hidden font-semibold text-xs">Delete User</span></>}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
            <Users className="h-6 w-6 text-muted-foreground/30" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">
            {search ? "No users match your search." : "No users found in database."}
          </p>
        </div>
      )}
      <AdminUserDetailsModal 
        user={selectedUser} 
        isOpen={!!selectedUser} 
        onClose={() => setSelectedUser(null)} 
      />
    </div>
  );
}
