import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SearchQueryDto {
  @ApiProperty({ type: String, description: 'Natural language query to search runbooks/postmortems semantically' })
  @IsString()
  @IsNotEmpty()
  q!: string;
}
