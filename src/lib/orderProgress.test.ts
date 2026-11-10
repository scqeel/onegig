import { describe, it, expect } from "vitest";
import { getOrderProgress, networkTagCode } from "./orderProgress";

const states = (status: string) => getOrderProgress(status).steps.map((s) => s.state);

describe("getOrderProgress", () => {
  it.each(["pending", "processing"])("shows a %s order as still being sent", (status) => {
    const progress = getOrderProgress(status);
    expect(states(status)).toEqual(["done", "current", "upcoming"]);
    expect(progress.tone).toBe("active");
    expect(progress.isActive).toBe(true);
  });

  it("completes every step for a delivered order", () => {
    const progress = getOrderProgress("delivered");
    expect(states("delivered")).toEqual(["done", "done", "done"]);
    expect(progress.tone).toBe("success");
    expect(progress.isActive).toBe(false);
  });

  it("marks the final step failed for a failed order", () => {
    const progress = getOrderProgress("failed");
    expect(states("failed")).toEqual(["done", "done", "failed"]);
    expect(progress.tone).toBe("failed");
    expect(progress.isActive).toBe(false);
  });

  it("labels a refunded order as refunded rather than delivered", () => {
    const progress = getOrderProgress("refunded");
    expect(states("refunded")).toEqual(["done", "done", "failed"]);
    expect(progress.steps[2].label).toBe("Refunded");
  });

  it("never claims delivery for a status it doesn't recognise", () => {
    expect(states("something-new")).toEqual(["done", "current", "upcoming"]);
  });
});

describe("networkTagCode", () => {
  it.each([
    ["MTN", "MTN"],
    ["mtn data", "MTN"],
    ["Telecel", "TELECEL"],
    ["Vodafone", "TELECEL"],
    ["AirtelTigo", "AT"],
  ])("maps %s to %s", (name, code) => {
    expect(networkTagCode(name)).toBe(code);
  });

  it("returns null when the network is unknown", () => {
    expect(networkTagCode(undefined)).toBeNull();
    expect(networkTagCode("Result Checker")).toBeNull();
  });
});
