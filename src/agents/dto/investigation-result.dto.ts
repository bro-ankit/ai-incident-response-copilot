import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import { RemediationStepDto } from './remediation-step.dto';
import { RootCauseHypothesisDto } from './root-cause-hypothesis.dto';

export class InvestigationResultDto {
  @Expose()
  @ApiProperty({ type: String, format: 'uuid' })
  incidentId!: string;

  @Expose()
  @ApiProperty({ type: String, nullable: true })
  logFindings!: string | null;

  @Expose()
  @ApiProperty({ type: String, nullable: true })
  runbookFindings!: string | null;

  @Expose()
  @Type(() => RootCauseHypothesisDto)
  @ApiProperty({ type: [RootCauseHypothesisDto], nullable: true })
  hypotheses!: RootCauseHypothesisDto[] | null;

  @Expose()
  @Type(() => RemediationStepDto)
  @ApiProperty({ type: [RemediationStepDto], nullable: true })
  remediationSteps!: RemediationStepDto[] | null;

  @Expose()
  @ApiProperty({ type: [String], description: 'What the investigation could not determine, if anything' })
  warnings!: string[];
}
