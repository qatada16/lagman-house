import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '@/constants/theme';
import { AppText } from '@/components/ui';

export interface BarDatum {
  label: string;
  value: number;
}

interface Props {
  data: BarDatum[];
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
  emptyLabel: string;
  width?: number;
}

const AXIS_W = 44;
const PAD_T = 12;
const PAD_B = 26;

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return m * p;
}

export function BarChart({ data, height = 200, color = colors.action, formatValue = (v) => String(v), emptyLabel, width }: Props) {
  const { width: winW } = useWindowDimensions();
  const w = width ?? Math.min(winW - 64, 720);
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <AppText variant="small">{emptyLabel}</AppText>
      </View>
    );
  }
  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const plotW = w - AXIS_W;
  const plotH = height - PAD_T - PAD_B;
  const slot = plotW / data.length;
  const barW = Math.max(4, Math.min(28, slot * 0.6));
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.floor(plotW / 44)));
  const ticks = [0, 0.5, 1];

  return (
    <Svg width={w} height={height}>
      {ticks.map((tk) => {
        const y = PAD_T + plotH - plotH * tk;
        return (
          <G key={tk}>
            <Line x1={AXIS_W} x2={w} y1={y} y2={y} stroke={colors.border} strokeWidth={1} />
            <SvgText x={AXIS_W - 6} y={y + 4} fontSize={10} fill={colors.surfaceMuted} textAnchor="end">
              {formatValue(max * tk)}
            </SvgText>
          </G>
        );
      })}
      {data.map((d, i) => {
        const h = (d.value / max) * plotH;
        const x = AXIS_W + slot * i + (slot - barW) / 2;
        const y = PAD_T + plotH - h;
        return (
          <G key={`${d.label}-${i}`}>
            <Rect x={x} y={y} width={barW} height={Math.max(h, d.value > 0 ? 2 : 0)} rx={3} fill={color} />
            {i % labelEvery === 0 ? (
              <SvgText x={x + barW / 2} y={height - 8} fontSize={10} fill={colors.surfaceMuted} textAnchor="middle">
                {d.label}
              </SvgText>
            ) : null}
          </G>
        );
      })}
    </Svg>
  );
}

// Horizontal bars for ranked comparisons (top items).
export function HBarChart({ data, color = colors.accentDark, formatValue = (v) => String(v), emptyLabel, width }: Omit<Props, 'height'>) {
  const { width: winW } = useWindowDimensions();
  const w = width ?? Math.min(winW - 64, 720);
  if (data.length === 0) {
    return (
      <View style={{ height: 80, alignItems: 'center', justifyContent: 'center' }}>
        <AppText variant="small">{emptyLabel}</AppText>
      </View>
    );
  }
  const max = Math.max(...data.map((d) => d.value)) || 1;
  const rowH = 30;
  const labelW = Math.min(150, w * 0.4);
  const barMax = w - labelW - 56;
  return (
    <Svg width={w} height={rowH * data.length}>
      {data.map((d, i) => {
        const bw = Math.max(2, (d.value / max) * barMax);
        const y = i * rowH;
        return (
          <G key={`${d.label}-${i}`}>
            <SvgText x={labelW - 8} y={y + rowH / 2 + 4} fontSize={11} fill={colors.textPrimary} textAnchor="end">
              {d.label.length > 22 ? `${d.label.slice(0, 21)}~` : d.label}
            </SvgText>
            <Rect x={labelW} y={y + 7} width={bw} height={rowH - 14} rx={3} fill={color} />
            <SvgText x={labelW + bw + 6} y={y + rowH / 2 + 4} fontSize={11} fill={colors.surfaceMuted}>
              {formatValue(d.value)}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}
