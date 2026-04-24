import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
  PrismaClientInitializationError,
  PrismaClientUnknownRequestError,
  PrismaClientRustPanicError,
} from '@prisma/client/runtime/library';
import { PrismaExceptionFilter } from './prisma-exception.filter';

type AnyPrisma =
  | PrismaClientKnownRequestError
  | PrismaClientValidationError
  | PrismaClientInitializationError
  | PrismaClientUnknownRequestError
  | PrismaClientRustPanicError;

function isPrismaError(exception: unknown): exception is AnyPrisma {
  return (
    exception instanceof PrismaClientKnownRequestError ||
    exception instanceof PrismaClientValidationError ||
    exception instanceof PrismaClientInitializationError ||
    exception instanceof PrismaClientUnknownRequestError ||
    exception instanceof PrismaClientRustPanicError
  );
}

/**
 * Catches all unhandled errors so the process never returns an unstructured 500
 * and production clients never see stack traces or Prisma-internal messages
 * (except where PrismaExceptionFilter maps known codes to safe HTTP responses).
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');
  private readonly prismaFilter = new PrismaExceptionFilter();

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') {
      throw exception instanceof Error ? exception : new Error(String(exception));
    }

    if (isPrismaError(exception)) {
      return this.prismaFilter.catch(exception, host);
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const resBody = exception.getResponse();
      if (typeof resBody === 'string') {
        return response.status(status).json({
          statusCode: status,
          message: resBody,
          error: exception.name,
        });
      }
      return response.status(status).json(resBody);
    }

    const err = exception as Error;
    this.logger.error(
      `${request.method} ${request.url} — ${err?.name ?? 'Error'}: ${err?.message ?? 'unknown'}`,
      err?.stack,
    );
    const isProd = process.env.NODE_ENV === 'production';
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: isProd ? 'Internal server error' : err?.message ?? 'Unknown error',
      error: 'Internal Server Error',
    });
  }
}
