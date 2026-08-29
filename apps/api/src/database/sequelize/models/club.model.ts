import {
  Column,
  CreatedAt,
  DataType,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';

@Table({ tableName: 'clubs', timestamps: true, underscored: true })
export class ClubModel extends Model {
  @PrimaryKey
  @Column({ type: DataType.UUID })
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column(DataType.STRING)
  declare city: string | null;

  @Column(DataType.STRING)
  declare zone: string | null;

  @Column(DataType.STRING)
  declare address: string | null;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;
}
