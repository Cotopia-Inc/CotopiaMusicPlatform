import { useState } from "react";
import { useLocation } from "wouter";
import { useSaveDemographics, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCheck, ChevronRight, Home } from "lucide-react";

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];
const RACE_OPTIONS = ["American Indian or Alaska Native","Asian","Black or African American","Hispanic or Latino","Middle Eastern or North African","Native Hawaiian or Other Pacific Islander","White","Two or More Races","Prefer not to say","Other"];
const SEX_OPTIONS = ["Male","Female","Non-binary / Non-conforming","Prefer not to say","Other"];

const FIELD_LABELS: Record<string, string> = {
  realName: "Full Legal Name",
  dateOfBirth: "Date of Birth",
  phone: "Phone",
  sex: "Sex",
  race: "Race / Ethnicity",
  address: "Street Address",
  city: "City",
  state: "State",
  postalCode: "ZIP / Postal Code",
  country: "Country",
};

type FormKey = "realName" | "address" | "city" | "state" | "country" | "postalCode" | "sex" | "race" | "dateOfBirth" | "phone";

export default function Onboarding() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const saveMutation = useSaveDemographics();

  const [form, setForm] = useState<Record<FormKey, string>>({
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

  const [errors, setErrors] = useState<Partial<Record<FormKey, string>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k: FormKey, v: string) => {
    setForm(prev => ({ ...prev, [k]: v }));
    if (submitted) {
      setErrors(prev => ({ ...prev, [k]: v.trim() ? undefined : `${FIELD_LABELS[k]} is required` }));
    }
  };

  function validate(): boolean {
    const newErrors: Partial<Record<FormKey, string>> = {};
    (Object.keys(FIELD_LABELS) as FormKey[]).forEach(k => {
      if (!form[k]?.trim()) {
        newErrors[k] = `${FIELD_LABELS[k]} is required`;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit() {
    setSubmitted(true);
    if (!validate()) {
      toast({ variant: "destructive", title: "All fields are required", description: "Please fill in every field before continuing." });
      return;
    }
    saveMutation.mutate({ data: form }, {
      onSuccess: () => {
        toast({ title: "Profile complete!", description: "Welcome to Everyday Radio." });
        // Update the cached user so ProtectedRoute sees demographicsCompleted:true immediately
        queryClient.setQueryData(getGetMeQueryKey(), (old: any) =>
          old ? { ...old, demographicsCompleted: true } : old
        );
        setDone(true);
        setTimeout(() => setLocation("/"), 1500);
      },
      onError: () => toast({ variant: "destructive", title: "Could not save", description: "Please try again." }),
    });
  }

  if (!user) { setLocation("/login"); return null; }

  const fieldClass = (k: FormKey) =>
    `bg-secondary/50 border-secondary${errors[k] ? " border-destructive focus-visible:ring-destructive" : ""}`;

  const triggerClass = (k: FormKey) =>
    `bg-secondary/50 border-secondary${errors[k] ? " border-destructive" : ""}`;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-4 py-10 space-y-8">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <img src="/logo.jpg" alt="Cotopia" className="w-5 h-5 rounded-sm object-cover flex-shrink-0" />
            <span className="text-sm font-bold tracking-tight">Everyday Radio</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold">Complete your profile</h1>
              <p className="text-sm text-muted-foreground">All fields are required before you can access the platform.</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Personal Information</h2>

          <div className="space-y-2">
            <Label>Full Legal Name <span className="text-destructive">*</span></Label>
            <Input placeholder="Jane Smith" value={form.realName} onChange={e => set("realName", e.target.value)} className={fieldClass("realName")} />
            {errors.realName && <p className="text-xs text-destructive">{errors.realName}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date of Birth <span className="text-destructive">*</span></Label>
              <Input type="date" value={form.dateOfBirth} onChange={e => set("dateOfBirth", e.target.value)} className={fieldClass("dateOfBirth")} />
              {errors.dateOfBirth && <p className="text-xs text-destructive">{errors.dateOfBirth}</p>}
            </div>
            <div className="space-y-2">
              <Label>Phone <span className="text-destructive">*</span></Label>
              <Input placeholder="+1 (555) 000-0000" value={form.phone} onChange={e => set("phone", e.target.value)} className={fieldClass("phone")} />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="onboarding-sex">Sex <span className="text-destructive">*</span></Label>
              <Select value={form.sex} onValueChange={v => set("sex", v)}>
                <SelectTrigger id="onboarding-sex" className={triggerClass("sex")}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{SEX_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
              {errors.sex && <p className="text-xs text-destructive">{errors.sex}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="onboarding-race">Race / Ethnicity <span className="text-destructive">*</span></Label>
              <Select value={form.race} onValueChange={v => set("race", v)}>
                <SelectTrigger id="onboarding-race" className={triggerClass("race")}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{RACE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
              {errors.race && <p className="text-xs text-destructive">{errors.race}</p>}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Address</h2>

          <div className="space-y-2">
            <Label>Street Address <span className="text-destructive">*</span></Label>
            <Input placeholder="123 Main St, Apt 4B" value={form.address} onChange={e => set("address", e.target.value)} className={fieldClass("address")} />
            {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>City <span className="text-destructive">*</span></Label>
              <Input placeholder="New York" value={form.city} onChange={e => set("city", e.target.value)} className={fieldClass("city")} />
              {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="onboarding-state">State <span className="text-destructive">*</span></Label>
              <Select value={form.state} onValueChange={v => set("state", v)}>
                <SelectTrigger id="onboarding-state" className={triggerClass("state")}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              {errors.state && <p className="text-xs text-destructive">{errors.state}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>ZIP / Postal Code <span className="text-destructive">*</span></Label>
              <Input placeholder="10001" value={form.postalCode} onChange={e => set("postalCode", e.target.value)} className={fieldClass("postalCode")} />
              {errors.postalCode && <p className="text-xs text-destructive">{errors.postalCode}</p>}
            </div>
            <div className="space-y-2">
              <Label>Country <span className="text-destructive">*</span></Label>
              <Input placeholder="United States" value={form.country} onChange={e => set("country", e.target.value)} className={fieldClass("country")} />
              {errors.country && <p className="text-xs text-destructive">{errors.country}</p>}
            </div>
          </div>
        </div>

        <div className="p-3 rounded-lg border border-border bg-secondary/20 text-xs text-muted-foreground">
          Your demographic information is collected to comply with music industry reporting standards and to personalize your experience. It is never sold or shared without your consent.
        </div>

        <Button onClick={handleSubmit} className="w-full gap-2 h-11 font-semibold" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving…" : <><span>Save & Continue</span><ChevronRight className="w-4 h-4" /></>}
        </Button>

        <Button
          variant="outline"
          className="w-full gap-2 h-11 font-semibold"
          disabled={!done}
          onClick={() => setLocation("/")}
        >
          <Home className="w-4 h-4" />
          {done ? "Go to Home" : "Complete the form to continue"}
        </Button>
      </div>
    </div>
  );
}
