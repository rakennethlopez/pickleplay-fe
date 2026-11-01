"use client";

import { useMutation } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiError } from "@/features/booking/api";
import { timeLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { receiptUrl } from "./api";
import { useSignedOutRedirect } from "./admin-shell";
import { METHOD } from "./payment-bits";
import { useAdminMe, useCan } from "./queries";
import type { PaymentDetail } from "./schema";

type Receipt = PaymentDetail["receipts"][number];

/** Fetches the receipt through the private route, so each failure can be explained truthfully. */
async function openReceipt(paymentId: string, file: Receipt) {
  const res = await fetch(receiptUrl(paymentId, file.id), { cache: "no-store" });
  if (!res.ok) throw new ApiError(res.status);
  const blob = await res.blob();
  // The bytes only ever live in this tab's memory: there is no URL to save, share or reuse.
  return { url: URL.createObjectURL(blob), type: blob.type || file.contentType };
}

function failureMessage(error: unknown) {
  const status = error instanceof ApiError ? error.status : 0;
  if (status === 410) {
    return ["Link expired", "The private link closes after a few minutes for safety. Open it again."];
  }
  if (status === 403) {
    return ["Receipt hidden · access needed", "Your role can't open receipts. Ask the business owner for access."];
  }
  if (status === 404) {
    return ["We can't find that receipt", "It may have been removed."];
  }
  return ["We couldn't open the receipt", "Check your connection and try again. Nothing was changed."];
}

/** Opens a receipt on demand. Each open is a fresh, short-lived, logged server request. */
export function ReceiptViewer({ payment }: { payment: PaymentDetail }) {
  const canView = useCan("receipts:view");
  const me = useAdminMe().data;
  const files = payment.receipts;
  const [index, setIndex] = useState(files.length - 1);
  const [shown, setShown] = useState<{ url: string; type: string } | null>(null);
  const file = files[index];

  const open = useMutation({
    mutationFn: (f: Receipt) => openReceipt(payment.id, f),
    onSuccess: setShown,
  });
  useSignedOutRedirect(open.error);

  // Free the in-memory copy when it is replaced or the screen closes.
  useEffect(() => {
    if (!shown) return;
    return () => URL.revokeObjectURL(shown.url);
  }, [shown]);

  const close = () => {
    setShown(null);
    open.reset();
  };

  return (
    <section className="bg-card border-border flex flex-col gap-3 rounded-[14px] border p-4">
      <h2 className="text-ink text-base font-semibold">
        Receipt · {payment.paymentMethod ? METHOD[payment.paymentMethod] : ""}
        {payment.submittedAt ? ` · sent ${timeLabel(payment.submittedAt)}` : ""}
      </h2>

      {files.length === 0 ? (
        <p className="text-slate text-sm">No receipt has been uploaded.</p>
      ) : canView === false ? (
        <div role="note" className="bg-muted/50 flex flex-col gap-1 rounded-xl p-5 text-sm">
          <p className="text-ink font-semibold">Receipt hidden · access needed</p>
          <p className="text-slate">
            Opening receipts needs the receipt viewer permission. Your role is {me?.role ?? "unknown"}.
            Ask the business owner for access.
          </p>
        </div>
      ) : (
        <>
          {files.length > 1 ? (
            <div role="group" aria-label="Receipts" className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={i === index}
                  onClick={() => {
                    setIndex(i);
                    close();
                  }}
                  className={cn(
                    "min-h-9 rounded-full border px-3 text-xs font-medium",
                    i === index ? "bg-court-green text-primary-foreground border-court-green" : "bg-card text-ink border-border",
                  )}
                >
                  {i === files.length - 1 ? "Latest" : `Earlier ${i + 1}`} · {timeLabel(f.submittedAt)}
                  {f.duplicate ? " · duplicate" : ""}
                </button>
              ))}
            </div>
          ) : null}

          {open.isError ? (
            <div role="alert" className="bg-muted/50 flex flex-col gap-1 rounded-xl p-5 text-sm">
              <p className="text-ink font-semibold">{failureMessage(open.error)[0]}</p>
              <p className="text-slate">{failureMessage(open.error)[1]}</p>
            </div>
          ) : shown ? (
            shown.type === "application/pdf" ? (
              <a
                href={shown.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline", size: "touch" }), "self-start")}
              >
                <FileText className="size-4" aria-hidden />
                Open PDF in a new tab
              </a>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- an in-memory blob of a private image
              <img
                src={shown.url}
                alt={`Receipt sent ${timeLabel(file.submittedAt)}`}
                className="border-border max-h-[32rem] w-full rounded-xl border object-contain"
              />
            )
          ) : (
            <div className="bg-muted/50 flex min-h-40 items-center justify-center rounded-xl p-5 text-center">
              <p className="text-slate text-sm">The receipt stays closed until you open it.</p>
            </div>
          )}

          <Button
            variant="outline"
            size="touch"
            className="self-start"
            disabled={open.isPending}
            onClick={() => file && open.mutate(file)}
          >
            {open.isPending
              ? "Opening…"
              : shown || open.isError
                ? "Open again (new 5-minute link)"
                : "Open receipt securely"}
          </Button>
          <p className="text-slate text-xs">
            Never a public or permanent link. Only authorized staff can open it, and every open is
            logged.
          </p>
        </>
      )}
    </section>
  );
}
