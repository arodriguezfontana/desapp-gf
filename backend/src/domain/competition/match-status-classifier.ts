export type MatchClassificationType = 'RESULT' | 'FIXTURE';

export type DeferralReason = 'DEFERRED_TEMPORARY' | 'DEFERRED_PERMANENT' | 'UNKNOWN_STATUS';

export interface MatchStatusClassification {
  persist: boolean;
  classification?: MatchClassificationType;
  includeScore?: boolean;
  reason?: DeferralReason;
}

export function classifyMatchStatus(status: string): MatchStatusClassification {
  switch (status) {
    case 'FINISHED':
      return {
        persist: true,
        classification: 'RESULT',
        includeScore: true,
      };
    case 'SCHEDULED':
    case 'TIMED':
      return {
        persist: true,
        classification: 'FIXTURE',
        includeScore: false,
      };
    case 'IN_PLAY':
    case 'PAUSED':
    case 'POSTPONED':
    case 'SUSPENDED':
      return {
        persist: false,
        reason: 'DEFERRED_TEMPORARY',
      };
    case 'CANCELLED':
    case 'AWARDED':
      return {
        persist: false,
        reason: 'DEFERRED_PERMANENT',
      };
    default:
      return {
        persist: false,
        reason: 'UNKNOWN_STATUS',
      };
  }
}

