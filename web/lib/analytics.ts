declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** 「木取り図を作成する」クリックを GA4 に送る */
export function trackCreateCuttingDiagram(params?: {
  sizeChoice?: string;
  partCount?: number;
}): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }
  window.gtag("event", "create_cutting_diagram", {
    event_category: "engagement",
    event_label: "木取り図を作成する",
    size_choice: params?.sizeChoice ?? "",
    part_count: params?.partCount ?? 0,
  });
}
