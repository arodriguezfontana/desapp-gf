import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('standings')
@Index('idx_standings_team_league', ['externalTeamId', 'leagueCode'], { unique: true })
export class StandingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'external_team_id', type: 'integer' })
  externalTeamId!: number;

  @Column({ name: 'team_name', type: 'varchar', length: 100 })
  teamName!: string;

  @Column({ name: 'league_code', type: 'varchar', length: 10 })
  leagueCode!: string;

  @Column({ name: 'season', type: 'integer' })
  season!: number;

  @Column({ name: 'position', type: 'integer' })
  position!: number;

  @Column({ name: 'played_games', type: 'integer' })
  playedGames!: number;

  @Column({ name: 'won', type: 'integer' })
  won!: number;

  @Column({ name: 'draw', type: 'integer' })
  draw!: number;

  @Column({ name: 'lost', type: 'integer' })
  lost!: number;

  @Column({ name: 'points', type: 'integer' })
  points!: number;

  @Column({ name: 'goals_for', type: 'integer' })
  goalsFor!: number;

  @Column({ name: 'goals_against', type: 'integer' })
  goalsAgainst!: number;

  @Column({ name: 'goal_difference', type: 'integer' })
  goalDifference!: number;

  @Column({ name: 'form', type: 'varchar', length: 50, nullable: true })
  form!: string | null;

  @Column({ name: 'crest_url', type: 'varchar', length: 500, nullable: true })
  crestUrl!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

