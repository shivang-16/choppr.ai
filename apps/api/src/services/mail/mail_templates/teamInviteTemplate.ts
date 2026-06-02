export interface TeamInviteOptions {
  inviterName: string;
  teamName: string;
  invitationLink: string;
}

export const teamInviteTemplate = (options: TeamInviteOptions) => {
  const { inviterName, teamName, invitationLink } = options;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation to join ${teamName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 30px;">
    
    <!-- Logo -->
    <div style="text-align: center; margin-bottom: 32px;">
      <img 
        src="https://avatars.githubusercontent.com/u/234070194?s=400&u=c0a5026e03f1f5134ff14462283a3665fc403412&v=4" 
        alt="Beetle" 
        width="80" 
        height="80" 
        style="border-radius: 12px; display: inline-block;"
      />
    </div>

    <!-- Heading -->
    <h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 700; color: #1f2937; text-align: center;">
      Your invitation
    </h1>

    <!-- Message -->
    <p style="margin: 0 0 32px 0; font-size: 16px; color: #6b7280; line-height: 1.6; text-align: center;">
      ${inviterName} has invited you to join the <strong>${teamName}</strong> organization on Beetle.
    </p>

    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${invitationLink}" style="display: inline-block; padding: 14px 32px; background-color: #8b5cf6; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 500;">
        Accept invitation
      </a>
    </div>

    <!-- Fallback Link -->
    <p style="margin: 24px 0 0 0; font-size: 14px; color: #6b7280; text-align: center;">
      If you're having trouble with the above button, <a href="${invitationLink}" style="color: #8b5cf6; text-decoration: underline;">click here</a>.
    </p>

  </div>
</body>
</html>
  `;
};
