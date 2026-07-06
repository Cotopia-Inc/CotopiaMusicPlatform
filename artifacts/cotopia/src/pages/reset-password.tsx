import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useLocation } from "wouter";
import { CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const formSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function ResetPassword() {
  const [location] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token");

  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-sm text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold">Invalid reset link</h2>
          <p className="text-sm text-muted-foreground">This link is missing a reset token. Please request a new one.</p>
          <Link href="/forgot-password" className="text-primary hover:underline text-sm font-medium">
            Request a new reset link →
          </Link>
        </div>
      </div>
    );
  }

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    setServerError(null);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: values.newPassword }),
      });
      if (res.ok) {
        setDone(true);
      } else {
        const body = await res.json().catch(() => ({}));
        setServerError(body?.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background">
      <div className="hidden lg:flex w-1/2 bg-card relative overflow-hidden flex-col justify-between p-12 border-r border-border">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src="/logo.jpg" alt="Cotopia" className="w-7 h-7 rounded-md object-cover flex-shrink-0" />
            <span className="text-xl font-extrabold tracking-tighter">Everyday Radio</span>
          </Link>
          <p className="text-[11px] text-muted-foreground tracking-widest uppercase mt-0.5 pl-9">Powered by Cotopia</p>
        </div>
        <div className="relative z-10 space-y-4 max-w-md">
          <h1 className="text-5xl font-extrabold tracking-tight leading-none">The sound of tomorrow.</h1>
          <p className="text-lg text-muted-foreground">Join thousands of artists and creators defining the next generation of music discovery.</p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center w-full lg:w-1/2 px-6 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden flex items-center gap-2 mb-2">
            <img src="/logo.jpg" alt="Cotopia" className="w-5 h-5 rounded-sm object-cover flex-shrink-0" />
            <span className="font-bold tracking-tight">Everyday Radio</span>
          </div>

          {done ? (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-primary" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Password updated!</h2>
                <p className="text-sm text-muted-foreground">Your password has been reset. You can now sign in with your new password.</p>
              </div>
              <Link href="/login" className="block w-full">
                <Button className="w-full h-11 text-sm font-semibold bg-primary">Sign in →</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight">Set a new password</h2>
                <p className="text-sm text-muted-foreground">Choose a strong password — at least 8 characters.</p>
              </div>

              {serverError && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm text-destructive">{serverError}</p>
                    {serverError.toLowerCase().includes("expired") && (
                      <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                        Request a new reset link →
                      </Link>
                    )}
                  </div>
                </div>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} className="bg-secondary/50 border-secondary h-11" autoComplete="new-password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} className="bg-secondary/50 border-secondary h-11" autoComplete="new-password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full h-11 text-sm font-semibold bg-primary" disabled={loading}>
                    {loading ? "Updating…" : "Reset password"}
                  </Button>
                </form>
              </Form>

              <div className="text-center text-sm">
                <Link href="/login" className="text-muted-foreground hover:text-foreground transition-colors">
                  ← Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
