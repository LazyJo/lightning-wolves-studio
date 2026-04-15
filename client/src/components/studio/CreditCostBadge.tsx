import { Zap } from "lucide-react";

interface Props {
  cost: number;
  color?: string;
  size?: "sm" | "md";
}

export default function CreditCostBadge({ cost, color = "#f5c518", size = "sm" }: Props) {
  const isSm = size === "sm";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold ${
        isSm ? "px-2.5 py-1 text-[10px]" : "px-3 py-1.5 text-xs"
      }`}
      style={{ backgroundColor: `${color}10`, color }}
    >
      <Zap size={isSm ? 10 : 12} style={{ fill: color }} />
      {cost}
    </span>
  );
}
