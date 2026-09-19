import { describe, expect, it } from "vitest";
import { resolvePriceVisibility } from "@/hooks/usePriceVisibility";

describe("resolvePriceVisibility", () => {
  it("strictly follows showPriceForGuests when user is not logged in", () => {
    // 未登录时，不受 override 影响，严格遵守 showPriceForGuests
    expect(resolvePriceVisibility(false, false, null)).toBe(false);
    expect(resolvePriceVisibility(false, false, "visible")).toBe(false);
    expect(resolvePriceVisibility(false, true, null)).toBe(true);
    expect(resolvePriceVisibility(false, true, "hidden")).toBe(true);
  });

  it("defaults to visible for logged-in admin regardless of showPriceForGuests", () => {
    expect(resolvePriceVisibility(true, false, null)).toBe(true);
    expect(resolvePriceVisibility(true, true, null)).toBe(true);
    expect(resolvePriceVisibility(true, false, "visible")).toBe(true);
  });

  it("respects temporary hidden override for logged-in admin", () => {
    expect(resolvePriceVisibility(true, true, "hidden")).toBe(false);
    expect(resolvePriceVisibility(true, false, "hidden")).toBe(false);
  });

  it("suppresses node card price tags when price visibility resolves to false", () => {
    const rawPrice = "¥30.00/月";
    // 访客未开放价格
    const guestHidden = resolvePriceVisibility(false, false, null);
    expect(guestHidden ? rawPrice : null).toBeNull();

    // 访客开放价格
    const guestVisible = resolvePriceVisibility(false, true, null);
    expect(guestVisible ? rawPrice : null).toBe(rawPrice);

    // 管理员临时隐藏价格
    const adminHidden = resolvePriceVisibility(true, true, "hidden");
    expect(adminHidden ? rawPrice : null).toBeNull();

    // 管理员正常显示价格
    const adminVisible = resolvePriceVisibility(true, false, "visible");
    expect(adminVisible ? rawPrice : null).toBe(rawPrice);
  });
});
