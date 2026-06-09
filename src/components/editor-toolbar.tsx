"use client";

import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  List,
  ListOrdered,
} from "lucide-react";

/**
 * Full editor toolbar — bold, italic, underline, H1, H2, bullet list, numbered list.
 *
 * Each button is a shadcn <Button size="sm" type="button"> whose onClick runs
 * `editor.chain().focus().<cmd>().run()`. The variant is "default" when the
 * mark/node is active, and "ghost" otherwise.
 */
export function EditorToolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b pb-2">
      <Button
        type="button"
        size="sm"
        variant={editor.isActive("bold") ? "default" : "ghost"}
        onClick={() => editor.chain().focus().toggleBold().run()}
        aria-label="Bold"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant={editor.isActive("italic") ? "default" : "ghost"}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        aria-label="Italic"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant={editor.isActive("underline") ? "default" : "ghost"}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        aria-label="Underline"
      >
        <Underline className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant={editor.isActive("heading", { level: 1 }) ? "default" : "ghost"}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        aria-label="Heading 1"
      >
        <Heading1 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant={editor.isActive("heading", { level: 2 }) ? "default" : "ghost"}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        aria-label="Heading 2"
      >
        <Heading2 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant={editor.isActive("bulletList") ? "default" : "ghost"}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        aria-label="Bullet list"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant={editor.isActive("orderedList") ? "default" : "ghost"}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        aria-label="Numbered list"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
    </div>
  );
}
