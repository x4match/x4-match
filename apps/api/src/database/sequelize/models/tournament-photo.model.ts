import {
  Column,
  CreatedAt,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { TournamentModel } from './tournament.model';
import { UserModel } from './user.model';

@Table({ tableName: 'tournament_photos', timestamps: false, underscored: true })
export class TournamentPhotoModel extends Model {
  @PrimaryKey
  @Column({ type: DataType.UUID })
  declare id: string;

  @ForeignKey(() => TournamentModel)
  @Column({ type: DataType.UUID, allowNull: false })
  declare tournament_id: string;

  @ForeignKey(() => UserModel)
  @Column({ type: DataType.UUID, allowNull: false })
  declare uploaded_by_user_id: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare photo_url: string;

  @Column(DataType.TEXT)
  declare cloudinary_public_id: string | null;

  @Column(DataType.TEXT)
  declare caption: string | null;

  @CreatedAt
  declare created_at: Date;
}
