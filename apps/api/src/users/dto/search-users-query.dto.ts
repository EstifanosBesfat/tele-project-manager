import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchUsersQueryDto {
  @ApiProperty({ minLength: 2 })
  @IsString()
  @MinLength(2)
  q!: string;

  @ApiPropertyOptional({
    description:
      'When set, results are limited to members of this project. The caller must be a member (or ADMIN).',
  })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
