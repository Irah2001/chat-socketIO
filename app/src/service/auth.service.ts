import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config'; // <-- Import

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService 
  ) {}

  async login(username: string, pass: string) {
    const adminUser = {
      id: 1,
      username: this.configService.get<string>('ADMIN_USERNAME'),
      password: this.configService.get<string>('ADMIN_PASSWORD'),
      role: 'admin'
    };

    const users = [adminUser];

    const user = users.find((u) => u.username === username && u.password === pass);
    
    if (!user) {
      throw new UnauthorizedException();
    }

    const payload = { username: user.username, sub: user.id, role: user.role };
    
    return {
      access_token: this.jwtService.sign(payload),
      username: user.username,
      role: user.role
    };
  }

  async loginGuest(username: string) {
    const adminName = this.configService.get<string>('ADMIN_USERNAME') || 'admin';

    if (username.toLowerCase() === adminName.toLowerCase() || username.toLowerCase() === 'admin') {
        throw new UnauthorizedException("Ce pseudo est réservé à l'administrateur.");
    }

    if (!username || username.trim().length < 3) {
        throw new UnauthorizedException("Le pseudo doit faire au moins 3 caractères.");
    }

    const payload = { 
        username: username, 
        sub: 'guest_' + Date.now(),
        role: 'user'
    };

    return {
      access_token: this.jwtService.sign(payload),
      username: username,
      role: 'user'
    };
  }

  verifyToken(token: string) {
    try {
      return this.jwtService.verify(token);
    } catch (e) {
      return null;
    }
  }
}