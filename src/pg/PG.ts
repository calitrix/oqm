import { Pool, PoolClient } from 'pg'
import { map } from '../mapper'
import { Runtype, Static } from '../runtypes'
import { FunctionalQuery } from '../sql'

export type TxHandler<T> = (queryInterface: QueryInterface) => Promise<T>

export interface QueryInterface {
  tx<T>(fn: TxHandler<T>): Promise<T>

  query<A>(
    query: FunctionalQuery,
    mapping: Runtype<A>
  ): Promise<Static<Runtype<A>>[]>
}

abstract class BaseClient implements QueryInterface {
  constructor(protected client: Pool | PoolClient) {}

  abstract tx<T>(fn: TxHandler<T>): Promise<T>

  async query<A>(
    query: FunctionalQuery,
    mapping: Runtype<A>
  ): Promise<Static<Runtype<A>>[]> {
    const result = await this.client.query(query.toQuery())
    return map(result.rows, mapping)
  }
}

class NestedTransactionClient extends BaseClient implements QueryInterface {
  constructor(protected client: PoolClient) {
    super(client)
  }

  async tx<T>(fn: TxHandler<T>): Promise<T> {
    await this.client.query('SAVEPOINT inner_tx')
    try {
      return fn(this)
    } catch (error) {
      await this.client.query('ROLLBACK TO SAVEPOINT inner_tx')
      throw error
    }
  }
}

class TransactionClient extends BaseClient implements QueryInterface {
  constructor(protected client: PoolClient) {
    super(client)
  }

  async tx<T>(fn: TxHandler<T>) {
    try {
      await this.client.query('BEGIN')
    } catch (error) {
      this.client.release()
      throw error
    }

    try {
      const returnValue = await fn(new NestedTransactionClient(this.client))
      await this.client.query('COMMIT')
      return returnValue
    } catch (error) {
      await this.client.query('ROLLBACK')
      throw error
    } finally {
      this.client.release()
    }
  }
}

export class PG extends BaseClient implements QueryInterface {
  constructor(protected pool: Pool) {
    super(pool)
  }

  async tx<T>(fn: TxHandler<T>) {
    const client = await this.pool.connect()
    const queryInterface = new TransactionClient(client)
    return queryInterface.tx(fn)
  }
}
