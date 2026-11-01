"use client";

import { FileText, ImagePlus } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import {
  checkReceiptFile,
  formatBytes,
  RECEIPT_ACCEPT,
  receiptProblemMessage,
} from "./receipt-file";

interface ReceiptPickerProps {
  maxBytes: number;
  file: File | null;
  /** Called with the chosen file, or null when the choice was cleared or is not acceptable. */
  onFile: (file: File | null) => void;
  disabled?: boolean;
  /** An error from the server (for example the file type was refused). */
  serverError?: string | null;
}

/** Photo, screenshot or PDF of a receipt, checked before it is sent so the guest is told early. */
export function ReceiptPicker({ maxBytes, file, onFile, disabled, serverError }: ReceiptPickerProps) {
  const id = useId();
  const [problem, setProblem] = useState<string | null>(null);
  const error = problem ?? serverError ?? null;

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className={cn(
          "border-border bg-card text-ink flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-[14px] border-2 border-dashed px-4 py-5 text-center",
          "has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-3",
          disabled && "pointer-events-none opacity-50",
          error && "border-clay",
        )}
      >
        {file ? (
          <>
            <FileText className="text-court-green size-6" aria-hidden />
            <span className="text-sm font-semibold break-all">{file.name}</span>
            <span className="text-slate text-xs">
              {formatBytes(file.size)} · tap to choose a different file
            </span>
          </>
        ) : (
          <>
            <ImagePlus className="text-court-green size-6" aria-hidden />
            <span className="text-sm font-semibold">Add a photo or screenshot</span>
            <span className="text-slate text-xs">
              JPG, PNG or PDF · up to {Math.floor(maxBytes / 1024 / 1024)} MB
            </span>
          </>
        )}
        <input
          id={id}
          type="file"
          accept={RECEIPT_ACCEPT}
          disabled={disabled}
          className="sr-only"
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => {
            const chosen = event.target.files?.[0] ?? null;
            // Allow picking the same file again after a problem.
            event.target.value = "";
            if (!chosen) return;
            const found = checkReceiptFile(chosen, maxBytes);
            setProblem(found ? receiptProblemMessage(found, maxBytes) : null);
            onFile(found ? null : chosen);
          }}
        />
      </label>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-clay text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
