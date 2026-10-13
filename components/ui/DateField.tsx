import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/constants/theme';
import { useLayout, useT } from '@/lib/i18n';
import { AppText } from './AppText';
import { Button } from './Button';

const MONTHS = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ur: ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'],
};
const WEEKDAYS = {
  en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
  ur: ['پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ', 'اتوار'],
};

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

interface Parsed {
  date: Date | null;
  hour: number;
  minute: number;
}

function parse(value: string, endOfDay: boolean): Parsed {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(value.trim());
  if (!m) return { date: null, hour: endOfDay ? 23 : 0, minute: endOfDay ? 59 : 0 };
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(date.getTime())) return { date: null, hour: 0, minute: 0 };
  return { date, hour: m[4] != null ? Number(m[4]) : endOfDay ? 23 : 0, minute: m[5] != null ? Number(m[5]) : endOfDay ? 59 : 0 };
}

function boundDate(text?: string) {
  return text ? parse(text, false).date : null;
}

interface Props {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  withTime?: boolean;
  endOfDay?: boolean;
  clearable?: boolean;
  placeholder?: string;
  error?: string | null;
  hint?: string;
  minDate?: string;
  maxDate?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export function DateField({ label, value, onChange, withTime, endOfDay = false, clearable, placeholder, error, hint, minDate, maxDate, containerStyle }: Props) {
  const t = useT();
  const { row, lang } = useLayout();
  const [open, setOpen] = useState(false);
  const parsed = parse(value, endOfDay);
  const display = parsed.date
    ? `${parsed.date.getDate()} ${MONTHS[lang][parsed.date.getMonth()].slice(0, lang === 'en' ? 3 : undefined)} ${parsed.date.getFullYear()}${withTime ? `  ${pad(parsed.hour)}:${pad(parsed.minute)}` : ''}`
    : '';

  return (
    <View style={[{ gap: 4 }, containerStyle]}>
      {label ? (
        <AppText variant="label" style={{ textTransform: 'uppercase' }}>
          {label}
        </AppText>
      ) : null}
      <Pressable
        collapsable={false}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [styles.field, row, error ? styles.fieldError : null, pressed ? { opacity: 0.85 } : null]}
      >
        <Feather name="calendar" size={18} color={colors.action} />
        <AppText style={{ flex: 1 }} color={display ? colors.textPrimary : colors.disabled} numberOfLines={1}>
          {display || placeholder || t('calPickDate')}
        </AppText>
        {clearable && value ? (
          <Pressable onPress={() => onChange('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('calClear')}>
            <Feather name="x-circle" size={18} color={colors.surfaceMuted} />
          </Pressable>
        ) : (
          <Feather name="chevron-down" size={18} color={colors.surfaceMuted} />
        )}
      </Pressable>
      {error ? (
        <AppText variant="small" color={colors.danger}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="small">{hint}</AppText>
      ) : null}
      {open ? (
        <CalendarModal
          initial={parsed}
          withTime={withTime}
          clearable={clearable}
          min={boundDate(minDate)}
          max={boundDate(maxDate)}
          onClose={() => setOpen(false)}
          onPick={(v) => {
            onChange(v);
            setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

function CalendarModal({ initial, withTime, clearable, min, max, onClose, onPick }: { initial: Parsed; withTime?: boolean; clearable?: boolean; min: Date | null; max: Date | null; onClose: () => void; onPick: (value: string) => void }) {
  const t = useT();
  const { row, lang, isRTL } = useLayout();
  const today = new Date();
  const [selected, setSelected] = useState<Date | null>(initial.date);
  const [view, setView] = useState(() => {
    const base = initial.date ?? today;
    return { year: base.getFullYear(), month: base.getMonth() };
  });
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);

  const cells = useMemo(() => {
    const first = new Date(view.year, view.month, 1);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(view.year, view.month + 1, 0).getDate();
    const out: (Date | null)[] = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= days; d++) out.push(new Date(view.year, view.month, d));
    while (out.length % 7) out.push(null);
    return out;
  }, [view]);

  const disabled = (d: Date) => (min ? ymd(d) < ymd(min) : false) || (max ? ymd(d) > ymd(max) : false);
  const shift = (delta: number) => setView((v) => {
    const d = new Date(v.year, v.month + delta, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const jump = (d: Date) => {
    if (disabled(d)) return;
    setSelected(d);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };
  const result = (d: Date | null) => (d ? `${ymd(d)}${withTime ? ` ${pad(hour)}:${pad(minute)}` : ''}` : '');
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const weekRows = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const weekdays = WEEKDAYS[lang];

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.dialog}>
          <View style={[row, styles.header]}>
            <Pressable onPress={() => shift(-1)} hitSlop={12} style={styles.navBtn} accessibilityRole="button">
              <Feather name={isRTL ? 'chevron-right' : 'chevron-left'} size={22} color={colors.accentDark} />
            </Pressable>
            <AppText variant="heading" align="center" style={{ flex: 1 }}>{`${MONTHS[lang][view.month]} ${view.year}`}</AppText>
            <Pressable onPress={() => shift(1)} hitSlop={12} style={styles.navBtn} accessibilityRole="button">
              <Feather name={isRTL ? 'chevron-left' : 'chevron-right'} size={22} color={colors.accentDark} />
            </Pressable>
          </View>

          <View style={[row, { gap: spacing.xs }]}>
            {[
              { label: t('calToday'), date: today },
              { label: t('calYesterday'), date: yesterday },
            ].map((q) => (
              <Pressable key={q.label} onPress={() => jump(q.date)} style={[styles.quick, selected && ymd(selected) === ymd(q.date) ? styles.quickActive : null]}>
                <AppText variant="small" weight="600" color={selected && ymd(selected) === ymd(q.date) ? colors.white : colors.accentDark}>
                  {q.label}
                </AppText>
              </Pressable>
            ))}
          </View>

          <View style={[row, styles.weekRow]}>
            {weekdays.map((w) => (
              <AppText key={w} variant="label" align="center" style={styles.cellText} numberOfLines={1}>
                {w}
              </AppText>
            ))}
          </View>
          {weekRows.map((week, wi) => (
            <View key={wi} style={[row, styles.weekRow]}>
              {week.map((d, di) => {
                if (!d) return <View key={di} style={styles.cell} />;
                const isSel = !!selected && ymd(selected) === ymd(d);
                const isToday = ymd(d) === ymd(today);
                const off = disabled(d);
                return (
                  <Pressable
                    key={di}
                    disabled={off}
                    onPress={() => setSelected(d)}
                    style={[styles.cell, isToday && !isSel ? styles.today : null, isSel ? styles.selected : null, off ? { opacity: 0.3 } : null]}
                  >
                    <AppText align="center" weight={isSel || isToday ? '700' : '400'} color={isSel ? colors.white : colors.textPrimary}>
                      {d.getDate()}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          ))}

          {withTime ? (
            <View style={[row, styles.timeRow]}>
              <Feather name="clock" size={18} color={colors.surfaceMuted} />
              <TimeSpinner value={hour} max={23} step={1} onChange={setHour} />
              <AppText variant="heading">:</AppText>
              <TimeSpinner value={minute} max={59} step={5} onChange={setMinute} />
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => { setHour(0); setMinute(0); }} style={styles.quick}>
                <AppText variant="small" weight="600" color={colors.accentDark}>00:00</AppText>
              </Pressable>
              <Pressable onPress={() => { setHour(23); setMinute(59); }} style={styles.quick}>
                <AppText variant="small" weight="600" color={colors.accentDark}>23:59</AppText>
              </Pressable>
            </View>
          ) : null}

          <View style={[row, { gap: spacing.sm, marginTop: spacing.sm }]}>
            {clearable ? <Button title={t('calClear')} variant="ghost" onPress={() => onPick('')} /> : null}
            <View style={{ flex: 1 }} />
            <Button title={t('cancel')} variant="outline" onPress={onClose} />
            <Button title={t('calSelect')} variant="action" disabled={!selected} onPress={() => onPick(result(selected))} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function TimeSpinner({ value, max, step, onChange }: { value: number; max: number; step: number; onChange: (v: number) => void }) {
  const { row } = useLayout();
  const move = (dir: 1 | -1) => {
    const size = max + 1;
    const base = dir === 1 ? Math.floor(value / step) * step + step : Math.ceil(value / step) * step - step;
    onChange(((base % size) + size) % size);
  };
  return (
    <View style={[row, { alignItems: 'center', gap: 2 }]}>
      <Pressable onPress={() => move(-1)} hitSlop={8} style={styles.spinBtn}>
        <Feather name="minus" size={16} color={colors.accentDark} />
      </Pressable>
      <AppText variant="heading" style={{ minWidth: 30 }} align="center">
        {pad(value)}
      </AppText>
      <Pressable onPress={() => move(1)} hitSlop={8} style={styles.spinBtn}>
        <Feather name="plus" size={16} color={colors.accentDark} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  fieldError: { borderColor: colors.danger },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  dialog: { width: '100%', maxWidth: 380, backgroundColor: colors.background, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  header: { alignItems: 'center' },
  navBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSidebar },
  weekRow: { justifyContent: 'space-between' },
  cell: { flex: 1, aspectRatio: 1, maxHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, margin: 1 },
  cellText: { flex: 1 },
  today: { borderWidth: 1, borderColor: colors.action },
  selected: { backgroundColor: colors.action },
  quick: { paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  quickActive: { backgroundColor: colors.accentDark, borderColor: colors.accentDark },
  timeRow: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, flexWrap: 'wrap' },
  spinBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
});
