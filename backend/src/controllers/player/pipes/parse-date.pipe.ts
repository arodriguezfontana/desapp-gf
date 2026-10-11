import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const ISO_DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIMESTAMP_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/;

/**
 * Valida que el parámetro de fecha opcional "at" tenga un formato ISO 8601 válido.
 * Si es válido, calcula y retorna la fecha correspondiente al final del día solicitado en UTC (23:59:59.999 UTC).
 * Si no es válido, lanza BadRequestException (HTTP 400).
 * Si no está presente o es vacío, retorna undefined.
 */
@Injectable()
export class ParseDatePipe implements PipeTransform<string | undefined, Date | undefined> {
  transform(value: string | undefined): Date | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (!ISO_DATE_ONLY_REGEX.test(value) && !ISO_TIMESTAMP_REGEX.test(value)) {
      throw new BadRequestException(
        'El parámetro "at" debe ser una fecha válida en formato ISO 8601.',
      );
    }

    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) {
      throw new BadRequestException(
        'El parámetro "at" debe ser una fecha válida en formato ISO 8601.',
      );
    }

    // Validación de coherencia de calendario (para prevenir que fechas como 2026-02-31 pasen al mes siguiente)
    const datePart = value.split('T')[0];
    const [expectedYear, expectedMonth, expectedDay] = datePart.split('-').map(Number);
    if (
      parsed.getUTCFullYear() !== expectedYear ||
      parsed.getUTCMonth() + 1 !== expectedMonth ||
      parsed.getUTCDate() !== expectedDay
    ) {
      throw new BadRequestException(
        'El parámetro "at" debe ser una fecha válida en formato ISO 8601.',
      );
    }

    return new Date(
      Date.UTC(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );
  }
}

