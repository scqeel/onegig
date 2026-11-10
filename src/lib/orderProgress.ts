export type OrderStepState = "done" | "current" | "upcoming" | "failed";

export interface OrderProgress {
  headline: string;
  tone: "active" | "success" | "failed";
  isActive: boolean;
  steps: { label: string; state: OrderStepState }[];
}

/** Turns an order status into what a customer should see. Unknown statuses never claim delivery. */
export function getOrderProgress(status: string): OrderProgress {
  switch (status) {
    case "delivered":
      return {
        headline: "Delivered",
        tone: "success",
        isActive: false,
        steps: [
          { label: "Paid", state: "done" },
          { label: "Sent to network", state: "done" },
          { label: "Delivered", state: "done" },
        ],
      };
    case "failed":
    case "refunded": {
      const refunded = status === "refunded";
      return {
        headline: refunded ? "Refunded" : "Delivery failed",
        tone: "failed",
        isActive: false,
        steps: [
          { label: "Paid", state: "done" },
          { label: "Sent to network", state: "done" },
          { label: refunded ? "Refunded" : "Failed", state: "failed" },
        ],
      };
    }
    default:
      return {
        headline: "On its way",
        tone: "active",
        isActive: true,
        steps: [
          { label: "Paid", state: "done" },
          { label: "Sending to network", state: "current" },
          { label: "Delivered", state: "upcoming" },
        ],
      };
  }
}

/** Orders store a network name, while the network badge needs its code. */
export function networkTagCode(name?: string | null): "MTN" | "TELECEL" | "AT" | null {
  const n = String(name ?? "").toUpperCase();
  if (n.includes("MTN")) return "MTN";
  if (n.includes("TELECEL") || n.includes("VODAFONE")) return "TELECEL";
  if (n.includes("AIRTEL") || n.includes("TIGO") || n === "AT") return "AT";
  return null;
}
