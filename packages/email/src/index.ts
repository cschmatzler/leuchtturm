import { Resend } from "resend";

import { resendApiKey } from "@chevrotain/email/config";

export const resend = new Resend(resendApiKey);
