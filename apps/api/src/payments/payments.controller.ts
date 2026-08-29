import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('webhooks/mercadopago')
  mercadoPagoWebhook(@Body() body: Record<string, unknown>) {
    return this.paymentsService.handleMercadoPagoWebhook(body as any);
  }

  @Post('webhooks/mercadopago/clubs/:clubId')
  mercadoPagoClubWebhook(
    @Param('clubId') clubId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.paymentsService.handleMercadoPagoWebhook(body as any, clubId);
  }

  @Get('mock/checkout')
  async mockCheckout(@Query('depositId') depositId: string, @Res() res: Response) {
    if (!depositId) {
      return res.status(400).send('depositId requerido');
    }
    await this.paymentsService.approveDeposit(depositId, 'mock-auto');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>Seña acreditada (modo prueba)</h2>
        <p>Podés volver a la app de x4 match.</p>
      </body></html>`,
    );
  }

  @Get('return/success')
  returnSuccess(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>Pago recibido</h2>
        <p>Gracias. Volvé a la app para ver tu partido confirmado.</p>
      </body></html>`,
    );
  }

  @Get('return/failure')
  returnFailure(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>Pago no completado</h2>
        <p>Intentá de nuevo desde la app.</p>
      </body></html>`,
    );
  }

  @Get('return/pending')
  returnPending(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>Pago pendiente</h2>
        <p>Te avisaremos cuando se acredite.</p>
      </body></html>`,
    );
  }
}
