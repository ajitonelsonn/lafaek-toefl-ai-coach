"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const control =
  "w-full rounded-[var(--radius-control)] border bg-surface text-[15px] text-ink placeholder:text-muted/80 transition-colors focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/20 disabled:bg-surface-muted disabled:text-muted";

interface FieldShellProps {
  id: string;
  label?: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
  srOnlyLabel?: boolean;
}

function FieldShell({ id, label, hint, error, children, className, srOnlyLabel }: FieldShellProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={id} className={cn("text-sm font-semibold text-ink", srOnlyLabel && "sr-only")}>
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: ReactNode;
  error?: string;
  icon?: ReactNode;
  srOnlyLabel?: boolean;
  containerClassName?: string;
}

export function Input({ label, hint, error, icon, srOnlyLabel, containerClassName, className, id, type = "text", ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  return (
    <FieldShell id={inputId} label={label} hint={hint} error={error} className={containerClassName} srOnlyLabel={srOnlyLabel}>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted [&>svg]:size-[18px]">{icon}</span>}
        <input
          id={inputId}
          type={isPassword && visible ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={cn(control, "h-12", icon ? "pl-11" : "pl-3.5", isPassword ? "pr-12" : "pr-3.5", error ? "border-danger" : "border-line", className)}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-2 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:text-ink"
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
          >
            {visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        )}
      </div>
    </FieldShell>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: ReactNode;
  error?: string;
  srOnlyLabel?: boolean;
  containerClassName?: string;
}

export function Textarea({ label, hint, error, srOnlyLabel, containerClassName, className, id, ...rest }: TextareaProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldShell id={inputId} label={label} hint={hint} error={error} className={containerClassName} srOnlyLabel={srOnlyLabel}>
      <textarea
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={cn(control, "min-h-36 resize-y p-3.5 leading-relaxed", error ? "border-danger" : "border-line", className)}
        {...rest}
      />
    </FieldShell>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: ReactNode;
  error?: string;
  srOnlyLabel?: boolean;
  containerClassName?: string;
  options: { value: string; label: string; disabled?: boolean }[];
}

export function Select({ label, hint, error, srOnlyLabel, containerClassName, className, id, options, ...rest }: SelectProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldShell id={inputId} label={label} hint={hint} error={error} className={containerClassName} srOnlyLabel={srOnlyLabel}>
      <div className="relative">
        <select
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={cn(control, "h-12 appearance-none pl-3.5 pr-10", error ? "border-danger" : "border-line", className)}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
      </div>
    </FieldShell>
  );
}
