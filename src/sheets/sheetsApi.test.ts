import { describe, expect, it } from "vitest";
import { extractSpreadsheetId } from "./sheetsApi";

describe("extractSpreadsheetId", () => {
  it("extracts the spreadsheet ID from a Google Sheets URL", () => {
    expect(
      extractSpreadsheetId(
        "https://docs.google.com/spreadsheets/d/abc_123-XYZ/edit#gid=0",
      ),
    ).toBe("abc_123-XYZ");
  });

  it("keeps raw spreadsheet IDs unchanged", () => {
    expect(extractSpreadsheetId("abc_123-XYZ")).toBe("abc_123-XYZ");
  });
});
