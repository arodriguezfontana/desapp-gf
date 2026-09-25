# Quickstart Guide: Football-Data Integration

**Feature**: Football-Data Integration (`007-football-data-integration`)
**Date**: 2026-09-24

## Prerequisites
- Node.js & pnpm / npm installed
- Docker Running (PostgreSQL container / Testcontainers active)
- Environment variable `FOOTBALL_DATA_API_TOKEN` set in local development (`.env`)

## Setup Commands

1. **Environment Configuration**:
   Ensure `FOOTBALL_DATA_API_TOKEN` is present in `backend/.env`:
   ```bash
   FOOTBALL_DATA_API_TOKEN=your_real_api_key_here
   ```

2. **Run Unit Tests**:
   Execute pure domain status classifier and service unit tests:
   ```bash
   cd backend
   npm run test src/domain/match-status-classifier.spec.ts
   npm run test src/adapters/http-football-data-adapter.spec.ts
   npm run test src/services/football-data-sync.service.spec.ts
   ```

3. **Run Integration Tests**:
   Execute database repository & sync integration tests using captured JSON fixtures:
   ```bash
   cd backend
   npm run test src/repositories/typeorm-match.repository.integration.spec.ts
   npm run test src/services/football-data-sync.service.integration.spec.ts
   ```

## Verifying Background Sync Execution

1. Start NestJS Backend in Development Mode:
   ```bash
   cd backend
   npm run start:dev
   ```

2. Inspect Structured Logs for Sync Output:
   Expected log entries:
   ```text
   [FootballDataSyncService] Starting scheduled Football-Data synchronization...
   [FootballDataSyncService] Successfully synchronized matches and standings for league PL
   [FootballDataSyncService] Successfully synchronized matches and standings for league BL1
   [FootballDataSyncService] Successfully synchronized matches and standings for league PD
   [FootballDataSyncService] Successfully synchronized matches and standings for league SA
   [FootballDataSyncService] Successfully synchronized matches and standings for league FL1
   [FootballDataSyncService] Football-Data sync completed successfully.
   ```

3. Database Verification:
   Query database to verify persisted matches and standings:
   ```sql
   SELECT league_code, status, classification, count(*) FROM matches GROUP BY league_code, status, classification;
   SELECT league_code, count(*), count(crest_url) as with_crest FROM standings GROUP BY league_code;
   ```

