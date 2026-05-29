import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Users, Search, Plus, UserPlus, Trash2, Edit2, Loader2, Save, X } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  phone: string;
}

export function CustomerCRM() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("crm-manage", {
        body: { action: "list" }
      });
      if (error) throw error;
      setCustomers(data?.customers || []);
    } catch (e: any) {
      toast({ title: "Failed to load customers", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSave = async () => {
    if (!formName || formPhone.length < 9) {
      return toast({ title: "Please provide valid name and phone", variant: "destructive" });
    }
    setIsSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.functions.invoke("crm-manage", {
          body: { action: "update", id: editingId, name: formName, phone: formPhone }
        });
        if (error) throw error;
        toast({ title: "Customer updated!" });
      } else {
        const { error } = await supabase.functions.invoke("crm-manage", {
          body: { action: "add", name: formName, phone: formPhone }
        });
        if (error) throw error;
        toast({ title: "Customer added successfully!" });
      }
      setIsAdding(false);
      setEditingId(null);
      setFormName("");
      setFormPhone("");
      fetchCustomers();
    } catch (e: any) {
      toast({ title: "Operation failed", description: e.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this customer?")) return;
    try {
      const { error } = await supabase.functions.invoke("crm-manage", {
        body: { action: "delete", id }
      });
      if (error) throw error;
      toast({ title: "Customer deleted" });
      fetchCustomers();
    } catch (e: any) {
      toast({ title: "Failed to delete", description: e.message, variant: "destructive" });
    }
  };

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.includes(search)
  );

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center text-violet-600">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Address Book</h2>
            <p className="text-sm text-slate-500 font-medium">Manage your regular customers.</p>
          </div>
        </div>

        <Button 
          onClick={() => { setIsAdding(true); setEditingId(null); setFormName(""); setFormPhone(""); }} 
          className="h-11 px-6 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold"
        >
          <UserPlus className="mr-2 h-4 w-4" /> Add Customer
        </Button>
      </div>

      {/* Editor Form */}
      {(isAdding || editingId) && (
        <div className="bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-900/50 p-6 rounded-2xl shadow-sm ring-4 ring-violet-50 dark:ring-violet-500/5 animate-in slide-in-from-top-4">
          <h3 className="font-bold text-slate-800 dark:text-white mb-4">
            {editingId ? "Edit Customer" : "New Customer"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Full Name</label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="John Doe" className="h-11" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Phone Number</label>
              <Input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="024 XXX XXXX" className="h-11" />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => { setIsAdding(false); setEditingId(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-8">
              {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />} 
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}

      {/* List & Search */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Search by name or phone number..." 
              className="pl-10 h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-base"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400 mb-4" />
            <p className="text-sm text-slate-500">Loading customers...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="mx-auto h-16 w-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="font-bold text-slate-700 dark:text-slate-300">No customers found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              {search ? "No matches for your search." : "You haven't added any customers yet. Add your regular customers for faster checkouts."}
            </p>
            {!search && (
              <Button onClick={() => setIsAdding(true)} variant="outline" className="mt-6 font-semibold">
                <Plus className="mr-2 h-4 w-4" /> Add First Customer
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map(c => (
              <div key={c.id} className="p-4 sm:px-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-900 dark:to-fuchsia-900 flex items-center justify-center text-violet-700 dark:text-violet-300 font-bold text-lg">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">{c.name}</h4>
                    <p className="text-sm text-slate-500 font-medium font-mono mt-0.5">{c.phone}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => { setFormName(c.name); setFormPhone(c.phone); setEditingId(c.id); setIsAdding(false); }}
                    className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleDelete(c.id)}
                    className="text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
