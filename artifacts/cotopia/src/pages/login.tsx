import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Radio } from "lucide-react";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLogin();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    loginMutation.mutate({ data: values }, {
      onSuccess: (res) => {
        login(res.user, res.token);
        toast({ title: "Welcome back", description: "Tuned into Everyday Radio." });
        setLocation("/");
      },
      onError: () => {
        toast({ variant: "destructive", title: "Login failed", description: "Please check your credentials and try again." });
      }
    });
  };

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Left Panel */}
      <div className="hidden lg:flex w-1/2 bg-card relative overflow-hidden flex-col justify-between p-12 border-r border-border">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <Radio className="w-6 h-6 text-primary" />
            <span className="text-xl font-extrabold tracking-tighter">Everyday Radio</span>
          </div>
          <p className="text-[11px] text-muted-foreground tracking-widest uppercase mt-0.5 pl-8">Powered by Cotopia</p>
        </div>
        <div className="relative z-10 space-y-4 max-w-md">
          <h1 className="text-5xl font-extrabold tracking-tight leading-none">The sound of tomorrow.</h1>
          <p className="text-lg text-muted-foreground">Join thousands of artists and listeners defining the next generation of music discovery.</p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="flex lg:hidden flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <Radio className="w-6 h-6 text-primary" />
              <span className="text-xl font-extrabold tracking-tighter">Everyday Radio</span>
            </div>
            <p className="text-[10px] text-muted-foreground tracking-widest uppercase">Powered by Cotopia</p>
          </div>

          <div className="space-y-2 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground text-sm">Sign in to your account to continue</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="name@example.com" {...field} className="bg-secondary/50 border-secondary h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} className="bg-secondary/50 border-secondary h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full h-11 text-sm font-semibold bg-primary" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </Form>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Don't have an account? </span>
            <Link href="/register" className="text-primary hover:underline font-semibold">Create one</Link>
          </div>

          <div className="text-center">
            <Link href="/legal" className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground underline transition-colors">Legal Center</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
