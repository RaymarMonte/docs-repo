"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Share2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  shareDocument,
  unshareDocument,
} from "@/actions/shares";

type ShareEntry = { userId: string; email: string; permission: string };
type ShareDialogProps = { docId: string; shares: ShareEntry[] };

export function ShareDialog({ docId, shares }: ShareDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState("edit");
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  function handleShare(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await shareDocument(docId, email, permission);
      if ("ok" in result) {
        setEmail("");
        setIsError(false);
        setMessage("Shared successfully.");
        router.refresh();
      } else {
        setIsError(true);
        setMessage(result.error);
      }
    });
  }

  function handleUnshare(userId: string, userEmail: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await unshareDocument(docId, userId);
      if ("ok" in result) {
        setIsError(false);
        setMessage(`Removed ${userEmail}.`);
        router.refresh();
      } else {
        setIsError(true);
        setMessage(result.error);
      }
    });
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share document</DialogTitle>
          <DialogDescription>
            Invite people by email. They must already have an account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleShare} className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1"
            />
            <select
              value={permission}
              onChange={(e) => setPermission(e.target.value)}
              className="rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="edit">Can edit</option>
              <option value="view">Can view</option>
            </select>
          </div>
          {message && (
            <p
              className={`text-sm ${isError ? "text-destructive" : "text-muted-foreground"}`}
            >
              {message}
            </p>
          )}
          <Button type="submit" disabled={isPending} className="self-end">
            Share
          </Button>
        </form>

        <div className="flex flex-col gap-2">
          {shares.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Not shared with anyone yet.
            </p>
          ) : (
            shares.map((share) => (
              <div
                key={share.userId}
                className="flex items-center justify-between gap-2"
              >
                <span className="text-sm">{share.email}</span>
                <span className="text-sm text-muted-foreground">
                  {share.permission.charAt(0).toUpperCase() +
                    share.permission.slice(1)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${share.email}`}
                  disabled={isPending}
                  onClick={() => handleUnshare(share.userId, share.email)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
