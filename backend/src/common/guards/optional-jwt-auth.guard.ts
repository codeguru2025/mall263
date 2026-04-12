import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Attempts JWT authentication but never rejects.
 * If a valid token is present, request.user is populated;
 * otherwise request.user stays undefined and the route proceeds.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(_err: any, user: any) {
    return user || null;
  }
}
