"use client";

import { useEffect, useState } from "react";
import { MessageSquareTextIcon, PhoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { detectPlatform, smsHref, telHref } from "@/lib/retail/phone";

/**
 * Tap-to-call and tap-to-text from a customer record. Free path: `tel:` and
 * `sms:` deep links open the phone's own apps with the number (and a
 * prefilled message) filled in; nothing is sent by the app itself.
 */
export function ContactButtons({ phone, name, size = "sm" }: { phone: string | null; name?: string | null; size?: "sm" | "default" }) {
  const [platform, setPlatform] = useState<"ios" | "android" | "unknown">("unknown");
  useEffect(() => {
    const t = setTimeout(() => setPlatform(detectPlatform(navigator.userAgent)), 0);
    return () => clearTimeout(t);
  }, []);
  const tel = telHref(phone);
  if (!tel) return null;
  const first = (name ?? "").trim().split(/\s+/)[0];
  const sms = smsHref(phone, first ? `Hi ${first}, this is Cali Tints. ` : "Hi, this is Cali Tints. ", platform);
  return (
    <span className="flex items-center gap-2">
      <Button asChild variant="outline" size={size}>
        <a href={tel} data-testid="tap-to-call">
          <PhoneIcon /> Call
        </a>
      </Button>
      {sms && (
        <Button asChild variant="outline" size={size}>
          <a href={sms} data-testid="tap-to-text">
            <MessageSquareTextIcon /> Text
          </a>
        </Button>
      )}
    </span>
  );
}
