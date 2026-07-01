import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link } from "wouter";
import { Radio, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const formSchema = z.object({
  identifier: z.string().min(1, "Please enter your email or username"),
});

export default function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { identifier: "" },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    try {
      await fetch(`${import.meta.env.BASE_URL}api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: values.identifier }),
      });
    } finally {
      setLoading(false);
      setSent(true);
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
            <Radio className="w-5 h-5 text-primary" />
            <span className="font-bold tracking-tight">Everyday Radio</span>
          </div>

          {sent ? (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-primary" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Check your email</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  If an account matches that email or username, we've sent recovery instructions — including your username and a password reset link.
                </p>
                <p className="text-xs text-muted-foreground/60 pt-1">The link expires in 1 hour. Check your spam folder if you don't see it.</p>
              </div>
              <Link href="/login" className="block text-sm text-primary hover:underline font-medium">
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight">Recover your account</h2>
                <p className="text-sm text-muted-foreground">Enter your email address or username and we'll send you a recovery link.</p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="identifier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email or Username</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="name@example.com or @username"
                            {...field}
                            className="bg-secondary/50 border-secondary h-11"
                            autoComplete="email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full h-11 text-sm font-semibold bg-primary" disabled={loading}>
                    {loading ? "Sending…" : "Send recovery email"}
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
