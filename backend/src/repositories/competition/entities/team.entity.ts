import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('teams')
@Index('idx_teams_whoscored_name', ['whoScoredName'], { unique: true })
export class TeamEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'whoscored_name', type: 'varchar', length: 200 })
  whoScoredName!: string;

  @Column({ name: 'football_data_team_id', type: 'integer' })
  footballDataTeamId!: number;

  @Column({ name: 'football_data_team_name', type: 'varchar', length: 100 })
  footballDataTeamName!: string;

  @Column({ name: 'league_code', type: 'varchar', length: 10 })
  leagueCode!: string;

  @Column({ name: 'crest_url', type: 'varchar', length: 500, nullable: true })
  crestUrl!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
