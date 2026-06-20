export interface WelcomeEmailOptions {
  firstName?: string | undefined;
  appUrl: string;
}

export const welcomeEmailSubject = "Welcome to Choppr! 🎉";

const demoUrl = "https://cal.com/shivang-yadav/choppr-demo";

export const welcomeEmailText = (_options: WelcomeEmailOptions) => `Hello!

Thanks for signing up for Choppr! We're excited to have you onboard. If you have any questions, just reply to this email.
Is there anything specific you're planning to use Choppr for?

Also, feel free to schedule a quick demo: ${demoUrl}

Best,
Shivang
Founder, Choppr`;

export const welcomeEmailHtml = (_options: WelcomeEmailOptions) => {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${welcomeEmailSubject}</title>
  </head>
  <body style="margin:0;background:#ffffff;font-family:Arial,sans-serif;color:#202124;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;padding:32px 16px 40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:500px;text-align:left;">
            <tr>
              <td style="padding:0;font-size:14px;line-height:1.5;color:#202124;">
                <p style="margin:0 0 22px 0;">Hello!</p>
                <p style="margin:0 0 18px 0;">
                  Thanks for signing up for <strong>Choppr</strong>! We're excited to have you onboard. If you have any questions, just reply to this email.<br />
                  Is there anything specific you're planning to use Choppr for?
                </p>
                <p style="margin:0 0 22px 0;">
                  Also, feel free to schedule a <a href="${demoUrl}" style="color:#1a73e8;text-decoration:underline;">quick demo</a> :)
                </p>
                <p style="margin:0;">
                  Best,<br />
                  <strong>Shivang</strong><br />
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};
