import type { Metadata } from "next";
import { CompareView } from "./compare-view";

export const metadata: Metadata = { title: "เทียบแผน" };

export default function ComparePage() {
  return <CompareView />;
}
