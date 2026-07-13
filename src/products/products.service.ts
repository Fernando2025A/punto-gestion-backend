import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import type { JwtPayload } from 'src/auth/jwt-payload.interface';

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
        stock: dto.stock,
        inventoryId: inventory?.id,
      },
    });
    return newProduct;
  }

  async getProducts(user: JwtPayload) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { userId: user.id },
      include: {
        products: true,
      },
    });
    return inventory;
  }
}
