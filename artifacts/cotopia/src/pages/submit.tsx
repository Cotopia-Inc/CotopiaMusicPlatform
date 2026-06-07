import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateSubmission, SubmissionInputType } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";

const formSchema = z.object({
  type: z.nativeEnum(SubmissionInputType),
  contentId: z.coerce.number().min(1, "Please provide a valid Content ID"),
});

export default function Submit() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const createMutation = useCreateSubmission();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: SubmissionInputType.song,
      contentId: 0,
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createMutation.mutate({ data: values }, {
      onSuccess: () => {
        toast({
          title: "Submission successful",
          description: "Your content has been submitted for review.",
        });
        setLocation("/submissions");
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Submission failed",
          description: "Something went wrong. Please try again.",
        });
      }
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-24">
      <div className="space-y-2">
        <h1 className="text-4xl font-extrabold tracking-tight">Submit Content</h1>
        <p className="text-muted-foreground">Submit your latest tracks or videos for review to be featured on Cotopia.</p>
      </div>

      <div className="bg-card p-8 rounded-xl border border-border shadow-lg">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-secondary/50 border-secondary">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={SubmissionInputType.song}>Song</SelectItem>
                      <SelectItem value={SubmissionInputType.video}>Video</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="contentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content ID</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g. 123" {...field} className="bg-secondary/50 border-secondary" />
                  </FormControl>
                  <p className="text-xs text-muted-foreground mt-1">Enter the ID of the song or video you want to submit.</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Submitting..." : "Submit for Review"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
