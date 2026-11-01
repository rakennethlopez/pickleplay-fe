"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/features/booking/api";
import { login } from "./api";
import { loginRequestSchema, type LoginRequest } from "./schema";

function messageFor(error: unknown) {
  if (!(error instanceof ApiError)) return "Something went wrong. Please try again.";
  if (error.status === 401) return "That email and password don't match.";
  if (error.status === 429) {
    return "Too many attempts. This account is locked for a while. Try again later.";
  }
  if (error.status === 403) return "This account isn't active. Ask the business owner.";
  return "Something went wrong. Please try again.";
}

export function LoginForm() {
  const router = useRouter();
  const form = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: "", password: "" },
  });
  const { register, handleSubmit, formState } = form;

  const signIn = useMutation({
    mutationFn: login,
    onSuccess: () => router.replace("/admin/payments"),
  });

  return (
    <form
      onSubmit={handleSubmit((values) => signIn.mutate(values))}
      noValidate
      className="bg-card border-border flex w-full max-w-sm flex-col gap-5 rounded-[14px] border p-6"
    >
      <div className="flex flex-col gap-1">
        <p className="text-slate text-xs font-semibold tracking-widest uppercase">Admin</p>
        <h1 className="font-display text-ink text-4xl uppercase leading-none">Staff sign-in</h1>
        <p className="text-slate text-sm">
          For authorized staff only. Sign-ins and payment decisions are logged.
        </p>
      </div>

      {signIn.isError ? (
        <p role="alert" className="text-clay bg-clay/5 border-clay rounded-xl border p-3 text-sm">
          {messageFor(signIn.error)}
        </p>
      ) : null}

      <Field data-invalid={!!formState.errors.email}>
        <FieldLabel htmlFor="email">Work email</FieldLabel>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          className="h-12 rounded-xl text-base"
          aria-invalid={!!formState.errors.email}
          {...register("email")}
        />
        <FieldError errors={[formState.errors.email]} />
      </Field>

      <Field data-invalid={!!formState.errors.password}>
        <FieldLabel htmlFor="password">Password</FieldLabel>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          className="h-12 rounded-xl text-base"
          aria-invalid={!!formState.errors.password}
          {...register("password")}
        />
        <FieldError errors={[formState.errors.password]} />
      </Field>

      <Button type="submit" size="touch" disabled={signIn.isPending}>
        {signIn.isPending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-slate text-xs">
        After 5 wrong attempts the account is locked for a while. No access yet? Ask the business
        owner to invite you. Players book at the main site, not here.
      </p>
    </form>
  );
}
