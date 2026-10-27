import { describe, expect, it } from "vitest";
import { generateOtp, hashOtp, hashPassword, safeEqualHex, sha256, verifyPassword } from "@/lib/server/crypto";

describe("passwords", () => {
  it("hashes with scrypt and verifies only the right password", async () => {
    const h = await hashPassword("correct horse 1");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(h).not.toContain("correct horse");
    expect(await verifyPassword("correct horse 1", h)).toBe(true);
    expect(await verifyPassword("wrong horse 1", h)).toBe(false);
  });
  it("uses a unique salt per hash", async () => {
    expect(await hashPassword("same-pass-1")).not.toBe(await hashPassword("same-pass-1"));
  });
});

describe("OTP", () => {
  it("generates 6 digits", () => {
    for (let i = 0; i < 50; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
  });
  it("stores only a hash bound to email and purpose", () => {
    const a = hashOtp("a@example.com", "signup", "123456");
    expect(a).not.toContain("123456");
    expect(safeEqualHex(a, hashOtp("a@example.com", "signup", "123456"))).toBe(true);
    expect(safeEqualHex(a, hashOtp("b@example.com", "signup", "123456"))).toBe(false);
    expect(safeEqualHex(a, hashOtp("a@example.com", "login", "123456"))).toBe(false);
  });
  it("session tokens are stored as sha256", () => {
    expect(sha256("token")).toHaveLength(64);
  });
});
