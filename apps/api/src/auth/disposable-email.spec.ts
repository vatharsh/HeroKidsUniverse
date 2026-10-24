import { isDisposableEmail } from './disposable-email';

describe('isDisposableEmail', () => {
  it('blocks throwaway services and their subdomains', () => {
    expect(isDisposableEmail('kid@mailinator.com')).toBe(true);
    expect(isDisposableEmail('x@Yopmail.com')).toBe(true);
    expect(isDisposableEmail('a@inbox.guerrillamail.com')).toBe(true);
  });
  it('allows normal addresses', () => {
    expect(isDisposableEmail('parent@gmail.com')).toBe(false);
    expect(isDisposableEmail('mom@yahoo.co.in')).toBe(false);
    expect(isDisposableEmail('dad@company.in')).toBe(false);
  });
});
