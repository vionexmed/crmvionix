import * as React from "react";
import { AsYouType, parsePhoneNumberFromString } from "libphonenumber-js";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PhoneInputProps
  extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  value?: string;
  onChange?: (e164: string, isValid: boolean) => void;
  defaultCountry?: "BR" | "US" | "PT" | "AR" | "MX";
}

/**
 * Phone input that enforces DDI + DDD + number (E.164 storage).
 * Always shows a leading '+'. Uses Brazil as default country if user types without DDI.
 */
export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value = "", onChange, defaultCountry = "BR", className, ...props }, ref) => {
    const [display, setDisplay] = React.useState<string>(() => formatDisplay(value, defaultCountry));

    React.useEffect(() => {
      setDisplay(formatDisplay(value, defaultCountry));
    }, [value, defaultCountry]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let raw = e.target.value;
      // Always keep a leading '+'
      if (!raw.startsWith("+")) raw = "+" + raw.replace(/[^\d]/g, "");
      const formatted = new AsYouType().input(raw);
      setDisplay(formatted);

      const parsed = parsePhoneNumberFromString(raw);
      const e164 = parsed?.number ?? raw.replace(/[^\d+]/g, "");
      const isValid = parsed?.isValid() ?? false;
      onChange?.(e164, isValid);
    };

    return (
      <Input
        ref={ref}
        inputMode="tel"
        autoComplete="tel"
        placeholder="+55 81 99999-0000"
        value={display}
        onChange={handleChange}
        className={cn(className)}
        {...props}
      />
    );
  },
);
PhoneInput.displayName = "PhoneInput";

function formatDisplay(value: string, defaultCountry: "BR" | "US" | "PT" | "AR" | "MX") {
  if (!value) return "";
  const parsed = parsePhoneNumberFromString(value, defaultCountry);
  if (parsed) return parsed.formatInternational();
  const v = value.startsWith("+") ? value : "+" + value.replace(/[^\d]/g, "");
  return new AsYouType().input(v);
}

export function isValidPhone(value: string | null | undefined): boolean {
  if (!value) return false;
  const parsed = parsePhoneNumberFromString(value);
  return !!parsed?.isValid();
}
