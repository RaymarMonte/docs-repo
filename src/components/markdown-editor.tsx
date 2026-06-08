"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import "@uiw/react-md-editor/markdown-editor.css";

// react-md-editor touches `window`, so it must be loaded client-side only.
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

type MarkdownEditorProps = {
  initialValue?: string;
  onChange?: (value: string) => void;
  height?: number;
};

export function MarkdownEditor({
  initialValue = "",
  onChange,
  height = 400,
}: MarkdownEditorProps) {
  const [value, setValue] = useState(initialValue);

  return (
    // `data-color-mode` controls the editor theme; wire this to your theme later.
    <div data-color-mode="light">
      <MDEditor
        value={value}
        height={height}
        onChange={(next) => {
          const v = next ?? "";
          setValue(v);
          onChange?.(v);
        }}
      />
    </div>
  );
}
