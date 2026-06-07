import { useListCompanyPosts, getListCompanyPostsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Megaphone } from "lucide-react";

export default function CompanyHub() {
  const { data, isLoading } = useListCompanyPosts(
    { limit: 50 },
    { query: { queryKey: getListCompanyPostsQueryKey({ limit: 50 }) } }
  );

  return (
    <div className="space-y-12 pb-24 max-w-5xl mx-auto">
      <div className="space-y-4">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">Company Hub</h1>
        <p className="text-muted-foreground text-lg">Announcements, updates, and spotlights from Cotopia.</p>
      </div>

      <div className="space-y-12">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-64 w-full rounded-xl" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))
        ) : data?.length ? (
          data.map((post) => (
            <article key={post.id} className="bg-card border border-border rounded-xl overflow-hidden shadow-lg">
              {post.imageUrl && (
                <div className="w-full aspect-[21/9] bg-secondary relative">
                  <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" />
                  {post.isPinned && (
                    <div className="absolute top-4 right-4 bg-primary text-primary-foreground px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full shadow-lg">
                      Pinned
                    </div>
                  )}
                </div>
              )}
              <div className="p-8 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-xs font-semibold uppercase tracking-wider">
                    {post.type.replace('_', ' ')}
                  </span>
                  <span className="text-sm text-muted-foreground">{new Date(post.createdAt).toLocaleDateString()}</span>
                </div>
                <h2 className="text-3xl font-bold tracking-tight">{post.title}</h2>
                <div className="prose prose-invert max-w-none text-muted-foreground" dangerouslySetInnerHTML={{ __html: post.content }} />
              </div>
            </article>
          ))
        ) : (
          <div className="text-center py-24 text-muted-foreground space-y-4 bg-card rounded-xl border border-border">
            <Megaphone className="w-12 h-12 mx-auto opacity-20" />
            <p>No posts available at the moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}
