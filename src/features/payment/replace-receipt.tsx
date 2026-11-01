"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { replaceReceipt } from "@/features/booking/api";
import { useSettings } from "@/features/booking/queries";
import { CONTACT } from "@/lib/placeholders";
import { ReceiptPicker } from "./receipt-picker";
import { uploadFailureMessage, uploadFileMessage } from "./upload-error";

/** "Wrong receipt?" Sends a replacement while the payment is still under review. */
export function ReplaceReceipt({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const maxBytes = settings.data?.maxReceiptBytes ?? 5 * 1024 * 1024;

  const send = useMutation({
    mutationFn: (chosen: File) => replaceReceipt(token, chosen),
    onSuccess: () => {
      setFile(null);
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["booking", token] });
    },
  });
  const fileMessage = send.isError ? uploadFileMessage(send.error, maxBytes) : null;

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        {send.isSuccess ? (
          <p role="status" className="text-court-green text-sm font-medium">
            Replacement sent. An administrator will review the new receipt.
          </p>
        ) : null}
        <Button variant="outline" size="touch" onClick={() => setOpen(true)}>
          Replace receipt
        </Button>
        <p className="text-slate text-center text-sm">Wrong receipt or questions? {CONTACT}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ReceiptPicker
        maxBytes={maxBytes}
        file={file}
        onFile={setFile}
        disabled={send.isPending}
        serverError={fileMessage}
      />
      {send.isError && !fileMessage ? (
        <p role="alert" className="text-clay text-sm">
          {uploadFailureMessage(send.error)}
        </p>
      ) : null}
      <Button size="touch" disabled={!file || send.isPending} onClick={() => file && send.mutate(file)}>
        {send.isPending ? "Sending…" : "Send replacement"}
      </Button>
      <Button variant="ghost" size="touch" onClick={() => setOpen(false)} disabled={send.isPending}>
        Cancel
      </Button>
    </div>
  );
}
