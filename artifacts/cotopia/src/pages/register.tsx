import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegister, RegisterInputRole } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { usePlatformConfig } from "@/lib/platform-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Radio } from "lucide-react";

const formSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.nativeEnum(RegisterInputRole),
  ageConfirmed: z.boolean().refine(v => v === true, { message: "You must confirm you meet the age requirement to continue" }),
  tosAccepted: z.boolean().refine(v => v === true, { message: "You must accept the Terms of Service to continue" }),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const config = usePlatformConfig();
  const registerMutation = useRegister();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { username: "", email: "", password: "", role: RegisterInputRole.listener, ageConfirmed: false, tosAccepted: false },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    registerMutation.mutate({ data: { username: values.username, email: values.email, password: values.password, role: values.role, ageConfirmed: values.ageConfirmed } }, {
      onSuccess: (res) => {
        login(res.user, res.token);
        if (config.requireEmailVerification) {
          toast({ title: "Almost there!", description: "Check your email to verify your address before listening." });
          setLocation("/verify-email");
        } else {
          toast({ title: "Welcome to Everyday Radio!", description: "Your account is ready — start listening now." });
          setLocation("/");
        }
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? "Please check your details and try again.";
        toast({ variant: "destructive", title: "Registration failed", description: msg });
      }
    });
  };

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Left Panel */}
      <div className="hidden lg:flex w-1/2 bg-card relative overflow-hidden flex-col justify-between p-12 border-r border-border">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Radio className="w-6 h-6 text-primary" />
            <span className="text-xl font-extrabold tracking-tighter">Everyday Radio</span>
          </Link>
          <p className="text-[11px] text-muted-foreground tracking-widest uppercase mt-0.5 pl-8">Powered by Cotopia</p>
        </div>
        <div className="relative z-10 space-y-4 max-w-md">
          <h1 className="text-5xl font-extrabold tracking-tight leading-none">Your stage awaits.</h1>
          <p className="text-lg text-muted-foreground">Discover new sounds, share your creations, and connect with a community that lives for music.</p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6">
          {/* Mobile logo */}
          <div className="flex lg:hidden flex-col items-center gap-1">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Radio className="w-6 h-6 text-primary" />
              <span className="text-xl font-extrabold tracking-tighter">Everyday Radio</span>
            </Link>
            <p className="text-[10px] text-muted-foreground tracking-widest uppercase">Powered by Cotopia</p>
          </div>

          <div className="space-y-2 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Create an account</h2>
            <p className="text-muted-foreground text-sm">Join the Everyday Radio community</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="username" render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl><Input placeholder="johndoe" {...field} className="bg-secondary/50 border-secondary h-11" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input placeholder="name@example.com" {...field} className="bg-secondary/50 border-secondary h-11" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl><Input type="password" placeholder="••••••••" {...field} className="bg-secondary/50 border-secondary h-11" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel>I am a...</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-secondary/50 border-secondary h-11">
                        <SelectValue placeholder="Select your role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={RegisterInputRole.listener}>Listener</SelectItem>
                      <SelectItem value={RegisterInputRole.artist}>Artist</SelectItem>
                      <SelectItem value={RegisterInputRole.label}>Label</SelectItem>
                      <SelectItem value={RegisterInputRole.business}>Business</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="ageConfirmed" render={({ field }) => (
                <FormItem>
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-secondary/20">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="mt-0.5"
                      />
                    </FormControl>
                    <FormLabel className="text-xs text-muted-foreground leading-relaxed cursor-pointer font-normal">
                      I confirm I am at least 18 years old or the age of legal majority in my jurisdiction.
                    </FormLabel>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="tosAccepted" render={({ field }) => (
                <FormItem>
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-secondary/20">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="mt-0.5"
                      />
                    </FormControl>
                    <FormLabel className="text-xs text-muted-foreground leading-relaxed cursor-pointer font-normal">
                      I agree to the{" "}
                      <Link href="/legal/terms" className="text-primary hover:underline font-medium" onClick={e => e.stopPropagation()}>Terms of Service</Link>,{" "}
                      <Link href="/legal/privacy" className="text-primary hover:underline font-medium" onClick={e => e.stopPropagation()}>Privacy Policy</Link>,{" "}
                      <Link href="/legal/content-license" className="text-primary hover:underline font-medium" onClick={e => e.stopPropagation()}>Content License and Rights Grant</Link>,{" "}
                      <Link href="/legal/ai-policy" className="text-primary hover:underline font-medium" onClick={e => e.stopPropagation()}>AI Policy</Link>,{" "}
                      and{" "}
                      <Link href="/legal/community-guidelines" className="text-primary hover:underline font-medium" onClick={e => e.stopPropagation()}>Community Guidelines</Link>.
                    </FormLabel>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              <Button type="submit" className="w-full h-11 text-sm font-semibold bg-primary mt-2" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? "Creating account..." : "Get Started"}
              </Button>
            </form>
          </Form>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link href="/login" className="text-primary hover:underline font-semibold">Sign in</Link>
          </div>

          <div className="text-center flex items-center justify-center gap-4">
            <Link href="/about" className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground underline transition-colors">Our Promise</Link>
            <span className="text-muted-foreground/30 text-[11px]">·</span>
            <Link href="/legal" className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground underline transition-colors">Legal Center</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
