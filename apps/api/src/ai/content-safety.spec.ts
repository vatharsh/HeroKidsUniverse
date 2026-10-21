import { BLOCKED_PATTERN } from './content-safety.service';

describe('child-safety word list', () => {
  it.each([
    'Siddhant finds a naked mole',
    'make it sexy',
    'the villain drinks daaru',
    'chutiya dragon',
    'they smoke a cigarette',
    'SELF-HARM',
  ])('blocks %p', (text) => {
    expect(BLOCKED_PATTERN.test(text)).toBe(true);
  });

  it.each([
    'Siddhant learns a new skill in Essex',
    'Dadi feeds the kutta in the garden',
    'gore gore gaal wali gudiya',
    'pulling a weed from the garden',
    'a rocket made from bottles',
    'Siddhant and Vedant rescue the baby turtle',
  ])('allows %p', (text) => {
    expect(BLOCKED_PATTERN.test(text)).toBe(false);
  });
});
