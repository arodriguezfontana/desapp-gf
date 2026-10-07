import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('team_name_exception')
@Index('idx_team_name_exception_raw_name', ['whoScoredRawName'], { unique: true })
export class TeamNameExceptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'whoscored_raw_name', type: 'varchar', length: 200 })
  whoScoredRawName!: string;

  @Column({ name: 'football_data_team_id', type: 'integer' })
  footballDataTeamId!: number;

  @Column({ name: 'football_data_team_name', type: 'varchar', length: 100 })
  footballDataTeamName!: string;

  @Column({ name: 'league_code', type: 'varchar', length: 10 })
  leagueCode!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
