"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { parseImportedFile } from "@/lib/parse-import";
import { importDocument } from "@/actions/documents";

export function ImportButton() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleButtonClick() {
    inputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clear any prior error at the start of a new pick
    setError(null);

    // Reset so selecting the same file again re-fires onChange
    if (inputRef.current) {
      inputRef.current.value = "";
    }

    const reader = new FileReader();

    reader.onerror = () => {
      setError(reader.error?.message ?? "Failed to read file.");
    };

    reader.onload = () => {
      // Parse first — if it throws, show error and bail (don't call the action)
      let parsed: { title: string; html: string };
      try {
        parsed = parseImportedFile(file.name, reader.result as string);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse file.");
        return;
      }

      // Call the server action inside useTransition.
      // importDocument redirects on success (throws NEXT_REDIRECT which Next handles),
      // so we do not treat thrown redirects as displayable errors.
      startTransition(async () => {
        await importDocument(parsed.title, parsed.html);
      });
    };

    reader.readAsText(file);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.md"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button variant="outline" disabled={isPending} onClick={handleButtonClick}>
        {isPending ? "Importing…" : "Import"}
      </Button>
      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  );
}
