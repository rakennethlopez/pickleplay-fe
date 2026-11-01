"use client";

import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/** Copies a value (an account number, a reference) and says so, for guests paying from another app. */
export function CopyButton({
  value,
  label,
  text = "Copy",
}: {
  /** The text to copy, or a function read at click time (for example the current page address). */
  value: string | (() => string);
  label: string;
  text?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  return (
    <Button
      type="button"
      variant="outline"
      size="touch"
      className="min-h-12 px-3 text-sm"
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(typeof value === "function" ? value() : value);
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard blocked: the value is still on screen to select by hand.
        }
      }}
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {copied ? "Copied" : text}
    </Button>
  );
}
