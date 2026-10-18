/** Client-safe contract for product review moderation and the home page showcase. */

export type ReviewSettings = {
  /** Publish new reviews immediately instead of holding them as pending. */
  autoApprove: boolean;
  /** Reviews one e-mail address may send per hour, across all products. */
  perHour: number;
  /** Lowest reCAPTCHA v3 score (0–1) a submission needs to be accepted. */
  minCaptchaScore: number;
  /** Swap the home page beta seats for approved review quotes. */
  showcase: boolean;
  /** Lowest star rating quoted on the home page. */
  showcaseMinRating: number;
};

export const DEFAULT_REVIEW_SETTINGS: ReviewSettings = {
  autoApprove: false,
  perHour: 3,
  minCaptchaScore: 0.5,
  showcase: true,
  showcaseMinRating: 4,
};

export const REVIEW_SETTING_LIMITS = {
  perHour: { min: 1, max: 50 },
  minCaptchaScore: { min: 0.1, max: 0.9 },
  showcaseMinRating: { min: 1, max: 5 },
} as const;

const inRange = (value: unknown, { min, max }: { min: number; max: number }) =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

export function validateReviewSettings(input: Record<string, unknown>): { error: string } | { data: ReviewSettings } {
  const { perHour, minCaptchaScore, showcaseMinRating } = REVIEW_SETTING_LIMITS;
  if (typeof input.autoApprove !== "boolean" || typeof input.showcase !== "boolean") {
    return { error: "Invalid review settings." };
  }
  if (!Number.isInteger(input.perHour) || !inRange(input.perHour, perHour)) {
    return { error: `The hourly limit must be a whole number between ${perHour.min} and ${perHour.max}.` };
  }
  if (!inRange(input.minCaptchaScore, minCaptchaScore)) {
    return { error: `The reCAPTCHA score must be between ${minCaptchaScore.min} and ${minCaptchaScore.max}.` };
  }
  if (!Number.isInteger(input.showcaseMinRating) || !inRange(input.showcaseMinRating, showcaseMinRating)) {
    return { error: "The minimum showcase rating must be 1 to 5 stars." };
  }
  return {
    data: {
      autoApprove: input.autoApprove,
      perHour: input.perHour as number,
      // One decimal, as offered by the slider.
      minCaptchaScore: Math.round((input.minCaptchaScore as number) * 10) / 10,
      showcase: input.showcase,
      showcaseMinRating: input.showcaseMinRating as number,
    },
  };
}
