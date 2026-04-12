import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Attempts JWT authentication but never rejects.
 * If a valid token is present, request.user is populated;
 * otherwise request.user stays undefined and the route proceeds.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      // No token or invalid token — proceed without user
    }
    return true;
  }

  handleRequest(_err: any, user: any) {
    return user || null;
  }
}
