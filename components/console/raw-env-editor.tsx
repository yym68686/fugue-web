import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import type { RawEnvFeedback } from "@/lib/console/raw-env";

type RawEnvEditorProps = {
  clearLabel?: string;
  feedback: RawEnvFeedback;
  fieldId: string;
  hint?: string;
  label?: string;
  onChange: (value: string) => void;
  optionalLabel?: string;
  placeholder?: string;
  value: string;
};

const DEFAULT_HINT =
  "Quoted values, blank lines, comments, and export prefixes are supported.";

const DEFAULT_PLACEHOLDER = `DATABASE_URL=postgres://user:pass@host/db
PUBLIC_API_BASE=https://api.example.com
# comments are ignored`;

export function RawEnvEditor({
  clearLabel = "Clear environment",
  feedback,
  fieldId,
  hint = DEFAULT_HINT,
  label = "Raw environment",
  onChange,
  optionalLabel = "Optional",
  placeholder = DEFAULT_PLACEHOLDER,
  value,
}: RawEnvEditorProps) {
  return (
    <div className="fg-env-raw">
      {value.trim() ? (
        <div className="fg-env-section__actions">
          <Button
            onClick={() => onChange("")}
            size="compact"
            type="button"
            variant="secondary"
          >
            {clearLabel}
          </Button>
        </div>
      ) : null}

      <FormField
        hint={hint}
        htmlFor={fieldId}
        label={label}
        optionalLabel={optionalLabel}
      >
        <textarea
          aria-invalid={feedback.valid ? undefined : true}
          autoCapitalize="off"
          autoCorrect="off"
          className="fg-project-textarea fg-env-raw__textarea"
          id={fieldId}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          value={value}
        />
      </FormField>

      <InlineAlert variant={feedback.variant}>{feedback.message}</InlineAlert>
    </div>
  );
}
