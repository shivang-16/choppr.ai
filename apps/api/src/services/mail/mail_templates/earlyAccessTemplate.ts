import { baseTemplate } from './baseTemplate.js';

interface EarlyAccessTemplateOptions {
  username?: string;
  email: string;
}

export const earlyAccessTemplate = ({
  username = 'there',
  email,
}: EarlyAccessTemplateOptions) => {
  const content = `
    <div style="font-family: Arial, sans-serif; color: #1f2937;">
      <h2 style="margin: 0 0 12px 0; font-size: 22px;">Confirm Early Access</h2>
      <p style="margin: 0 0 12px 0;">Hi ${username},</p>
      <p style="margin: 0 0 12px 0;">Hi ${email},</p>


    </div>
  `;

  return baseTemplate(content);
};