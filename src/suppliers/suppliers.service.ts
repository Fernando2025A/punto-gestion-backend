// src/suppliers/suppliers.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  // Helper privado para obtener o crear el inventario del usuario
  private async getOrCreateInventory(userId: string) {
    let inventory = await this.prisma.inventory.findUnique({
      where: { userId },
    });

    if (!inventory) {
      inventory = await this.prisma.inventory.create({
        data: { userId },
      });
    }

    return inventory;
  }

  // Crear proveedor asociado al usuario
  async create(createSupplierDto: CreateSupplierDto, userId: string) {
    const inventory = await this.getOrCreateInventory(userId);

    // Validar si ya existe el nombre en este inventario
    const existing = await this.prisma.supplier.findUnique({
      where: {
        name_inventoryId: {
          name: createSupplierDto.name,
          inventoryId: inventory.id,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'Ya existe un proveedor con este nombre en tu inventario',
      );
    }

    return await this.prisma.supplier.create({
      data: {
        ...createSupplierDto,
        inventoryId: inventory.id,
      },
    });
  }

  // Listar todos los proveedores del usuario
  async findAll(userId: string) {
    const inventory = await this.getOrCreateInventory(userId);

    return await this.prisma.supplier.findMany({
      where: { inventoryId: inventory.id },
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  // Obtener un proveedor por ID y userId
  async findOne(id: number, userId: string) {
    const inventory = await this.getOrCreateInventory(userId);
    return await this.findOneByIdAndInventory(id, inventory.id);
  }

  // Método auxiliar reutilizable (útil para ProductsService cuando ya se tiene el inventoryId)
  async findOneByIdAndInventory(id: number, inventoryId: number) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, inventoryId },
      include: {
        products: {
          select: { id: true, name: true, stock: true },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    return supplier;
  }

  // Actualizar proveedor
  async update(
    id: number,
    updateSupplierDto: UpdateSupplierDto,
    userId: string
  ) {
    const supplier = await this.findOne(id, userId); // Ya me asegura pertenencia y existencia

    return await this.prisma.supplier.update({
      where: { id: supplier.id },
      data: updateSupplierDto,
    });
  }

  // Eliminar proveedor
  async remove(id: number, userId: string) {
    const supplier = await this.findOne(id, userId); // Ya me asegura pertenencia y existencia

    return await this.prisma.supplier.delete({
      where: { id: supplier.id },
    });
  }
}