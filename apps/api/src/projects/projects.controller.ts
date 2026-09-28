import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';
import { ProjectOwnerGuard } from '../common/guards/project-owner.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { InviteMemberDto, UpdateMemberDto } from './dto/member.dto';
import {
  CreateProjectDto,
  ListProjectsQueryDto,
  UpdateProjectDto,
} from './dto/project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: ListProjectsQueryDto,
  ) {
    return this.projectsService.findAll(user, query);
  }

  @Post()
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: AuthUser) {
    return this.projectsService.create(dto, user);
  }

  @Get(':id')
  @UseGuards(ProjectMemberGuard)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projectsService.findOne(id, user);
  }

  @Patch(':id')
  @UseGuards(ProjectOwnerGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projectsService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(ProjectOwnerGuard)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projectsService.remove(id, user);
  }

  @Get(':id/progress')
  @UseGuards(ProjectMemberGuard)
  getProgress(@Param('id') id: string) {
    return this.projectsService.getProgress(id);
  }

  @Post(':id/members')
  @UseGuards(ProjectOwnerGuard)
  inviteMember(
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projectsService.inviteMember(id, dto, user);
  }

  @Patch(':id/members/:userId')
  @UseGuards(ProjectOwnerGuard)
  updateMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projectsService.updateMember(id, userId, dto, user);
  }

  @Delete(':id/members/:userId')
  @UseGuards(ProjectOwnerGuard)
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projectsService.removeMember(id, userId, user);
  }
}
