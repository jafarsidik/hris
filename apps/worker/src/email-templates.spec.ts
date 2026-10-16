import { renderNotificationEmail, renderTransactionalEmail } from './email-templates';

const options = { webBaseUrl: 'https://app.example.com', appName: 'Acme HRIS' };

describe('renderTransactionalEmail', () => {
  it('renders a password reset link from the token', () => {
    const email = renderTransactionalEmail(
      'password-reset',
      { resetToken: 'abc 123', expiresAt: '2030-01-01T00:00:00.000Z' },
      options,
    );
    expect(email.subject).toBe('Reset your Acme HRIS password');
    expect(email.html).toContain('https://app.example.com/reset-password?token=abc%20123');
    expect(email.text).toContain('https://app.example.com/reset-password?token=abc%20123');
    expect(email.text).toContain('Sent by Acme HRIS.');
  });

  it('escapes HTML in interpolated values', () => {
    const email = renderTransactionalEmail(
      'password-reset',
      { resetToken: 'x' },
      { webBaseUrl: 'https://app.example.com', appName: '<script>alert(1)</script>' },
    );
    expect(email.html).not.toContain('<script>alert(1)</script>');
    expect(email.html).toContain('&lt;script&gt;');
  });
});

describe('renderNotificationEmail', () => {
  it('splits the body into paragraphs and escapes them', () => {
    const email = renderNotificationEmail({
      subject: 'Your role changed',
      body: 'You are now a Manager.\n\nContact <admin> if this is wrong.',
      appName: 'Acme HRIS',
    });
    expect(email.subject).toBe('Your role changed');
    expect(email.html).toContain('You are now a Manager.');
    expect(email.html).toContain('Contact &lt;admin&gt; if this is wrong.');
    expect(email.text).toContain('You are now a Manager.');
  });
});
