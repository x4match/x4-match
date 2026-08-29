import {
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { UserModel } from './user.model';

@Table({ tableName: 'players', timestamps: true, underscored: true })
export class PlayerModel extends Model {
  @PrimaryKey
  @Column({ type: DataType.UUID })
  declare id: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: false, unique: true })
  declare user_id: string;

  @Column(DataType.STRING)
  declare nickname: string | null;

  @Column(DataType.STRING)
  declare city: string | null;

  @Column(DataType.STRING)
  declare zone: string | null;

  @Column(DataType.DECIMAL(3, 1))
  declare level: number | null;

  @Column(DataType.STRING)
  declare position: 'drive' | 'reves' | 'ambos' | null;

  @BelongsTo(() => UserModel)
  declare user: UserModel;

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;
}
