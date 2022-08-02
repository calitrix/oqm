# OQM

[![Tests](https://github.com/calitrix/oqm/actions/workflows/tests.yml/badge.svg)](https://github.com/calitrix/oqm/actions/workflows/tests.yml) [![Bundle Size](https://img.shields.io/bundlephobia/min/oqm?label=bundle%20size)](https://bundlephobia.com/result?p=oqm) [![Downloads](https://img.shields.io/npm/dt/oqm.svg)](https://www.npmjs.com/package/oqm)

Swiss-army-knife for writing SQL and mapping result in a typesafe way, using Typescript. If you don't feel like using a full-fledge ORM, keep reading.

oqm is built with simplicity in mind. Non-intrusive, non-opinionated, low-dependancy, no-bs. Write SQL as you please and get some kind helpers along the way for making your life easier.

> **Warning**
> This is an experimental library and certainly the API will introduce breaking changes until this is declared stable.
> Have fun fiddling with it but don't eat my lunch if things blow up.

## Installation

```sh
# npm
npm install oqm --save

# yarn
yarn add oqm
```

<table>
  <tr><th>Examples</th><th>Reference</th></tr>
  <tr>
    <td>
      <ul>
        <li><a href="#quickstart-simple-queries">Simple queries</a></li>
        <li><a href="#quickstart-simple-result-mapping">Simple result mapping</a></li>
        <li><a href="#queries-are-functions">Queries are functions</a></li>
        <li><a href="#queries-can-be-composed">Queries can be composed</a></li>
        <li><a href="#nested-reference-mapping">Nested reference mapping</a></li>
        <li><a href="#mapping-arbitrary-results-without-added-complexity">Mapping generated results</a></li>
      </ul>
    </td>
    <td>
      <ul>
        <li><a href="#sql">sql</a></li>
        <li><a href="#map">map</a></li>
        <li><a href="#utils-columns">columns</a></li>
      </ul>
    </td>
  </tr>
</table>

## Quickstart: simple queries

```ts
import { sql } from 'oqm'

const template = sql`SELECT * FROM users WHERE id = ${1}`
const result = await client.query(template.toQuery())
```

In it's basic form, oqm provides yet another sql template string implementation.
`template.toQuery()` returns a query object with a `text` and `values` property, suitable for being passed to e.g. the [node-postgres](node-postgres.com) client object:

```js
{ text: 'SELECT * FROM users WHERE id = $1',
  values: [1] }
```

## Quickstart: simple result mapping

oqm uses [runtypes](https://github.com/pelotom/runtypes) as the only dependency for runtime type resolution.

```ts
import { sql, map } from 'oqm'
import { Record, Number, Static, String } from 'oqm/runtypes'

const UserRecord = Record({
  id: Number,
  name: String,
  email: String,
})

type User = Static<typeof UserRecord>

const template = sql`SELECT * FROM users WHERE id = ${1}`
const { rows } = await client.query(template.toQuery())

const [user] = map(result, UserRecord)
```

This returns `user` as an object of type `User` with static types and auto-completion.
Lets drill down how this happens:

- `map()` takes an array of objects (e.g. a result set) plus a runtime type definition and transforms that array into the form as specified by the given runtime type
- `UserRecord` declares a runtime type for `map` to inspect when transforming result sets (see [runtypes](https://github.com/pelotom/runtypes) for details as `oqm/runtypes` re-exports everything plus a few added helpers)
- `Static<typeof UserRecord>` declares a compile-time type. The return value of `map` will be of this type

Since we aren't code-generating types from the database schema, it's up to the developer how objects look like. And how data for these objects is fetched from the database. In essence, we are mapping **objects to and from queries**, not **objects to relations**. Hence the name of this library: it's **o**bject **q**uery **m**apper.

## I'm bored, show me the magic

I admit, using template strings for building queries [is not a new invention](https://www.npmjs.com/search?q=sql%20template). Let's talk about why this is different.

### Queries are functions

Did you note that i used `template` as the variable name above? That's because every query is a re-usable query function and you can call to create a derived query function.

**Re-map input parameters**

```ts
const userQuery = sql`SELECT * FROM users WHERE id = ${1}`
const user1 = await client.query(userQuery.toQuery())
const user2 = await client.query(userQuery(2).toQuery())
const user3 = await client.query(userQuery(3).toQuery())
```

What happened here? Every `sql` tagged string returns a (type-safe) function, accepting one argument for each end every sql parameter. Calling that function as outlined above returns a new version of that query with a different set of input parameters.

**Map complex parameters**

```ts
type User = {
  id: number
  name: string
  email: string
}

const updatNameQuery = sql`
  UPDATE users 
  SET name = ${(user: User) => user.name}
  WHERE id = ${(user: User) => user.id}
`

const user: User = {
  id: 1,
  name: 'John Doe',
  email: 'john@example.com',
}

const result = await client.query(updateNameQuery(user, user).toQuery())
```

Using a function as query parameter allows you to transform the given parameter value. **Note** how i passed the `user` twice here because we need to provide a value for each positional parameter. But since everything is a function anyways it's trivial to wrap a custom mapper function around the query:

```ts
const updateEmailQuery = (user: User) =>
  sql`UPDATE users SET email = ${user.email} WHERE id = ${user.id}`

const result = await client.query(updateEmailQuery(user).toQuery())
```

### Queries can be composed

SQL is verbose and you don't want to repeat the same crap every single time. So let's combine some query fragments to DRY:

```ts
const selectUsersQuery = sql`SELECT * FROM users WHERE ${sql`1`}`
const nameFilter = sql`name = ${''}`
const recentSignupsFilter = sql`created_at >= CURRENT_TIMESTAMP - INTERVAL ${''}`

const allJohns = await client.query(
  selectUsersQuery(nameFilter('John Doe')).toQuery()
)
// SELECT * FROM users WHERE name = $1

const lastWeek = await client.query(
  selectUsersQuery(recentSignupsFilter('7d')).toQuery()
)
// SELECT * FROM users WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL $1
```

Queries can be given as parameters to other queries which combines them. Calling `toQuery` on the root query function will flatten all nested queries into a single query object while taking care of correctly numbering all positional query paramaters.

You can get fancy and write some query fragment combination helpers:

```ts
const selectUsersQuery = sql`SELECT * FROM users WHERE ${sql`1`}`
const nameFilter = sql`name = ${''}`
const recentSignupsFilter = sql`created_at >= CURRENT_TIMESTAMP - INTERVAL ${''}`
const and = sql`(${sql``} AND ${sql``})`

const recentJohns = await client.query(
  selectUsersQuery(
    and(nameFilter('John Doe'), recentSignupsFilter('7d'))
  ).toQuery()
)
// SELECT * FROM users WHERE name = $1 AND created_at >= CURRENT_TIMESTAMP - INTERVAL $2
```

But before you invent your custom SQL abstraction DSL you may also think about going with an existing query builder like [knex](https://knexjs.org/).

### Nested reference mapping

There is no fun in just mapping a `SELECT * FROM table` because `node-postgres` already returns arrays of objects. Let's define a simple a simple blog structure:

```ts
import { Array, InstanceOf, Record, String, Number } from 'oqm/runtypes'

const AuthorRecord = Record({
  id: Number,
  name: String,
})

const ArticleRecord = Record({
  id: Number,
  date: InstanceOf(Date),
  authorId: Number,
  teaser: String,
  text: String,
})

const CommentRecord = Record({
  id: Number,
  userName: String,
  comment: String,
})
```

All these records are related to each other. But since OQM doesn't care about actual tables (just result sets) we don't define any table relations. You just combine records as you want them:

```ts
const AuthorWithArticles = AuthorRecord.extend({
  articles: Array(ArticleRecord),
})
```

`AuthorWithArticles` now has an `articles` property which maps to an array of articles. We now just have to write a simple query which returns the result set for this:

```ts
import { map } from 'oqm'

const { rows } = await client.query(`
  SELECT * FROM authors 
  LEFT JOIN articles ON articles."authorId" = authors.id
`)

const authors = map(rows, AuthorWithArticles)
```

The `map` function will group the result by author id and construct a result which

- contains a single object for each unique author (identified by id)
- assigns the array of articles to each author

Reference mappings are quite simple:

- Array props are mapped as a 1:n or n:m (doesn't make a difference from OQM perspective) - referenced records are grouped together by their parent record
- Record props are mapped as a 1:1 reference

```ts
const AuthorWithLastArticle = AuthorRecord.extend({
  lastArticle: ArticleRecord,
})

const { rows } = await client.query(`
  SELECT DISTINCT ON (authors.id) * FROM authors
  LEFT JOIN articles ON articles.author_id = authors.id
  ORDER BY authors.id, articles.date DESC
`)

const authors = map(rows, AuthorWithLastArticle)
```

### Mapping arbitrary results without added complexity

Because, again, OQM doesn't care about actual table structures, it's quite trivial to map result sets with generated data to propper objects - something many ORMs require you to jump through hoops to achieve:

```ts
const AuthorsWithStats = AuthorRecord.extend({
  numberOfArticles: Number,
  averageArticleLength: Number,
})

const { rows } = await client.query(`
  SELECT *, 
    COUNT(articles.id) as "numberOfArticles", 
    AVG(CHAR_LENGTH(articles.text)) AS "averageArticleLength"
  FROM authors 
  LEFT JOIN articles ON articles."authorId" = authors.id
`)

const authors = map(rows, AuthorsWithStats)
```

You now have a typed result extended with the aggregate results.

## API reference

### sql

Tagged template function which accepts interpolations and builds a parameterized SQL query from it:

```ts
const query = sql`SELECT * FROM tab WHERE id = ${1}`
// {text: 'SELECT * FROM tab WHERE id = $1, values: [1]}
```

#### Override parameters

```ts
const query = sql`SELECT * FROM tab WHERE id = ${1}`

query(5)
// {text: 'SELECT * FROM tab WHERE id = $1, values: [5]}
```

#### Transform parameters

```ts
type User = { id: number; name: string }
const query = sql`SELECT * FROM tab WHERE name = ${(u: User) => user.name}`

query({ id: 1, name: 'John' })
// {text: 'SELECT * FROM tab WHERE name = $1, values: ["John"]}
```

#### Combine queries

```ts
const criteria = sql`id = ${1}`
const query = sql`SELECT * FROM TAB WHERE ${criteria}`

// {text: 'SELECT * FROM tab WHERE id = $1, values: [1]}
```

#### toQuery()

Returns the query object represented by the query. Suitable for being passed to the database driver

```ts
const query = sql`SELECT * FROM tab WHERE id = ${1}`
console.log(query.toQuery())
// {text: 'SELECT * FROM tab WHERE id = $1, values: [1]}
```

### map

Function for transforming a flat result set into a nested object structure.

```ts
map(rows: Record<string, unknown>[], mapping: Runtype)
```

- `rows`: an arbitrary array of rows (objects)
- `mapping`: a record [runtype](https://github.com/pelotom/runtypes) defining properties and nested relationships

```ts
import { Record, String, Number } from 'oqm/runtypes'

const rows = [
  { id: 1, name: 'John' },
  { id: 2, name: 'Alice' },
]
const users = map(rows, Record({ id: Number, name: String }))
```

#### 1:1 relationships

Use a nested record type for mapping 1:1 relationships.

```ts
import { Record, String, Number } from 'oqm/runtypes'

const rows = [
  { id: 1, name: 'John', friend_id: 3, friend_name: 'Bud' },
  // Alice has no friends bohoo
  { id: 2, name: 'Alice', friend_id: null, friend_name: null },
]
const users = map(
  rows,
  Record({
    id: Number,
    name: String,
    friend: Record({
      friend_id: Number,
      friend_name: String,
    }),
  })
)
```

#### 1:n / n:m relationships

Use a nested array of records type for mapping n:m relationships.

```ts
import { Record, String, Number } from 'oqm/runtypes'

const rows = [
  { id: 1, name: 'John', friend_id: 3, friend_name: 'Bud' },
  { id: 1, name: 'John', friend_id: 2, friend_name: 'Alice' },
]
const users = map(
  rows,
  Record({
    id: Number,
    name: String,
    friends: Array(
      Record({
        friend_id: Number,
        friend_name: String,
      })
    ),
  })
)
```

#### Column aliases

You may need to prefix column names when joining tables together. Use the `Aliased` branded type for marking this prefix.

```ts
import { Aliased, Record, String, Number } from 'oqm/runtypes'

const rows = [
  { u_id: 1, u_name: 'John', f_id: 3, f_name: 'Bud' },
  { u_id: 1, u_name: 'John', f_id: 2, f_name: 'Alice' },
]
const users = map(
  rows,
  Aliased(
    'u',
    Record({
      id: Number,
      name: String,
      friends: Aliased(
        'f',
        Array(
          Record({
            id: Number,
            name: String,
          })
        )
      ),
    })
  )
)
```

or you use [branded types](https://github.com/pelotom/runtypes#branded-types) directly

```ts
Aliased('u', Record({}))
// equals
Record({}).withBrand('u')
```

#### Custom id columns

For mapping nested references the `map` function needs to know, which column identifies each record as a primary key.
It defaults to `id` but an alternate name can be provided using the `Id` brand:

```ts
import { Id, Record, String, Number } from 'oqm/runtypes'

const rows = [
  { user_id: 1, name: 'John' },
  { user_id: 2, name: 'Alice' },
]
const users = map(
  rows,
  Record({
    user_id: Id(Number),
    name: String,
  })
)
```

> **TODO** composite primary key support

### Utils: columns

Tired of writing out lengthy column lists? Gotcha.

```ts
import { columns } from 'oqm/utils'

const UserWithStuff = Record({
  id: String,
  name: String,
  im: String,
  a: String,
  messy: String,
  table: String,
})

const query = sql`
  SELECT ${columns(Aliased('u', UserWithStuff))} 
  FROM users u
`
// SELECT id AS u_id, name AS u_name, etc.pp.
```

`columns` accepts an arbitrary list of records which will be flattened into a single list of columns.

```ts
columns(...records: Runtype[])
```
