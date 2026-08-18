import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Post,
} from '@nestjs/common';
import { BusinessService } from './business.service';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { PermissionsGuard } from 'src/auth/guards/permission.guard';
import { Permissions } from 'src/auth/decorators/permission.decorator';
import { Permission } from 'generated/prisma/enums';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Controller('business')
@UseGuards(PermissionsGuard)
export class BusinessController {
  constructor(
    private readonly businessService: BusinessService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // GET /business/my-access -> Lista de negocios para el selector global
  @Get('my-access')
  findAllForUser(@CurrentUser('id') userId: string) {
    return this.businessService.findAllForUser(userId);
  }

  // GET /business/active/1 -> Contexto y permisos del negocio seleccionado
  @Get('active/:id')
  getActiveBusinessContext(
    @CurrentUser('id') userId: string,
    @Param('id', ParseIntPipe) businessId: number,
  ) {
    return this.businessService.getActiveBusinessContext(userId, businessId);
  }

  // PATCH /business/1 -> Actualizar nombre / descripción
  @Permissions(Permission.UPDATE_BUSINESS)
  @Patch(':businessId')
  @UseInterceptors(FileInterceptor('file'))
  async updateBusiness(
    @Param('businessId', ParseIntPipe) businessId: number,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateBusinessDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      const uploadResult = await this.cloudinaryService.uploadFile(file);
      dto.imageUrl = uploadResult.secure_url;
    }

    return this.businessService.updateBusiness(businessId, userId, dto);
  }

  @Permissions(Permission.CREATE_EXPENSE)
  @Post('expense/:businessId')
  createExpense(
    @Param('businessId', ParseIntPipe) businessId: number,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.businessService.createExpense(userId, dto, businessId);
  }
}
