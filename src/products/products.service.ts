import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import type { JwtPayload } from 'src/auth/jwt-payload.interface';
import { UpdateProductDto } from './dto/update-product.dto';
import { FindProductsDto } from './dto/find-products.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto, user: JwtPayload) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { userId: user.id },
    });

    if (!inventory) {
      const newInventory = await this.prisma.inventory.create({
        data: { userId: user.id },
      });
      const newProduct = await this.prisma.product.create({
        data: {
          category: dto.category,
          name: dto.name,
          price: dto.price,
          purchasePrice: dto.purchasePrice,
          stock: dto.stock,
          inventoryId: newInventory.id,
        },
      });
      return newProduct;
    }
    const newProduct = await this.prisma.product.create({
      data: {
        category: dto.category,
        name: dto.name,
        price: dto.price,
        purchasePrice: dto.purchasePrice,
        stock: dto.stock,
        inventoryId: inventory?.id,
      },
    });
    return newProduct;
  }

  async findAll(user: JwtPayload, dto: FindProductsDto) {
    const { page, limit, category } = dto;

    const inventory = await this.prisma.inventory.findUnique({
      where: {
        userId: user.id,
      },
      select: {
        id: true,
      },
    });

    if (!inventory) {
      throw new NotFoundException();
    }

    const skip = (page - 1) * limit;

    const where = {
      inventoryId: inventory.id,
      ...(category && { category }),
    };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          id: 'asc',
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      pagination: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(user: JwtPayload, productId: number) {
    await this.validateProduct(user, productId);
    return await this.prisma.product.findUnique({
      where: { id: productId },
    });
  }

  async update(dto: UpdateProductDto, user: JwtPayload, productId: number) {
    await this.validateProduct(user, productId);
    return await this.prisma.product.update({
      where: { id: productId },
      data: {
        category: dto?.category,
        name: dto?.name,
        price: dto?.price,
        stock: dto?.stock,
      },
    });
  }

  async delete(user: JwtPayload, productId: number) {
    await this.validateProduct(user, productId);
    return await this.prisma.product.delete({
      where: { id: productId },
    });
  }

  private async validateProduct(user: JwtPayload, productId: number) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { userId: user.id },
    });

    if (!inventory)
      throw new NotFoundException(
        'No se encontró un inventario para este usuario',
      );
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) throw new NotFoundException('Producto no encontrado');
    if (inventory.id !== product?.inventoryId)
      throw new UnauthorizedException(
        'El producto solicitado no está en tu inventario',
      );
    return true;
  }
}
