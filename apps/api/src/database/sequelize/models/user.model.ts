import {
  Column,
  CreatedAt,
  DataType,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';

@Table({ tableName: 'users', timestamps: true, underscored: true })
export class UserModel extends Model {
  @PrimaryKey
  @Column({ type: DataType.UUID })
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  declare email: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare password_hash: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare role: 'PLAYER' | 'CLUB_ADMIN' | 'SUPER_ADMIN';

  @CreatedAt
  declare created_at: Date;

  @UpdatedAt
  declare updated_at: Date;
}
