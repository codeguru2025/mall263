import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientRustPanicError,
  PrismaClientUnknownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/library';
import { Response } from 'express';

type AnyPrismaError =
  | PrismaClientKnownRequestError
  | PrismaClientValidationError
  | PrismaClientInitializationError
  | PrismaClientUnknownRequestError
  | PrismaClientRustPanicError;

@Catch(
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
  PrismaClientInitializationError,
  PrismaClientUnknownRequestError,
  PrismaClientRustPanicError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('PrismaExceptionFilter');

  catch(exception: AnyPrismaError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ method: string; originalUrl: string }>();

    // Always log full details so they show up in DO App Platform logs
    const code = (exception as PrismaClientKnownRequestError).code;
    const meta = (exception as PrismaClientKnownRequestError).meta;
    this.logger.error(
      `${request.method} ${request.originalUrl} — Prisma ${exception.constructor.name}${
        code ? ` [${code}]` : ''
      }: ${exception.message}`,
      exception.stack,
    );

    // Validation error — client sent bad shape
    if (exception instanceof PrismaClientValidationError) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid data supplied to the database layer',
        error: 'Bad Request',
      });
    }

    // Database is down / unreachable / not migrated
    if (exception instanceof PrismaClientInitializationError) {
      return response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Database is not reachable. Please try again shortly.',
        error: 'Service Unavailable',
        prismaCode: (exception as PrismaClientInitializationError).errorCode,
      });
    }

    if (
      exception instanceof PrismaClientUnknownRequestError ||
      exception instanceof PrismaClientRustPanicError
    ) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Unexpected database error',
        error: 'Internal Server Error',
      });
    }

    // Known request error — handle specific codes with targeted messages
    switch (code) {
      case 'P2002': {
        const targets = (meta?.target as string[] | undefined) ?? [];
        const field = targets.length ? targets.join(', ') : 'record';
        return response.status(HttpStatus.CONFLICT).json({
          statusCode: HttpStatus.CONFLICT,
          message: `A record with this ${field} already exists`,
          error: 'Conflict',
        });
      }
      case 'P2003':
        return response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Related record not found or constraint failed',
          error: 'Bad Request',
        });
      case 'P2021':
        return response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message: `Database table does not exist${
            meta?.table ? ` (${meta.table})` : ''
          }. A pending migration has not been applied yet.`,
          error: 'Service Unavailable',
          prismaCode: code,
        });
      case 'P2022':
        return response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message: `Database column does not exist${
            meta?.column ? ` (${meta.column})` : ''
          }. A pending migration has not been applied yet.`,
          error: 'Service Unavailable',
          prismaCode: code,
        });
      case 'P2023':
        return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message:
            'Inconsistent data in the database — a stored value does not match the expected column type (e.g. a malformed UUID). Please contact support.',
          error: 'Internal Server Error',
          prismaCode: code,
        });
      case 'P2025':
        return response.status(HttpStatus.NOT_FOUND).json({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Record not found',
          error: 'Not Found',
        });
      case 'P2034':
        return response.status(HttpStatus.CONFLICT).json({
          statusCode: HttpStatus.CONFLICT,
          message: 'Write conflict — please retry the request',
          error: 'Conflict',
        });
      case 'P1001':
      case 'P1002':
      case 'P1008':
      case 'P1017':
        return response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'Database temporarily unreachable. Please try again shortly.',
          error: 'Service Unavailable',
          prismaCode: code,
        });
      default:
        return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: `Database error${code ? ` (${code})` : ''}`,
          error: 'Internal Server Error',
          prismaCode: code,
        });
    }
  }
}
