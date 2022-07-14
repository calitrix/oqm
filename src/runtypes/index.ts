import { Brand, Runtype } from 'runtypes'

export * from 'runtypes'

export const IdBrand = 'IdBrand'

export const Id = <T extends Runtype>(type: T): Brand<typeof IdBrand, T> =>
  type.withBrand(IdBrand)

export const Aliased = <T extends Runtype, A extends string>(
  alias: A,
  type: T
): Brand<A, T> => type.withBrand(alias)
