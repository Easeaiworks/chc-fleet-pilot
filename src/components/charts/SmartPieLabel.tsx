import * as React from "react";

export type SmartPieLabelOptions = {
  /** Maps the raw recharts `name` into the label text (e.g., extract plate). */
  getLabel?: (name: string) => string;
  /** Soft wrap width for the name portion. */
  maxCharsPerLine?: number;
  /** Max number of lines for the name portion (percent line is added separately). */
  maxNameLines?: number;
};

const RADIAN = Math.PI / 180;

function splitLongWord(word: string, max: number) {
  if (word.length <= max) return [word];
  const parts: string[] = [];
  for (let i = 0; i < word.length; i += max) {
    parts.push(word.slice(i, i + max));
  }
  return parts;
}

function wrapText(text: string, maxCharsPerLine: number, maxLines: number) {
  const words = text.trim().split(/\s+/).flatMap((w) => splitLongWord(w, maxCharsPerLine));
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);
    current = word;

    if (lines.length >= maxLines) break;
  }

  if (current && lines.length < maxLines) lines.push(current);

  if (lines.length > maxLines) {
    return lines.slice(0, maxLines);
  }

  // If we overflowed, add ellipsis to the last line.
  if (words.length && lines.join(" ").length < text.trim().length && lines.length) {
    const lastIdx = lines.length - 1;
    const last = lines[lastIdx];
    lines[lastIdx] = last.length >= 1 ? `${last.replace(/…$/g, "")}…` : "…";
  }

  return lines;
}

function pickFontSize(textLength: number) {
  if (textLength > 22) return 8;
  if (textLength > 14) return 9;
  return 10;
}

export function createSmartPieLabel(options?: SmartPieLabelOptions) {
  const {
    getLabel = (name) => name,
    maxCharsPerLine = 10,
    maxNameLines = 2,
  } = options ?? {};

  return function SmartPieLabelRenderer(props: any) {
    const cx: number | undefined = props?.cx;
    const cy: number | undefined = props?.cy;
    const midAngle: number | undefined = props?.midAngle;
    const outerRadius: number | undefined = props?.outerRadius;
    const percent: number | undefined = props?.percent;
    const rawName = String(props?.name ?? "");

    if (
      typeof cx !== "number" ||
      typeof cy !== "number" ||
      typeof midAngle !== "number" ||
      typeof outerRadius !== "number" ||
      typeof percent !== "number"
    ) {
      return null;
    }

    const labelText = getLabel(rawName);
    const percentText = `${Math.round(percent * 100)}%`;

    const nameLines = wrapText(labelText, maxCharsPerLine, maxNameLines);
    const allLines = [...nameLines, percentText];

    const fontSize = pickFontSize(labelText.length);
    const percentFontSize = Math.max(8, fontSize - 1);
    const lineHeight = fontSize + 3;

    const radius = outerRadius + 22;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const textAnchor = x > cx ? "start" : "end";

    const startY = y - ((allLines.length - 1) * lineHeight) / 2;

    return (
      <text
        x={x}
        y={y}
        textAnchor={textAnchor}
        dominantBaseline="middle"
        pointerEvents="none"
      >
        {nameLines.map((line, idx) => (
          <tspan
            key={idx}
            x={x}
            y={startY + idx * lineHeight}
            fill="hsl(var(--foreground))"
            style={{ fontSize }}
          >
            {line}
          </tspan>
        ))}
        <tspan
          x={x}
          y={startY + nameLines.length * lineHeight}
          fill="hsl(var(--muted-foreground))"
          style={{ fontSize: percentFontSize }}
        >
          {percentText}
        </tspan>
      </text>
    );
  };
}
