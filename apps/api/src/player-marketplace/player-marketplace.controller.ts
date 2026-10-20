import { Controller, Delete, Get, GoneException, NotFoundException, Patch, Post } from '@nestjs/common';

const DISABLED_MESSAGE = 'El marketplace entre jugadores ya no está disponible.';

/**
 * Marketplace dado de baja. Se mantiene solo para versiones viejas de la app:
 * los listados vuelven vacíos y cualquier escritura se rechaza con un mensaje legible.
 * Borrar este módulo cuando ninguna versión en uso llame a /marketplace.
 */
@Controller('marketplace')
export class PlayerMarketplaceController {
  @Get('listings')
  list() {
    return [];
  }

  @Get('listings/mine')
  mine() {
    return [];
  }

  @Get('listings/:id')
  get() {
    throw new NotFoundException('Publicación no disponible');
  }

  @Post('listings')
  create() {
    throw new GoneException(DISABLED_MESSAGE);
  }

  @Patch('listings/:id')
  update() {
    throw new GoneException(DISABLED_MESSAGE);
  }

  @Delete('listings/:id')
  remove() {
    throw new GoneException(DISABLED_MESSAGE);
  }

  @Post('listings/:id/photos')
  addPhoto() {
    throw new GoneException(DISABLED_MESSAGE);
  }

  @Post('listings/:id/photos/remove')
  removePhoto() {
    throw new GoneException(DISABLED_MESSAGE);
  }
}
