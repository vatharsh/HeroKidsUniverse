import { storyReadyEmail } from './story-ready-email';

describe('storyReadyEmail', () => {
  const base = { to: 'parent@example.com', parentName: 'Asha', heroName: 'Aarav', storyTitle: 'The Dragon of Ooty', storyId: 'abc-123' };

  it('links to the story and names the hero', () => {
    const mail = storyReadyEmail(base);
    expect(mail.subject).toContain("Aarav's new story is ready");
    expect(mail.text).toContain('/stories/abc-123');
    expect(mail.html).toContain('/stories/abc-123');
    expect(mail.html).toContain('The Dragon of Ooty');
  });

  it('escapes names so they cannot inject HTML', () => {
    const mail = storyReadyEmail({ ...base, heroName: '<b>x</b>', storyTitle: '"><script>' });
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).not.toContain('<b>x</b>');
  });

  it('only shows https cover images', () => {
    expect(storyReadyEmail({ ...base, coverImageUrl: '/uploads/c.png' }).html).not.toContain('<img');
    expect(storyReadyEmail({ ...base, coverImageUrl: 'https://cdn.example.com/c.png' }).html).toContain('<img');
  });
});
