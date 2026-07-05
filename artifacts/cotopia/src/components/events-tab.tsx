import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetUserEvents, getGetUserEventsQueryKey,
  useCreateEvent, useUpdateEvent, useDeleteEvent,
  useGetCreatorMessage, getGetCreatorMessageQueryKey, useSetCreatorMessage,
  type Event, type EventInputType,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, List, Pencil, Plus, Trash2, MapPin, Link as LinkIcon, Sparkles, Loader2 } from "lucide-react";
import { format, isSameDay, parseISO } from "date-fns";

const EVENT_TYPE_LABELS: Record<string, string> = {
  personal: "Personal",
  business: "Business",
  tour: "Tour",
  release: "Release",
  announcement: "Announcement",
  other: "Other",
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  personal: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  business: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  tour: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  release: "bg-green-500/15 text-green-400 border-green-500/30",
  announcement: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  other: "bg-secondary text-muted-foreground border-border",
};

function EventTypeBadge({ type }: { type: string }) {
  return (
    <Badge variant="outline" className={EVENT_TYPE_COLORS[type] ?? EVENT_TYPE_COLORS.other}>
      {EVENT_TYPE_LABELS[type] ?? type}
    </Badge>
  );
}

type EventFormState = {
  title: string;
  type: EventInputType;
  eventDate: string;
  endDate: string;
  location: string;
  link: string;
  description: string;
};

const EMPTY_FORM: EventFormState = {
  title: "", type: "personal", eventDate: new Date().toISOString().slice(0, 10),
  endDate: "", location: "", link: "", description: "",
};

function EventFormDialog({
  open, onOpenChange, initial, onSave, saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: EventFormState;
  onSave: (data: EventFormState) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<EventFormState>(initial);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (v) setForm(initial); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial.title ? "Edit Event" : "New Event"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Album listening party" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v as EventInputType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EVENT_TYPE_LABELS).filter(([k]) => k !== "release" || initial.type === "release").map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Date</label>
              <Input type="date" value={form.eventDate} onChange={(e) => setForm(f => ({ ...f, eventDate: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">End date (optional)</label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Location (optional)</label>
              <Input value={form.location} onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))} placeholder="City, venue…" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Link (optional)</label>
            <Input value={form.link} onChange={(e) => setForm(f => ({ ...f, link: e.target.value }))} placeholder="https://…" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
            <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!form.title.trim() || !form.eventDate || saving} onClick={() => onSave(form)} className="gap-1.5">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreatorMessageCard({ userId, isOwner }: { userId: number; isOwner: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: message } = useGetCreatorMessage(userId, { query: { queryKey: getGetCreatorMessageQueryKey(userId) } });
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState("");
  const [authorTitle, setAuthorTitle] = useState("Creator");
  const [isVisible, setIsVisible] = useState(false);

  const saveMutation = useSetCreatorMessage({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetCreatorMessageQueryKey(userId) });
        toast({ title: "Message saved" });
        setEditing(false);
      },
      onError: () => toast({ variant: "destructive", title: "Could not save message" }),
    },
  });

  const openEditor = () => {
    setContent(message?.content ?? "");
    setAuthorTitle(message?.authorTitle || "Creator");
    setIsVisible(message?.isVisible ?? false);
    setEditing(true);
  };

  if (!isOwner && (!message || !message.isVisible || !message.content?.trim())) return null;

  return (
    <>
      <div className="bg-card rounded-xl border border-primary/20 p-5 space-y-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
        <div className="flex items-start justify-between gap-3 relative">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Word from the {message?.authorTitle || "Creator"}
            </p>
          </div>
          {isOwner && (
            <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={openEditor}>
              <Pencil className="w-3 h-3" /> Edit
            </Button>
          )}
        </div>
        {message?.content?.trim() ? (
          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap relative">{message.content}</p>
        ) : isOwner ? (
          <p className="text-sm text-muted-foreground italic relative">No message yet — share something with your fans.</p>
        ) : null}
        {isOwner && !message?.isVisible && (
          <p className="text-xs text-muted-foreground relative">Hidden from your public profile — only you can see this.</p>
        )}
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Word from the Creator</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Signed as</label>
              <Input value={authorTitle} onChange={(e) => setAuthorTitle(e.target.value)} placeholder="Creator" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Message</label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} placeholder="Share an update with your fans…" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isVisible} onChange={(e) => setIsVisible(e.target.checked)} className="accent-primary" />
              <span className="text-sm">Show on my public Events tab</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button
              disabled={saveMutation.isPending}
              className="gap-1.5"
              onClick={() => saveMutation.mutate({ data: { content, authorTitle: authorTitle.trim() || "Creator", isVisible } })}
            >
              {saveMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EventCard({ event, isOwner, onEdit, onDelete }: { event: Event; isOwner: boolean; onEdit: () => void; onDelete: () => void }) {
  const date = parseISO(event.eventDate);
  return (
    <div className="flex gap-4 rounded-lg border border-border p-4 hover:border-border/80 transition-colors">
      <div className="flex-shrink-0 w-14 text-center">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{format(date, "MMM")}</div>
        <div className="text-2xl font-bold leading-none">{format(date, "d")}</div>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-sm leading-snug">{event.title}</p>
          <EventTypeBadge type={event.type} />
        </div>
        <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
          <span>{format(date, "EEEE, MMM d, yyyy")}{event.endDate ? ` – ${format(parseISO(event.endDate), "MMM d, yyyy")}` : ""}</span>
          {event.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span>}
          {event.link && (
            <a href={event.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
              <LinkIcon className="w-3 h-3" /> Link
            </a>
          )}
        </div>
        {event.description && <p className="text-sm text-muted-foreground/90">{event.description}</p>}
        {event.isAutoGenerated && <span className="text-[10px] text-muted-foreground/70 italic">Auto-generated from release</span>}
      </div>
      {isOwner && !event.isAutoGenerated && (
        <div className="flex flex-col gap-1 flex-shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Pencil className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      )}
    </div>
  );
}

export function EventsTab({ userId, isOwner }: { userId: number; isOwner: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const queryKey = getGetUserEventsQueryKey(userId);
  const { data: events, isLoading } = useGetUserEvents(userId, { query: { queryKey } });

  const [view, setView] = useState<"list" | "calendar">("list");
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);

  const invalidate = () => qc.invalidateQueries({ queryKey });

  const createMutation = useCreateEvent({
    mutation: { onSuccess: () => { invalidate(); toast({ title: "Event added" }); }, onError: () => toast({ variant: "destructive", title: "Could not add event" }) },
  });
  const updateMutation = useUpdateEvent({
    mutation: { onSuccess: () => { invalidate(); toast({ title: "Event updated" }); }, onError: () => toast({ variant: "destructive", title: "Could not update event" }) },
  });
  const deleteMutation = useDeleteEvent({
    mutation: { onSuccess: () => { invalidate(); toast({ title: "Event deleted" }); }, onError: () => toast({ variant: "destructive", title: "Could not delete event" }) },
  });

  const sortedEvents = [...(events ?? [])].sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const upcoming = sortedEvents.filter(e => e.eventDate >= new Date().toISOString().slice(0, 10));
  const past = sortedEvents.filter(e => e.eventDate < new Date().toISOString().slice(0, 10)).reverse();

  const eventDays = sortedEvents.map(e => parseISO(e.eventDate));
  const dayEvents = selectedDay ? sortedEvents.filter(e => isSameDay(parseISO(e.eventDate), selectedDay)) : [];

  const openCreate = () => { setEditingEvent(null); setFormOpen(true); };
  const openEdit = (ev: Event) => { setEditingEvent(ev); setFormOpen(true); };

  const handleSave = (form: EventFormState) => {
    const data = {
      title: form.title.trim(),
      type: form.type,
      eventDate: form.eventDate,
      endDate: form.endDate || undefined,
      location: form.location || undefined,
      link: form.link || undefined,
      description: form.description || undefined,
    };
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data }, { onSuccess: () => setFormOpen(false) });
    } else {
      createMutation.mutate({ data }, { onSuccess: () => setFormOpen(false) });
    }
  };

  const formInitial: EventFormState = editingEvent
    ? {
        title: editingEvent.title, type: editingEvent.type, eventDate: editingEvent.eventDate,
        endDate: editingEvent.endDate ?? "", location: editingEvent.location ?? "",
        link: editingEvent.link ?? "", description: editingEvent.description ?? "",
      }
    : EMPTY_FORM;

  return (
    <div className="space-y-5">
      <CreatorMessageCard userId={userId} isOwner={isOwner} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Tabs value={view} onValueChange={(v) => setView(v as "list" | "calendar")}>
          <TabsList>
            <TabsTrigger value="list" className="gap-1.5"><List className="w-3.5 h-3.5" /> List</TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> Calendar</TabsTrigger>
          </TabsList>
        </Tabs>
        {isOwner && (
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="w-3.5 h-3.5" /> Add Event
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading events…</p>
      ) : view === "list" ? (
        sortedEvents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {isOwner ? "No events yet. Add your first event to get started." : "No events to show."}
          </div>
        ) : (
          <div className="space-y-6">
            {upcoming.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Upcoming</p>
                <div className="space-y-2">
                  {upcoming.map(ev => (
                    <EventCard key={ev.id} event={ev} isOwner={isOwner} onEdit={() => openEdit(ev)} onDelete={() => deleteMutation.mutate({ id: ev.id })} />
                  ))}
                </div>
              </div>
            )}
            {past.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Past</p>
                <div className="space-y-2">
                  {past.map(ev => (
                    <EventCard key={ev.id} event={ev} isOwner={isOwner} onEdit={() => openEdit(ev)} onDelete={() => deleteMutation.mutate({ id: ev.id })} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      ) : (
        <div className="flex flex-col md:flex-row gap-6">
          <CalendarPicker
            mode="single"
            selected={selectedDay}
            onSelect={setSelectedDay}
            modifiers={{ hasEvent: eventDays }}
            modifiersClassNames={{ hasEvent: "font-bold underline decoration-primary decoration-2 underline-offset-4" }}
            className="rounded-lg border border-border"
          />
          <div className="flex-1 space-y-2 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {selectedDay ? format(selectedDay, "EEEE, MMM d, yyyy") : "Select a day"}
            </p>
            {selectedDay && dayEvents.length === 0 && (
              <p className="text-sm text-muted-foreground">No events on this day.</p>
            )}
            <div className="space-y-2">
              {dayEvents.map(ev => (
                <EventCard key={ev.id} event={ev} isOwner={isOwner} onEdit={() => openEdit(ev)} onDelete={() => deleteMutation.mutate({ id: ev.id })} />
              ))}
            </div>
          </div>
        </div>
      )}

      {isOwner && (
        <EventFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          initial={formInitial}
          onSave={handleSave}
          saving={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </div>
  );
}
