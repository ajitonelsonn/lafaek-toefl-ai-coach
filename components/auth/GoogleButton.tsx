/** Placeholder for future Google sign-in. Disabled because no OAuth provider is configured. */
export function GoogleButton() {
  return (
    <div>
      <button
        type="button"
        disabled
        aria-describedby="google-note"
        className="flex h-12 w-full cursor-not-allowed items-center justify-center gap-3 rounded-[var(--radius-control)] border border-line bg-surface text-[15px] font-semibold text-ink opacity-60"
      >
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" />
          <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.2V7.2H2.1a11 11 0 0 0 0 9.8l3.7-2.8z" />
          <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.2L5.8 10C6.7 7.4 9.1 5.4 12 5.4z" />
        </svg>
        Continue with Google
      </button>
      <p id="google-note" className="mt-1.5 text-center text-xs text-muted">
        Google sign-in is not available yet.
      </p>
    </div>
  );
}
