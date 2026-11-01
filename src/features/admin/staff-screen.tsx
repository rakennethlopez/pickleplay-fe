"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, CircleOff, Lock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { dayLabel, timeLabel } from "@/lib/format";
import { useSignedOutRedirect } from "./admin-shell";
import { Labeled, LoadFailed, Notice, PageHeader, Pill, Problem, selectClass } from "./admin-ui";
import { createRole, createStaff, removeRole, setStaffPassword, unlockStaff, updateRole, updateStaff } from "./config-api";
import { useRoles, useStaff } from "./config-queries";
import { PERMISSION_LABELS, type AdminRole, type StaffMember } from "./config-schema";
import { Chip } from "./payment-bits";
import { useAdminMe } from "./queries";

export function StaffScreen() {
  const [tab, setTab] = useState<"staff" | "roles">("staff");
  const [notice, setNotice] = useState<string | null>(null);
  const staff = useStaff();
  const roles = useRoles();
  const out = useSignedOutRedirect(staff.error, roles.error);
  if (out) return null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Staff & roles">
        Who can sign in, and what each role may do. A role change takes effect on the person&apos;s next action. Turning an account off signs
        it out at once.
      </PageHeader>

      {notice ? <Notice>{notice}</Notice> : null}

      <div role="group" aria-label="Show" className="flex gap-2">
        <Pill active={tab === "staff"} onClick={() => setTab("staff")}>
          Staff
        </Pill>
        <Pill active={tab === "roles"} onClick={() => setTab("roles")}>
          Roles
        </Pill>
      </div>

      {staff.isPending || roles.isPending ? (
        <Skeleton className="h-64 rounded-[14px]" />
      ) : staff.isError || roles.isError ? (
        <LoadFailed
          what="staff and roles"
          onRetry={() => {
            void staff.refetch();
            void roles.refetch();
          }}
        />
      ) : tab === "staff" ? (
        <StaffTab members={staff.data.items} roles={roles.data.items} onNotice={setNotice} />
      ) : (
        <RolesTab roles={roles.data.items} all={roles.data.allPermissions} onNotice={setNotice} />
      )}
    </div>
  );
}

function useRefreshStaff() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
  };
}

function StaffTab({ members, roles, onNotice }: { members: StaffMember[]; roles: AdminRole[]; onNotice: (text: string) => void }) {
  const me = useAdminMe().data;
  const refresh = useRefreshStaff();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [password, setPassword] = useState("");

  const add = useMutation({
    mutationFn: () => createStaff({ email: email.trim(), displayName: displayName.trim(), roleId, password }),
    onSuccess: (created) => {
      onNotice(`${created.displayName} can now sign in with the email and password you set. Pass the password on privately.`);
      setEmail("");
      setDisplayName("");
      setPassword("");
      refresh();
    },
  });
  const ready = email.includes("@") && displayName.trim() !== "" && roleId !== "" && password.length >= 4;

  return (
    <div className="flex flex-col gap-6">
      <form
        className="bg-card border-border grid gap-3 rounded-[14px] border p-4 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) add.mutate();
        }}
      >
        <h2 className="text-ink text-base font-semibold sm:col-span-2 lg:col-span-4">Add a staff member</h2>
        <Labeled label="Name">
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} className="h-11 rounded-xl" />
        </Labeled>
        <Labeled label="Email">
          <Input type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl" />
        </Labeled>
        <Labeled label="Role">
          <select className={selectClass} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            <option value="" disabled>
              Choose a role
            </option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="Password" hint="At least 4 characters">
          <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl" />
        </Labeled>
        <div className="sm:col-span-2 lg:col-span-4">
          <Button type="submit" size="touch" disabled={!ready || add.isPending}>
            {add.isPending ? "Adding…" : "Add staff member"}
          </Button>
        </div>
      </form>
      {add.isError ? <Problem error={add.error} /> : null}

      <ul className="flex flex-col gap-2">
        {members.map((m) => (
          <StaffRow key={m.id} member={m} roles={roles} isMe={m.email === me?.email} onNotice={onNotice} />
        ))}
      </ul>
    </div>
  );
}

function StaffRow({ member: m, roles, isMe, onNotice }: { member: StaffMember; roles: AdminRole[]; isMe: boolean; onNotice: (text: string) => void }) {
  const refresh = useRefreshStaff();
  const [resetting, setResetting] = useState(false);
  const change = useMutation({
    mutationFn: (body: { roleId?: string; status?: "active" | "disabled" }) => updateStaff(m.id, body),
    onSuccess: (saved, body) => {
      onNotice(
        body.status === "disabled"
          ? `${saved.displayName} is switched off and signed out.`
          : body.status === "active"
            ? `${saved.displayName} can sign in again.`
            : `${saved.displayName} is now ${saved.role.name}.`,
      );
      refresh();
    },
  });
  const unlock = useMutation({
    mutationFn: () => unlockStaff(m.id),
    onSuccess: (saved) => {
      onNotice(`${saved.displayName}'s account is unlocked.`);
      refresh();
    },
  });

  return (
    <li className="bg-card border-border flex flex-col gap-3 rounded-[14px] border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-ink font-semibold">
            {m.displayName}
            {isMe ? <span className="text-slate font-normal"> (you)</span> : null}
          </p>
          <p className="text-slate text-sm">
            {m.email} · {m.lastLoginAt ? `last signed in ${dayLabel(m.lastLoginAt)}, ${timeLabel(m.lastLoginAt)}` : "never signed in"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {m.status === "active" ? (
            <Chip tone="plain" Icon={CircleCheck}>
              Active
            </Chip>
          ) : (
            <Chip tone="warn" Icon={CircleOff}>
              Switched off
            </Chip>
          )}
          {m.lockedUntil ? (
            <Chip tone="bad" Icon={Lock}>
              Locked
            </Chip>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Labeled label="Role">
          <select
            className={selectClass + " min-w-52"}
            value={m.role.id}
            disabled={isMe || change.isPending}
            onChange={(e) => change.mutate({ roleId: e.target.value })}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Labeled>
        <Button variant="outline" onClick={() => setResetting(true)}>
          Reset password
        </Button>
        {m.lockedUntil ? (
          <Button variant="outline" disabled={unlock.isPending} onClick={() => unlock.mutate()}>
            Unlock
          </Button>
        ) : null}
        {!isMe ? (
          <Button variant="outline" disabled={change.isPending} onClick={() => change.mutate({ status: m.status === "active" ? "disabled" : "active" })}>
            {m.status === "active" ? "Switch off" : "Switch on"}
          </Button>
        ) : null}
      </div>
      {change.isError ? <Problem error={change.error} /> : null}
      {unlock.isError ? <Problem error={unlock.error} /> : null}
      {resetting ? (
        <ResetDialog
          member={m}
          onClose={() => setResetting(false)}
          onDone={() => {
            setResetting(false);
            onNotice(`${m.displayName}'s password was reset and they were signed out. Pass the new password on privately.`);
            refresh();
          }}
        />
      ) : null}
    </li>
  );
}

function ResetDialog({ member, onClose, onDone }: { member: StaffMember; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const reset = useMutation({ mutationFn: () => setStaffPassword(member.id, password), onSuccess: onDone });
  return (
    <Dialog open onOpenChange={(open) => !open && !reset.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password for {member.displayName}?</DialogTitle>
          <DialogDescription>They are signed out everywhere and a lock is lifted. Tell them the new password privately.</DialogDescription>
        </DialogHeader>
        <Labeled label="New password" hint="At least 4 characters">
          <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl" />
        </Labeled>
        {reset.isError ? <Problem error={reset.error} /> : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={reset.isPending}>
            Cancel
          </Button>
          <Button onClick={() => reset.mutate()} disabled={password.length < 4 || reset.isPending}>
            {reset.isPending ? "Resetting…" : "Reset password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PermissionBoxes({ all, value, onChange, idPrefix }: { all: string[]; value: string[]; onChange: (next: string[]) => void; idPrefix: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {all.map((p) => (
        <label key={p} htmlFor={`${idPrefix}-${p}`} className="text-ink flex min-h-11 items-center gap-3 text-sm">
          <input
            id={`${idPrefix}-${p}`}
            type="checkbox"
            className="size-5"
            checked={value.includes(p)}
            onChange={(e) => onChange(e.target.checked ? [...value, p] : value.filter((x) => x !== p))}
          />
          {PERMISSION_LABELS[p] ?? p}
        </label>
      ))}
    </div>
  );
}

function RolesTab({ roles, all, onNotice }: { roles: AdminRole[]; all: string[]; onNotice: (text: string) => void }) {
  const refresh = useRefreshStaff();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const add = useMutation({
    mutationFn: () => createRole({ name: name.trim(), description: description.trim() || undefined, permissions }),
    onSuccess: (created) => {
      onNotice(`The role ${created.name} was created.`);
      setName("");
      setDescription("");
      setPermissions([]);
      refresh();
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <form
        className="bg-card border-border flex flex-col gap-3 rounded-[14px] border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim().length >= 2) add.mutate();
        }}
      >
        <h2 className="text-ink text-base font-semibold">Add a role</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Role name">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="h-11 rounded-xl" />
          </Labeled>
          <Labeled label="What it is for (optional)">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} className="h-11 rounded-xl" />
          </Labeled>
        </div>
        <PermissionBoxes all={all} value={permissions} onChange={setPermissions} idPrefix="new-role" />
        {add.isError ? <Problem error={add.error} /> : null}
        <div>
          <Button type="submit" size="touch" disabled={name.trim().length < 2 || add.isPending}>
            {add.isPending ? "Adding…" : "Add role"}
          </Button>
        </div>
      </form>

      <ul className="flex flex-col gap-3">
        {roles.map((r) => (
          <RoleRow key={r.id} role={r} all={all} onNotice={onNotice} />
        ))}
      </ul>
    </div>
  );
}

function RoleRow({ role, all, onNotice }: { role: AdminRole; all: string[]; onNotice: (text: string) => void }) {
  const refresh = useRefreshStaff();
  const [permissions, setPermissions] = useState(role.permissions);
  const dirty = [...permissions].sort().join() !== [...role.permissions].sort().join();
  const save = useMutation({
    mutationFn: () => updateRole(role.id, { permissions }),
    onSuccess: (saved) => {
      onNotice(`${saved.name} was updated. It applies to ${saved.members} ${saved.members === 1 ? "person" : "people"} on their next action.`);
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: () => removeRole(role.id),
    onSuccess: () => {
      onNotice(`The role ${role.name} was removed.`);
      refresh();
    },
  });

  return (
    <li className="bg-card border-border flex flex-col gap-3 rounded-[14px] border p-4">
      <div>
        <h2 className="text-ink text-base font-semibold">{role.name}</h2>
        <p className="text-slate text-sm">
          {role.description ? `${role.description} · ` : ""}
          {role.members} {role.members === 1 ? "person" : "people"}
        </p>
      </div>
      <PermissionBoxes all={all} value={permissions} onChange={setPermissions} idPrefix={role.id} />
      {save.isError ? <Problem error={save.error} /> : null}
      {remove.isError ? <Problem error={remove.error} /> : null}
      <div className="flex flex-wrap gap-2">
        <Button disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save role"}
        </Button>
        {role.members === 0 ? (
          <Button variant="outline" disabled={remove.isPending} onClick={() => remove.mutate()}>
            Remove role
          </Button>
        ) : null}
      </div>
    </li>
  );
}
