import { applyBaseUrl } from './base-url';

describe('applyBaseUrl', () => {
  beforeEach(() => {
    // Reset the BASE_URL before each test
    import.meta.env.BASE_URL = '/';
  });

  it('should return the original path when BASE_URL is "/"', () => {
    import.meta.env.BASE_URL = '/';
    const result = applyBaseUrl('/test/path');
    expect(result).toBe('/test/path');
  });

  it('should return the original path when BASE_URL is empty', () => {
    import.meta.env.BASE_URL = '';
    const result = applyBaseUrl('/test/path');
    expect(result).toBe('/test/path');
  });

  it('should prepend the BASE_URL to the path', () => {
    import.meta.env.BASE_URL = '/base/';
    const result = applyBaseUrl('/test/path');
    expect(result).toBe('/base/test/path');
  });

  it('should handle BASE_URL without trailing slash', () => {
    import.meta.env.BASE_URL = '/base';
    const result = applyBaseUrl('/test/path');
    expect(result).toBe('/base/test/path');
  });

  it('should handle paths without leading slash', () => {
    import.meta.env.BASE_URL = '/base/';
    const result = applyBaseUrl('test/path');
    expect(result).toBe('/base/test/path');
  });

  it('should not modify absolute URLs', () => {
    import.meta.env.BASE_URL = '/base/';
    const result = applyBaseUrl('https://example.com/test/path');
    expect(result).toBe('https://example.com/test/path');
  });

  it('should handle if neither href nor baseUrl have slashes', () => {
    import.meta.env.BASE_URL = 'base';
    const result = applyBaseUrl('test/path');
    expect(result).toBe('base/test/path');
  });
});
