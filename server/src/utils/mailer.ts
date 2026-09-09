import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER || 'no-reply@smolelab.com',
    pass: process.env.SMTP_PASS || '',
  },
});

const fromAddress = `"SplitTrack" <${process.env.SMTP_USER || 'no-reply@smolelab.com'}>`;

export const sendVerificationEmail = async (to: string, token: string, baseUrl: string) => {
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

  const mailOptions = {
    from: fromAddress,
    to,
    subject: 'Verify your new email address',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Verify your email address</h2>
        <p style="color: #555;">You recently requested to change your email address on SplitTrack.</p>
        <p style="color: #555;">Please click the button below to verify your new email address:</p>
        <div style="margin: 30px 0;">
          <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify Email</a>
        </div>
        <p style="color: #555; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="color: #555; font-size: 14px; word-break: break-all;">${verifyUrl}</p>
        <hr style="border: none; border-top: 1px solid #eaeaea; margin: 24px 0;" />
        <p style="color: #888; font-size: 12px;">SplitTrack Team</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${to}`);
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
};

export const sendPasswordResetEmail = async (
  to: string,
  token: string,
  baseUrl: string,
  userName?: string
) => {
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  const greeting = userName ? `Hi ${userName},` : 'Hi,';

  const mailOptions = {
    from: fromAddress,
    to,
    subject: 'Reset your SplitTrack password',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #ffffff;">
        <!-- Header -->
        <div style="background-color: #18181b; padding: 32px 24px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">SplitTrack</h1>
        </div>

        <!-- Body -->
        <div style="padding: 32px 24px; border: 1px solid #e4e4e7; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="color: #27272a; font-size: 16px; margin: 0 0 16px 0;">${greeting}</p>
          <p style="color: #52525b; font-size: 14px; line-height: 1.6; margin: 0 0 8px 0;">
            An administrator has initiated a password reset for your account. Click the button below to set a new password:
          </p>

          <!-- CTA Button -->
          <div style="margin: 28px 0; text-align: center;">
            <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; letter-spacing: 0.3px;">Reset Password</a>
          </div>

          <p style="color: #71717a; font-size: 13px; line-height: 1.5; margin: 0 0 8px 0;">
            This link will expire in <strong>1 hour</strong>. If you did not expect this reset, you can safely ignore this email — your current password will remain unchanged.
          </p>

          <!-- Fallback Link -->
          <div style="margin: 20px 0; padding: 16px; background-color: #f4f4f5; border-radius: 6px;">
            <p style="color: #71717a; font-size: 12px; margin: 0 0 6px 0;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="color: #3f3f46; font-size: 12px; word-break: break-all; margin: 0;">${resetUrl}</p>
          </div>

          <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />

          <p style="color: #a1a1aa; font-size: 11px; margin: 0; text-align: center;">
            &copy; SplitTrack &middot; Shared Expense Management
          </p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${to}`);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};
