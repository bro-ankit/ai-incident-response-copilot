import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class WeakEvalCaseDto {
  @Expose()
  @ApiProperty({ type: String })
  incidentTitle!: string;

  @Expose()
  @ApiProperty({ type: Number })
  correctnessScore!: number;

  @Expose()
  @ApiProperty({ type: Number })
  groundednessScore!: number;
}

export class EvalRunItemDto {
  @Expose()
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @Expose()
  @ApiProperty({ type: String, format: 'uuid' })
  incidentId!: string;

  @Expose()
  @ApiProperty({ type: String })
  incidentTitle!: string;

  @Expose()
  @ApiProperty({ type: String, nullable: true })
  hypothesis!: string | null;

  @Expose()
  @ApiProperty({ type: Number })
  correctnessScore!: number;

  @Expose()
  @ApiProperty({ type: Number })
  groundednessScore!: number;

  @Expose()
  @ApiProperty({ type: String })
  reasoning!: string;

  @Expose()
  @Type(() => Date)
  @ApiProperty({ type: Date })
  createdAt!: Date;
}

export class RunEvalsResponseDto {
  @Expose()
  @ApiProperty({ type: Number })
  totalCases!: number;

  @Expose()
  @ApiProperty({ type: Number })
  avgCorrectness!: number;

  @Expose()
  @ApiProperty({ type: Number })
  avgGroundedness!: number;

  @Expose()
  @Type(() => WeakEvalCaseDto)
  @ApiProperty({ type: [WeakEvalCaseDto] })
  weakCases!: WeakEvalCaseDto[];

  @Expose()
  @Type(() => EvalRunItemDto)
  @ApiProperty({ type: [EvalRunItemDto] })
  runs!: EvalRunItemDto[];
}
