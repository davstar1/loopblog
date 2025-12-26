import type { ReactNode, ElementType, CSSProperties } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  size?: "sm" | "md" | "lg";
  style?: CSSProperties;
};

const MAX: Record<NonNullable<Props["size"]>, number> = {
  sm: 860,
  md: 1100,
  lg: 1260,
};

export default function Container({
  children,
  className = "",
  as: Tag = "div",
  size = "md",
  style,
}: Props) {
  return (
    <Tag
      className={`containerX ${className}`.trim()}
      style={{
        width: "100%",
        maxWidth: MAX[size],
        margin: "0 auto",
        padding: "0 14px",
        boxSizing: "border-box",
        ...(style ?? {}),
      }}
    >
      {children}
    </Tag>
  );
}
