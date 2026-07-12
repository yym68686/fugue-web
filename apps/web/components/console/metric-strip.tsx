import { Badge } from "@fugue/ui/components/badge";
import { Card, CardPanel } from "@fugue/ui/components/card";

type MetricTone = "default" | "success" | "warning" | "destructive" | "info";

export function MetricStrip({
  items,
}: {
  items: Array<{ label: string; value: string; tone?: MetricTone }>;
}) {
  return (
    <div className="coss-grid-4" data-slot="metric-grid">
      {items.map((item) => (
        <Card key={item.label}>
          <CardPanel>
            <div className="coss-stack-sm">
              <span className="coss-help">{item.label}</span>
              <strong className="coss-metric-value">{item.value}</strong>
              {item.tone ? (
                <Badge variant={item.tone === "destructive" ? "error" : item.tone}>
                  {item.tone}
                </Badge>
              ) : null}
            </div>
          </CardPanel>
        </Card>
      ))}
    </div>
  );
}
