import { classifyMatchStatus } from './match-status-classifier';

describe('classifyMatchStatus', () => {
  it('should classify FINISHED status as RESULT with score', () => {
    const result = classifyMatchStatus('FINISHED');
    expect(result).toEqual({
      persist: true,
      classification: 'RESULT',
      includeScore: true,
    });
  });

  it('should classify SCHEDULED status as FIXTURE without score', () => {
    const result = classifyMatchStatus('SCHEDULED');
    expect(result).toEqual({
      persist: true,
      classification: 'FIXTURE',
      includeScore: false,
    });
  });

  it('should classify TIMED status as FIXTURE without score', () => {
    const result = classifyMatchStatus('TIMED');
    expect(result).toEqual({
      persist: true,
      classification: 'FIXTURE',
      includeScore: false,
    });
  });

  it('should defer temporary states such as POSTPONED, IN_PLAY, PAUSED, SUSPENDED', () => {
    const statuses = ['IN_PLAY', 'PAUSED', 'POSTPONED', 'SUSPENDED'];
    statuses.forEach((status) => {
      const result = classifyMatchStatus(status);
      expect(result).toEqual({
        persist: false,
        reason: 'DEFERRED_TEMPORARY',
      });
    });
  });

  it('should permanently ignore CANCELLED and AWARDED states', () => {
    const statuses = ['CANCELLED', 'AWARDED'];
    statuses.forEach((status) => {
      const result = classifyMatchStatus(status);
      expect(result).toEqual({
        persist: false,
        reason: 'DEFERRED_PERMANENT',
      });
    });
  });

  it('should return UNKNOWN_STATUS for unrecognized status strings', () => {
    const result = classifyMatchStatus('UNKNOWN_FOO_BAR');
    expect(result).toEqual({
      persist: false,
      reason: 'UNKNOWN_STATUS',
    });
  });
});

