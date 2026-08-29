import {
  Column,
  CreatedAt,
  DataType,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';

@Table({ tableName: 'tournaments', timestamps: true, underscored: true })
export class TournamentModel extends Model {
  @PrimaryKey
  @Column({ type: DataType.UUID })
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column(DataType.TEXT)
  declare description: string | null;

  @Column(DataType.STRING)
  declare status: string;

  @Column(DataType.STRING)
  declare category: string | null;

  @Column(DataType.DATE)
  declare start_date: Date | null;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;
}
