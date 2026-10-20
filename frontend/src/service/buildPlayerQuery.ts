interface PlayerQueryParams {
  page?: number;
  pageSize?: number;
  league?: string;
  team?: string;
  position?: string;
}

export function buildPlayerQuery(params: PlayerQueryParams): string {
  const query = new URLSearchParams();

  if (params.page !== undefined && params.page > 0) {
    query.append('page', params.page.toString());
  }
  if (params.pageSize !== undefined && params.pageSize > 0) {
    query.append('pageSize', params.pageSize.toString());
  }
  if (params.league?.trim()) {
    query.append('league', params.league.trim());
  }
  if (params.team?.trim()) {
    query.append('team', params.team.trim());
  }
  if (params.position?.trim()) {
    query.append('position', params.position.trim());
  }

  return query.toString();
}
