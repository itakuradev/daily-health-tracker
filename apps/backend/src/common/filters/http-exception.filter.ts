import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * 全 HTTP 例外を統一フォーマットで返すフィルター。
 *
 * 成功レスポンス以外は常に以下の形式：
 * {
 *   statusCode: number,
 *   error:      string,   // HTTP ステータスの説明
 *   message:    string | string[],
 *   path:       string,
 *   timestamp:  string,
 * }
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx      = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request  = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[];
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null && 'message' in res) {
        message = (res as { message: string | string[] }).message;
      } else {
        message = exception.message;
      }
    } else {
      message = 'Internal server error';
      this.logger.error(exception);
    }

    response.status(status).json({
      statusCode: status,
      error:      HttpStatus[status] ?? 'UNKNOWN',
      message,
      path:       request.url,
      timestamp:  new Date().toISOString(),
    });
  }
}
