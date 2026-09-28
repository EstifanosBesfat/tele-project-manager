import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/**
 * Prisma `@default(cuid())` uses cuid v1: 25 chars, leading `c`, then 24
 * [a-z0-9]. User.id and Division.id use this. Project.id and Task.id use uuid.
 */
export const CUID_REGEX = /^c[a-z0-9]{24}$/;

export function isCuid(value: unknown): value is string {
  return typeof value === 'string' && CUID_REGEX.test(value);
}

export function IsCuid(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isCuid',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown) => isCuid(value),
        defaultMessage: (args: ValidationArguments) =>
          `${args.property} must be a cuid`,
      },
    });
  };
}
