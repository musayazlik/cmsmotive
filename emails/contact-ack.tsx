import { Body, Button, Column, Container, Head, Heading, Hr, Html, Preview, Row, Section, Text, render } from "react-email";

/**
 * Auto-reply for the contact form: tells the sender their message arrived and
 * that we reply within 24 hours. Brand palette mirrors app/panel.css
 * (--indigo #4353e8, --lime #c6f36a). Kept to table-friendly layout and
 * web-safe font fallbacks so Outlook and friends degrade gracefully.
 */

const INDIGO = "#4353e8";
const LIME = "#c6f36a";
const INK = "#101418";
const MUTED = "#5e666d";
const LINE = "#dce1e0";
const CANVAS = "#f7f8f5";
const SOFT = "#fafbf9";
const SITE_URL = "https://cmsmotive.de";

export type ContactAckProps = {
  /** Full name as entered in the form; the first word is used in the greeting. */
  name: string;
  agency: string;
  message: string;
};

export function ContactAckEmail({ name, agency, message }: ContactAckProps) {
  const firstName = name.trim().split(/\s+/)[0] || "there";

  return (
    <Html lang="en">
      <Head />
      <Preview>We got your message — we will get back to you within 24 hours.</Preview>
      <Body
        style={{
          backgroundColor: CANVAS,
          margin: 0,
          padding: "36px 16px",
          fontFamily: "'DM Sans', Arial, Helvetica, sans-serif",
          color: INK,
        }}
      >
        <Container
          style={{
            maxWidth: 560,
            margin: "0 auto",
            backgroundColor: "#ffffff",
            border: `1px solid ${LINE}`,
            borderRadius: 14,
          }}
        >
          <Section style={{ padding: "26px 36px 0" }}>
            <Row>
              <Column>
                <Text style={{ margin: 0, fontSize: 15, fontWeight: 800, letterSpacing: "0.06em" }}>
                  CMSMotive<span style={{ color: INDIGO }}>.</span>
                </Text>
              </Column>
              <Column style={{ textAlign: "right" }}>
                <Text
                  style={{
                    margin: 0,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    color: MUTED,
                  }}
                >
                  CONTACT / AUTO-REPLY
                </Text>
              </Column>
            </Row>
          </Section>

          <Section style={{ padding: "34px 36px 0" }}>
            <Section
              style={{
                backgroundColor: LIME,
                borderRadius: 6,
                padding: "5px 10px",
                display: "inline-block",
              }}
            >
              <Text style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "#162015" }}>
                MESSAGE RECEIVED
              </Text>
            </Section>
            <Heading
              as="h1"
              style={{
                margin: "16px 0 0",
                fontSize: 27,
                lineHeight: 1.15,
                letterSpacing: "-0.04em",
                fontWeight: 800,
              }}
            >
              Thanks, {firstName} — your message is with us.
            </Heading>
            <Text style={{ margin: "14px 0 0", fontSize: 14.5, lineHeight: 1.7, color: MUTED }}>
              We read every inquiry personally. Our team will get back to you within{" "}
              <strong style={{ color: INK }}>24 hours</strong> at this e-mail address. If anything is
              urgent in the meantime, just reply to this message.
            </Text>
          </Section>

          <Section style={{ padding: "26px 36px 0" }}>
            <Section
              style={{
                backgroundColor: SOFT,
                borderLeft: `3px solid ${LIME}`,
                borderRadius: "0 9px 9px 0",
                padding: "16px 18px",
              }}
            >
              <Text style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: MUTED }}>
                WHAT YOU SENT US
              </Text>
              <Text style={{ margin: "6px 0 0", fontSize: 13.5, lineHeight: 1.6 }}>
                <strong>{agency}</strong>
              </Text>
              <Text style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.7, color: MUTED, whiteSpace: "pre-wrap" }}>
                {message}
              </Text>
            </Section>
          </Section>

          <Section style={{ padding: "28px 36px 0" }}>
            <Button
              href={SITE_URL}
              style={{
                backgroundColor: INDIGO,
                color: "#ffffff",
                borderRadius: 8,
                padding: "13px 22px",
                fontSize: 13,
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              Explore CMSMotive
            </Button>
          </Section>

          <Section style={{ padding: "30px 36px 0" }}>
            <Hr style={{ margin: 0, border: 0, borderTop: `1px solid ${LINE}` }} />
            <Text style={{ margin: "16px 0 0", fontSize: 11.5, lineHeight: 1.7, color: MUTED }}>
              You received this e-mail because you filled in the contact form on cmsmotive.de. No action
              is needed — replies to this address reach our team directly at hello@cmsmotive.de.
            </Text>
          </Section>

          <Section style={{ padding: "0 36px 30px" }}>
            <Text style={{ margin: 0, fontSize: 10, letterSpacing: "0.08em", color: MUTED }}>
              CMSMOTIVE — TYPO3 THEMES &amp; EXTENSIONS
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

ContactAckEmail.PreviewProps = {
  name: "Ada Lovelace",
  agency: "Analytical Engines Ltd",
  message:
    "We would like a demo of the Nordform theme for three upcoming client projects, please get back to us.",
} satisfies ContactAckProps;

export function renderContactAckEmail(props: ContactAckProps): Promise<string> {
  return render(<ContactAckEmail {...props} />);
}
