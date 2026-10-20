import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRanking } from './useRanking';
import * as rankingServiceModule from '../service/rankingService';

describe('useRanking', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getRanking delega en rankingService.getRanking', async () => {
    const mockResponse = { items: [], total: 0, page: 1, pageSize: 10 };
    const spy = vi
      .spyOn(rankingServiceModule.rankingService, 'getRanking')
      .mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useRanking());
    const res = await result.current.getRanking({ page: 1, pageSize: 10 });

    expect(spy).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
    expect(res).toEqual(mockResponse);
  });
});
