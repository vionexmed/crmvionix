import { describe, it, expect } from "vitest";
import { TABLES, FIELDS, CURRENCIES, DEFAULT_PAGE_SIZE } from "@/lib/constants";

describe("TABLES", () => {
  it("contains no duplicate values", () => {
    const values = Object.values(TABLES);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it("exports the core entity tables", () => {
    expect(TABLES.CONTACTS).toBe("contacts");
    expect(TABLES.DEALS).toBe("deals");
    expect(TABLES.COMPANIES).toBe("companies");
    expect(TABLES.ACTIVITIES).toBe("activities");
    expect(TABLES.PROFILES).toBe("profiles");
  });

  it("exports pipeline tables", () => {
    expect(TABLES.PIPELINES).toBe("pipelines");
    expect(TABLES.PIPELINE_STAGES).toBe("pipeline_stages");
  });
});

describe("FIELDS", () => {
  it("exports common column names", () => {
    expect(FIELDS.ORG_ID).toBe("org_id");
    expect(FIELDS.OWNER_ID).toBe("owner_id");
    expect(FIELDS.CREATED_AT).toBe("created_at");
  });
});

describe("CURRENCIES", () => {
  it("includes BRL, USD and EUR", () => {
    expect(CURRENCIES).toContain("BRL");
    expect(CURRENCIES).toContain("USD");
    expect(CURRENCIES).toContain("EUR");
  });
});

describe("DEFAULT_PAGE_SIZE", () => {
  it("is a positive integer", () => {
    expect(Number.isInteger(DEFAULT_PAGE_SIZE)).toBe(true);
    expect(DEFAULT_PAGE_SIZE).toBeGreaterThan(0);
  });
});
