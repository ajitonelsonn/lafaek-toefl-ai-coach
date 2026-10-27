export type FieldErrors<K extends string> = Partial<Record<K, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(email: string): string | undefined {
  if (!email.trim()) return "Please enter your email.";
  if (!EMAIL_RE.test(email.trim())) return "Please enter a valid email, like name@example.com.";
}

export function validateLogin(v: { email: string; password: string }): FieldErrors<"email" | "password"> {
  const errors: FieldErrors<"email" | "password"> = {};
  const email = validateEmail(v.email);
  if (email) errors.email = email;
  if (!v.password) errors.password = "Please enter your password.";
  return errors;
}

export function validateSignup(v: { name: string; email: string; password: string; confirm: string }): FieldErrors<
  "name" | "email" | "password" | "confirm"
> {
  const errors: FieldErrors<"name" | "email" | "password" | "confirm"> = {};
  if (v.name.trim().length < 2) errors.name = "Please enter your name (at least 2 letters).";
  const email = validateEmail(v.email);
  if (email) errors.email = email;
  if (v.password.length < 8) errors.password = "Use at least 8 characters.";
  else if (!/[A-Za-z]/.test(v.password) || !/\d/.test(v.password)) errors.password = "Use letters and at least one number.";
  if (v.confirm !== v.password) errors.confirm = "The passwords do not match.";
  return errors;
}
