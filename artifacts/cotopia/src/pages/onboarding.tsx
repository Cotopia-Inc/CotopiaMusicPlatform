import { useState } from "react";
import { useLocation } from "wouter";
import { useSaveDemographics } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Radio, UserCheck, ChevronRight } from "lucide-react";

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];
const RACE_OPTIONS = ["American Indian or Alaska Native","Asian","Black or African American","Hispanic or Latino","Middle Eastern or North African","Native Hawaiian or Other Pacific Islander","White","Two or More Races","Prefer not to say","Other"];
const SEX_OPTIONS = ["Male","Female","Non-binary / Non-conforming","Prefer not to say","Other"];

export default function Onboarding() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const saveMutation = useSaveDemographics();

  const [form, setForm] = useState({
    realName: "",
    address: "",
    city: "",
    state: "",
    country: "United States",
    postalCode: "",
    sex: "",
    race: "",
    dateOfBirth: "",
    phone: "",
  });

  const set = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  function handleSubmit() {
    saveMutation.mutate({ data: form }, {
      onSuccess: () => {
        toast({ title: "Profile complete!", description: "Welcome to Everyday Radio." });
        setLocation("/");
      },
      onError: () => toast({ variant: "destructive", title: "Could not save", description: "Please try again." }),
    });
  }

  if (!user) { setLocation("/login"); return null; }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-4 py-10 space-y-8">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold tracking-tight">Everyday Radio</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold">Complete your profile</h1>
              <p className="text-sm text-muted-foreground">This step is required before you can access the platform.</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Personal Information</h2>

          <div className="space-y-2">
            <Label>Full Legal Name</Label>
            <Input placeholder="Jane Smith" value={form.realName} onChange={e => set("realName", e.target.value)} className="bg-secondary/50 border-secondary" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <Input type="date" value={form.dateOfBirth} onChange={e => set("dateOfBirth", e.target.value)} className="bg-secondary/50 border-secondary" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input placeholder="+1 (555) 000-0000" value={form.phone} onChange={e => set("phone", e.target.value)} className="bg-secondary/50 border-secondary" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sex</Label>
              <Select value={form.sex} onValueChange={v => set("sex", v)}>
                <SelectTrigger className="bg-secondary/50 border-secondary"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{SEX_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Race / Ethnicity</Label>
              <Select value={form.race} onValueChange={v => set("race", v)}>
                <SelectTrigger className="bg-secondary/50 border-secondary"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{RACE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Address</h2>

          <div className="space-y-2">
            <Label>Street Address</Label>
            <Input placeholder="123 Main St, Apt 4B" value={form.address} onChange={e => set("address", e.target.value)} className="bg-secondary/50 border-secondary" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>City</Label>
              <Input placeholder="New York" value={form.city} onChange={e => set("city", e.target.value)} className="bg-secondary/50 border-secondary" />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Select value={form.state} onValueChange={v => set("state", v)}>
                <SelectTrigger className="bg-secondary/50 border-secondary"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>ZIP / Postal Code</Label>
              <Input placeholder="10001" value={form.postalCode} onChange={e => set("postalCode", e.target.value)} className="bg-secondary/50 border-secondary" />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input placeholder="United States" value={form.country} onChange={e => set("country", e.target.value)} className="bg-secondary/50 border-secondary" />
            </div>
          </div>
        </div>

        <div className="p-3 rounded-lg border border-border bg-secondary/20 text-xs text-muted-foreground">
          Your demographic information is collected to comply with music industry reporting standards and to personalize your experience. It is never sold or shared without your consent.
        </div>

        <Button onClick={handleSubmit} className="w-full gap-2 h-11 font-semibold" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving…" : <><span>Save & Continue</span><ChevronRight className="w-4 h-4" /></>}
        </Button>
      </div>
    </div>
  );
}
