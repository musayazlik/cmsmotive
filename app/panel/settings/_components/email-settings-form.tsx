"use client";

import { useState, useTransition } from "react";
import CheckBox from "@/app/panel/_components/ui/checkbox";
import TextField from "@/app/panel/_components/ui/text-field";
import { useToast } from "@/app/panel/_components/ui/toast";
import type { EmailSettings } from "@/lib/email-settings-shared";
import { saveEmailSettingsAction, sendTestEmailAction } from "../_actions";
import { EnvFacts, SettingsFoot, useSettingsForm } from "./settings-kit";

type Props = {
  settings: EmailSettings;
  plunkConfigured: boolean;
  /** PLUNK_FROM_EMAIL, or null when unset. */
  fromAddress: string | null;
  /** The inbox used while the recipient setting is empty. */
  fallbackRecipient: string;
};

export default function EmailSettingsForm({ settings, plunkConfigured, fromAddress, fallbackRecipient }: Props) {
  const form = useSettingsForm(settings, saveEmailSettingsAction);
  const { values, set } = form;
  const { toast, showToast } = useToast();
  const [testing, startTest] = useTransition();
  const [lastTest, setLastTest] = useState("");

  function sendTest() {
    startTest(async () => {
      const result = await sendTestEmailAction();
      if (!result.ok) {
        showToast(result.error);
        return;
      }
      setLastTest(result.to);
      showToast(`Test e-mail sent to ${result.to}.`, "success");
    });
  }

  return (
    <div className="wtable-card wsettings-card">
      <div className="wsettings-section">
        <p className="wsection-label">Delivery</p>
        <EnvFacts
          facts={[
            { label: "Plunk", value: plunkConfigured ? "Configured" : "Not configured", ok: plunkConfigured },
            { label: "Sender address", value: fromAddress ?? "PLUNK_FROM_EMAIL is empty", ok: Boolean(fromAddress) },
          ]}
        />
        <p className="wfield-hint-block" style={{ marginTop: 0 }}>
          The API key and the verified sender address stay in the environment.
        </p>
        <TextField
          label="Sender name"
          value={values.senderName}
          onChange={(value) => set("senderName", value)}
          maxLength={60}
          note="Shown as the “From” name on every message, including account e-mails."
        />
        <TextField
          label="Inbox for inquiries and notifications"
          type="email"
          value={values.contactRecipient}
          onChange={(value) => set("contactRecipient", value)}
          placeholder={fallbackRecipient}
          note={`Leave empty to use ${fallbackRecipient}. Replies to the auto-reply also land here.`}
        />
      </div>

      <div className="wsettings-section">
        <p className="wsection-label">Contact form</p>
        <CheckBox
          checked={values.contactAutoReply}
          onChange={(checked) => set("contactAutoReply", checked)}
          label="Send an auto-reply to the sender"
          note="A “we got your message” confirmation with a copy of the inquiry. The inquiry itself always reaches the inbox and the panel."
        />
      </div>

      <div className="wsettings-section">
        <p className="wsection-label">Admin notifications</p>
        <CheckBox
          checked={values.notifyReviews}
          onChange={(checked) => set("notifyReviews", checked)}
          label="New product review"
          note="Includes the rating, the text and a link to moderation."
        />
        <CheckBox
          checked={values.notifySubscribers}
          onChange={(checked) => set("notifySubscribers", checked)}
          label="New newsletter subscriber"
          note="Only first-time sign-ups; a repeated sign-up only refreshes the name."
        />
      </div>

      <SettingsFoot form={form}>
        <button
          type="button"
          className="wbtn wbtn-ghost"
          onClick={sendTest}
          disabled={testing || form.dirty || !plunkConfigured}
          title={form.dirty ? "Save your changes first" : undefined}
        >
          {testing ? "Sending…" : lastTest ? "Send again" : "Send test e-mail"}
        </button>
      </SettingsFoot>
      {toast}
    </div>
  );
}
