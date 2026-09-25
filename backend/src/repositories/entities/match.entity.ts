import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('matches')
@Index('idx_matches_external_id', ['externalId'], { unique: true })
export class MatchEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'external_id', type: 'integer', unique: true })
  externalId!: number;

  @Column({ name: 'league_code', type: 'varchar', length: 10 })
  leagueCode!: string;

  @Column({ name: 'season', type: 'integer' })
  season!: number;

  @Column({ name: 'matchday', type: 'integer' })
  matchday!: number;

  @Column({ name: 'utc_date', type: 'timestamp with time zone' })
  utcDate!: Date;

  @Column({ name: 'status', type: 'varchar', length: 20 })
  status!: string;

  @Column({ name: 'classification', type: 'varchar', length: 20 })
  classification!: 'RESULT' | 'FIXTURE';

  @Column({ name: 'home_team_id', type: 'integer' })
  homeTeamId!: number;

  @Column({ name: 'home_team_name', type: 'varchar', length: 100 })
  homeTeamName!: string;

  @Column({ name: 'away_team_id', type: 'integer' })
  awayTeamId!: number;

  @Column({ name: 'away_team_name', type: 'varchar', length: 100 })
  awayTeamName!: string;

  @Column({ name: 'home_score', type: 'integer', nullable: true })
  homeScore!: number | null;

  @Column({ name: 'away_score', type: 'integer', nullable: true })
  awayScore!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

