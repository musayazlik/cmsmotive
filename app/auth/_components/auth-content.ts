/** Account pages served at /auth/<page> — one folder per page, one entry here. */
export const AUTH_PAGES = ["sign-in", "sign-up", "forgot-password", "reset-password", "verify-email"] as const;

export type AuthPageName = (typeof AUTH_PAGES)[number];

export type AuthField = {
  name: string;
  label: string;
  type: "text" | "email" | "password";
  autocomplete: string;
  placeholder: string;
  minLength?: number;
  /** Small help line rendered under the input. */
  hint?: string;
};

/** Copy and form fields shared by the React account pages. */
export type AuthContent = {
  documentTitle: string;
  eyebrow: string;
  title: string;
  description: string;
  storyTitle: string;
  storyDescription: string;
  fields: AuthField[];
  submitLabel: string;
  switchText: string;
  switchLabel: string;
  switchPage: AuthPageName;
  /** Help paragraph between the fields and the submit button (forgot-password). */
  formHelp?: string;
  /** Terms/privacy checkbox above the submit button (sign-up). */
  terms?: boolean;
};

export const AUTH_CONTENT: Record<AuthPageName, AuthContent> = {
  "sign-in": {
    documentTitle: "Welcome back.",
    eyebrow: "Welcome back",
    title: "Welcome back.",
    description: "Sign in to your CMSMotive account.",
    storyTitle: "Good work starts with a good foundation.",
    storyDescription: "A quieter place for the tools, themes and ideas behind your next TYPO3 build.",
    fields: [
      { name: "email", label: "Email address", type: "email", autocomplete: "email", placeholder: "you@studio.com" },
      { name: "password", label: "Password", type: "password", autocomplete: "current-password", placeholder: "Enter your password" },
    ],
    submitLabel: "Sign in",
    switchText: "New to CMSMotive?",
    switchLabel: "Create an account",
    switchPage: "sign-up",
  },
  "sign-up": {
    documentTitle: "Create your account.",
    eyebrow: "Start here",
    title: "Create your account.",
    description: "Manage your products and account in one place.",
    storyTitle: "Build with intention. Grow with clarity.",
    storyDescription: "The right foundations give every new idea more room to become something useful.",
    fields: [
      { name: "name", label: "Full name", type: "text", autocomplete: "name", placeholder: "Your name" },
      { name: "email", label: "Work email", type: "email", autocomplete: "email", placeholder: "you@studio.com" },
      { name: "password", label: "Password", type: "password", autocomplete: "new-password", placeholder: "Create a password", minLength: 8, hint: "Use at least 8 characters." },
    ],
    submitLabel: "Create account",
    switchText: "Already have an account?",
    switchLabel: "Sign in",
    switchPage: "sign-in",
    terms: true,
  },
  "forgot-password": {
    documentTitle: "Forgot your password?",
    eyebrow: "Account recovery",
    title: "Forgot your password?",
    description: "Enter your email address to request a password reset link.",
    storyTitle: "The details make the difference.",
    storyDescription: "A clear path back to your workspace, built with the same care as the products inside it.",
    fields: [{ name: "email", label: "Email address", type: "email", autocomplete: "email", placeholder: "you@studio.com" }],
    submitLabel: "Request reset link",
    switchText: "Remembered your password?",
    switchLabel: "Back to sign in",
    switchPage: "sign-in",
    formHelp: "We’ll send a secure reset link if an account exists for this address.",
  },
  "reset-password": {
    documentTitle: "Set a new password.",
    eyebrow: "Account recovery",
    title: "Set a new password.",
    description: "Choose a new password for your CMSMotive account.",
    storyTitle: "Pick up right where you left off.",
    storyDescription: "Your projects and resources should always be easy to return to.",
    fields: [
      { name: "password", label: "New password", type: "password", autocomplete: "new-password", placeholder: "Create a new password", minLength: 8 },
      { name: "confirm_password", label: "Confirm new password", type: "password", autocomplete: "new-password", placeholder: "Repeat your new password", minLength: 8, hint: "Use at least 8 characters. Both passwords must match." },
    ],
    submitLabel: "Set new password",
    switchText: "Need a new reset link?",
    switchLabel: "Request one",
    switchPage: "forgot-password",
  },
  "verify-email": {
    documentTitle: "Confirm your email.",
    eyebrow: "One more step",
    title: "Confirm your email.",
    description: "Confirm your address to activate your account.",
    storyTitle: "From idea to implementation.",
    storyDescription: "Everything works better when the path forward feels clear from the start.",
    fields: [],
    submitLabel: "Resend verification email",
    switchText: "Wrong address?",
    switchLabel: "Create a new account",
    switchPage: "sign-up",
  },
};
