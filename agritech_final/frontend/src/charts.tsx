// Tiny SVG charts for line (groundwater trend) and grouped bars (comparison).
import { Text, View } from "react-native";
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { colors } from "@/src/theme";

type LineProps = { points: { x: string | number; y: number }[]; width?: number; height?: number; unit?: string };

export function LineChart({ points, width = 320, height = 160, unit = "" }: LineProps) {
  if (points.length === 0) return <View />;
  const pad = { l: 40, r: 16, t: 16, b: 28 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const ys = points.map((p) => p.y);
  const yMin = Math.min(...ys) - 0.5;
  const yMax = Math.max(...ys) + 0.5;
  const yRange = Math.max(yMax - yMin, 0.5);
  const dx = points.length > 1 ? w / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = pad.l + i * dx;
    const y = pad.t + (1 - (p.y - yMin) / yRange) * h;
    return { x, y };
  });
  const poly = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const yTicks = [yMin, (yMin + yMax) / 2, yMax];

  return (
    <Svg width={width} height={height} testID="line-chart">
      {/* axes */}
      <Line x1={pad.l} y1={pad.t} x2={pad.l} y2={height - pad.b} stroke={colors.border} strokeWidth={1} />
      <Line x1={pad.l} y1={height - pad.b} x2={width - pad.r} y2={height - pad.b} stroke={colors.border} strokeWidth={1} />
      {yTicks.map((t, i) => {
        const y = pad.t + (1 - (t - yMin) / yRange) * h;
        return (
          <SvgText key={i} x={pad.l - 6} y={y + 4} fontSize="10" fill={colors.muted} textAnchor="end">
            {t.toFixed(1)}
          </SvgText>
        );
      })}
      <Polyline points={poly} fill="none" stroke={colors.brandPrimary} strokeWidth={2.5} />
      {coords.map((c, i) => (
        <Circle key={i} cx={c.x} cy={c.y} r={4} fill={colors.brandSecondary} />
      ))}
      {points.map((p, i) => (
        <SvgText
          key={i}
          x={pad.l + i * dx}
          y={height - pad.b + 16}
          fontSize="10"
          fill={colors.muted}
          textAnchor="middle"
        >
          {String(p.x)}
        </SvgText>
      ))}
      <SvgText x={width - pad.r} y={pad.t - 4} fontSize="10" fill={colors.muted} textAnchor="end">
        {unit}
      </SvgText>
    </Svg>
  );
}

type BarProps = {
  labels: string[];
  with_values: number[];
  without_values: number[];
  width?: number;
  height?: number;
  withLabel: string;
  withoutLabel: string;
};

export function GroupedBarChart({ labels, with_values, without_values, width = 340, height = 220, withLabel, withoutLabel }: BarProps) {
  const pad = { l: 32, r: 12, t: 24, b: 44 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const groups = labels.length;
  const groupW = w / Math.max(groups, 1);
  const barW = Math.max(6, (groupW - 8) / 2);
  const maxV = Math.max(1, ...with_values, ...without_values);
  const rounded = Math.ceil(maxV / 25) * 25;

  return (
    <Svg width={width} height={height} testID="bar-chart">
      <Line x1={pad.l} y1={pad.t} x2={pad.l} y2={height - pad.b} stroke={colors.border} />
      <Line x1={pad.l} y1={height - pad.b} x2={width - pad.r} y2={height - pad.b} stroke={colors.border} />
      {[0, 0.5, 1].map((f, i) => (
        <SvgText key={i} x={pad.l - 6} y={pad.t + (1 - f) * h + 4} fontSize="10" fill={colors.muted} textAnchor="end">
          {Math.round(rounded * f)}
        </SvgText>
      ))}
      {labels.map((lbl, i) => {
        const gx = pad.l + i * groupW + 4;
        const vWith = with_values[i] ?? 0;
        const vWithout = without_values[i] ?? 0;
        const hWith = (vWith / rounded) * h;
        const hWithout = (vWithout / rounded) * h;
        return (
          <G key={i}>
            <Rect
              x={gx}
              y={height - pad.b - hWithout}
              width={barW}
              height={hWithout}
              fill={colors.muted}
              rx={2}
            />
            <Rect
              x={gx + barW + 2}
              y={height - pad.b - hWith}
              width={barW}
              height={hWith}
              fill={colors.brandPrimary}
              rx={2}
            />
            <SvgText
              x={gx + barW}
              y={height - pad.b + 14}
              fontSize="9"
              fill={colors.onSurface}
              textAnchor="middle"
            >
              {lbl.length > 8 ? lbl.slice(0, 7) + "…" : lbl}
            </SvgText>
          </G>
        );
      })}
      {/* legend */}
      <Rect x={pad.l} y={4} width={10} height={10} fill={colors.muted} rx={2} />
      <SvgText x={pad.l + 14} y={13} fontSize="10" fill={colors.onSurface}>{withoutLabel}</SvgText>
      <Rect x={pad.l + 110} y={4} width={10} height={10} fill={colors.brandPrimary} rx={2} />
      <SvgText x={pad.l + 124} y={13} fontSize="10" fill={colors.onSurface}>{withLabel}</SvgText>
    </Svg>
  );
}

export function ImportanceBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.max(0, Math.min(1, value / (max || 1)));
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ color: colors.onSurface, fontSize: 13 }}>{label}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{(value * 100).toFixed(1)}%</Text>
      </View>
      <View style={{ height: 8, backgroundColor: colors.surfaceTertiary, borderRadius: 4, overflow: "hidden" }}>
        <View style={{ width: `${pct * 100}%`, height: 8, backgroundColor: colors.brandPrimary }} />
      </View>
    </View>
  );
}

// 7-day rainfall bars. Height maps 0..maxScale mm to 0..44px. Optional
// `maxMm` locks the y-axis so paired strips (past vs forecast) are visually
// comparable at a glance.
export function RainfallStrip({ items, width = 340, maxMm }: {
  items: { date: string; mm: number }[]; width?: number; maxMm?: number;
}) {
  if (!items.length) return null;
  const scale = Math.max(1, maxMm ?? Math.max(...items.map((i) => i.mm)));
  const barMax = 44;
  const barW = Math.max(12, (width - 24) / items.length - 6);

  return (
    <View style={{ paddingHorizontal: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: barMax + 6 }}>
        {items.map((it, i) => {
          const h = Math.max(2, (it.mm / scale) * barMax);
          return (
            <View key={i} style={{ width: barW, alignItems: "center" }}>
              <Text style={{ color: colors.muted, fontSize: 9, marginBottom: 2 }}>{it.mm.toFixed(1)}</Text>
              <View style={{
                width: barW - 2, height: h,
                backgroundColor: it.mm > 0 ? colors.brandPrimary : colors.surfaceTertiary,
                borderRadius: 3,
              }} />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        {items.map((it, i) => {
          const dt = new Date(it.date);
          const dow = isNaN(dt.getTime())
            ? String(it.date).slice(-2)
            : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()];
          return (
            <View key={i} style={{ width: barW, alignItems: "center" }}>
              <Text style={{ color: colors.muted, fontSize: 10 }}>{dow}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// Small preview map: Telangana districts as dots, farm as a filled marker,
// nearest reference as a highlighted ring, with a line between them.
export function MapPreview(props: {
  bbox: { lat_min: number; lat_max: number; lon_min: number; lon_max: number };
  districts: { district: string; lat: number; lon: number }[];
  farm: { lat: number; lon: number; label?: string };
  reference: { district: string; lat: number; lon: number; distance_km?: number } | null;
  width?: number;
  height?: number;
}) {
  const { bbox, districts, farm, reference, width = 340, height = 180 } = props;
  const pad = 12;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const xy = (lat: number, lon: number) => {
    const x = pad + ((lon - bbox.lon_min) / (bbox.lon_max - bbox.lon_min)) * w;
    // latitude decreases downward on screen
    const y = pad + (1 - (lat - bbox.lat_min) / (bbox.lat_max - bbox.lat_min)) * h;
    return { x, y };
  };

  const farmXY = xy(farm.lat, farm.lon);
  const refXY = reference ? xy(reference.lat, reference.lon) : null;
  const farmInsideBbox =
    farm.lat >= bbox.lat_min && farm.lat <= bbox.lat_max &&
    farm.lon >= bbox.lon_min && farm.lon <= bbox.lon_max;

  return (
    <Svg width={width} height={height} testID="map-preview">
      {/* subtle bounding box */}
      <Rect x={pad} y={pad} width={w} height={h} fill={colors.surfaceTertiary} rx={12} />
      {/* district dots */}
      {districts.map((d) => {
        const p = xy(d.lat, d.lon);
        return <Circle key={d.district} cx={p.x} cy={p.y} r={2.5} fill={colors.muted} />;
      })}
      {/* line from farm → reference (when both defined) */}
      {refXY && farmInsideBbox ? (
        <Line
          x1={farmXY.x} y1={farmXY.y} x2={refXY.x} y2={refXY.y}
          stroke={colors.brandSecondary} strokeWidth={1.5} strokeDasharray="4,3"
        />
      ) : null}
      {/* reference ring */}
      {refXY ? (
        <>
          <Circle cx={refXY.x} cy={refXY.y} r={9} stroke={colors.brandSecondary} strokeWidth={2} fill="none" />
          <Circle cx={refXY.x} cy={refXY.y} r={4} fill={colors.brandSecondary} />
          <SvgText x={refXY.x} y={refXY.y - 12} fontSize="9" fill={colors.brandSecondary} textAnchor="middle">
            {reference?.district}
          </SvgText>
        </>
      ) : null}
      {/* farm marker */}
      {farmInsideBbox ? (
        <>
          <Circle cx={farmXY.x} cy={farmXY.y} r={6} fill={colors.brandPrimary} />
          <Circle cx={farmXY.x} cy={farmXY.y} r={2} fill={colors.onBrandPrimary} />
          <SvgText x={farmXY.x} y={farmXY.y + 16} fontSize="9" fill={colors.brandPrimary} textAnchor="middle">
            {farm.label ?? "Farm"}
          </SvgText>
        </>
      ) : (
        <SvgText x={pad + w / 2} y={pad + h / 2} fontSize="10" fill={colors.muted} textAnchor="middle">
          Farm outside Telangana — showing reference only
        </SvgText>
      )}
    </Svg>
  );
}
