"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendCancelCode } from "@/features/booking/api";

interface CodeStepProps {
  token: string;
  maskedPhone: string | null;
  value: string;
  onChange: (value: string) => void;
}

/**
 * Proves the guest holds the booking's mobile number before a cancellation. It only appears when
 * the server says a code is required (SMS on); with SMS off the private link alone is enough and
 * this step never renders.
 */
export function CodeStep({ token, maskedPhone, value, onChange }: CodeStepProps) {
  const send = useMutation({ mutationFn: () => sendCancelCode(token) });
  return (
    <div className="bg-mist flex flex-col gap-3 rounded-[14px] p-4">
      <p className="text-ink text-sm">
        We&apos;ll text a code to {maskedPhone ?? "your mobile number"} to check it&apos;s you.
      </p>
      <div className="flex gap-2">
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Code"
          aria-label="Code from your text message"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 rounded-xl text-base"
        />
        <Button
          type="button"
          variant="outline"
          size="touch"
          disabled={send.isPending}
          onClick={() => send.mutate()}
        >
          {send.isSuccess ? "Send again" : "Send code"}
        </Button>
      </div>
      {send.isSuccess ? (
        <p role="status" className="text-court-green text-xs font-medium">
          Code sent.
        </p>
      ) : null}
      {send.isError ? (
        <p role="alert" className="text-clay text-xs">
          We couldn&apos;t send a code. Please wait a moment and try again.
        </p>
      ) : null}
    </div>
  );
}
