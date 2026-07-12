"use client";

import {
  Meter,
  MeterIndicator,
  MeterLabel,
  MeterTrack,
  MeterValue,
} from "@fugue/ui/components/meter";

export function ResourceMeter({
  label,
  value,
  suffix = "%",
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  const normalized = Math.max(0, Math.min(100, value));

  return (
    <Meter value={normalized}>
      <div className="coss-row coss-row--between">
        <MeterLabel className="coss-help">{label}</MeterLabel>
        <MeterValue className="coss-help coss-mono">
          {(_formattedValue, meterValue) => `${meterValue}${suffix}`}
        </MeterValue>
      </div>
      <MeterTrack>
        <MeterIndicator />
      </MeterTrack>
    </Meter>
  );
}
