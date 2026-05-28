import Image from "next/image";

type Props = {
  src?: string | null;
  name?: string;
  size?: number;
  variant?: "default" | "light";
};

export function Logo({ src, name = "Pretty Chic", size = 64, variant = "default" }: Props) {
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const bg = variant === "light" ? "rgba(255,255,255,0.08)" : "var(--color-primary)";
  const fg = variant === "light" ? "#F6EFE4" : "#FFFBF4";
  if (src) {
    return (
      <div
        className="rounded-2xl overflow-hidden flex items-center justify-center"
        style={{ width: size, height: size, background: bg }}
      >
        <Image src={src} alt={name} width={size} height={size} style={{ objectFit: "cover" }} unoptimized />
      </div>
    );
  }
  return (
    <div
      className="rounded-2xl flex items-center justify-center font-serif"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}
