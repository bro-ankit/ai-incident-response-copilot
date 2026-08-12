import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class SearchResultDto {
  @Expose()
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @Expose()
  @ApiProperty({ type: String })
  title!: string;

  @Expose()
  @ApiProperty({ type: String })
  content!: string;

  @Expose()
  @ApiProperty({ type: [String] })
  services!: string[];

  @Expose()
  @ApiProperty({ type: Date })
  createdAt!: Date;
}
