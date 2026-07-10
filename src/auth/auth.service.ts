import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(dto: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (!existingUser) {
      const hashedPassword = await bcrypt.hash(dto.password, 10);
      const newUser = await this.prisma.user.create({
        data: {
          password: hashedPassword,
          username: dto.username,
        },
      });
      return newUser;
    }
    throw new ConflictException('El nombre de usuario ya está registrado');
  }
}
