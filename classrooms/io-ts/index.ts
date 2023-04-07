/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-redeclare */
/* eslint-disable no-warning-comments */
/* eslint-disable unicorn/no-array-for-each */
import assert from 'node:assert';
import test from 'node:test';
import * as io from 'io-ts';
import {getOrElse} from 'fp-ts/lib/Either';
import {pipe} from 'fp-ts/lib/function';

/*
 * # Introduction to io-ts
 *
 * io-ts is a library for runtime type checking of JavaScript values.
 *
 * ## Validate input value
 *
 * Sometimes we have to work with value that we don't know the type of.
 */

const unsafeProcessComplexObject = (object: unknown): number => {
  // We have to check the type of the value before we can use it.
  if (
    typeof object === 'object' &&
    object !== null &&
    'value' in object &&
    typeof object.value === 'number'
  ) {
    return object.value;
  }

  // And throw an error if the type is wrong.
  throw new TypeError('Invalid object');
};

/*
 * It is tedious and error-prone to write such code. Hopefully, TypeScript can
 * help us to constrain the type of the value before we use it.
 */

const typedProcessComplexObject = (object: {value: number}): number =>
  object.value;

/*
 * Exercice 1: Write a function that deserialize a JSON string and return the
 * value if it is a User object.
 */

type User = {name: string; age: number};
const unsafeParseUser = (json: string): User => {
  const object: unknown = JSON.parse(json);
  if (
    typeof object === 'object' &&
    object !== null &&
    'name' in object &&
    typeof object.name === 'string' &&
    'age' in object &&
    typeof object.age === 'number'
  ) {
    const {age, name} = object;
    return {age, name};
  }

  throw new TypeError('Invalid object');
};

await test('unsafeParseUser', () => {
  const USER = {name: 'John', age: 42};
  assert.deepStrictEqual(unsafeParseUser(JSON.stringify(USER)), USER);

  const INVALID_OBJECTS: unknown[] = [{name: 'John'}, {age: 42}];
  INVALID_OBJECTS.forEach((object) => {
    assert.throws(() => unsafeParseUser(JSON.stringify(object)), TypeError);
  });
});

/*
 * Io-ts provides a way to define a type and a function to parse a value.
 */
const User = io.type({
  name: io.string,
  age: io.number,
});
const parseUser = (json: string): User => pipe(json, JSON.parse, decode(User));

/*
 * Exercice 2: Write the io-ts type to represent the following type.
 */

type ComplexObject = {
  falsyValues: null | undefined | false | 0 | '';
  arrayOfTuple?: Array<[number, string]>;
};

// TODO write the io-ts type
const ComplexObject: io.Type<ComplexObject> = io.intersection([
  io.type({
    falsyValues: io.union([
      io.null,
      io.undefined,
      io.literal(false),
      io.literal(0),
      io.literal(''),
    ]),
  }),
  io.partial({
    arrayOfTuple: io.array(io.tuple([io.number, io.string])),
  }),
]);

/*
 * ## Phantom types and smart constructors
 *
 * But TypeScript types are not enough to handle all contraints about data
 * validation. Take the following example. As you know, we can divide by zero.
 * JavaScript solve the problem by returning `Infinity`.
 * How can we prevent this ?
 */

const unsafeDivide = (dividend: number, divisor: number): number =>
  dividend / divisor;

/*
 * The technique is to use a phantom type. A phantom type is a type that is not
 * used in the runtime but handle the type constraint and allows function to be
 * type-safe.
 */

// This is a way how we define a phantom type
type NonZeroFinite = number & {readonly NonZeroFinite: symbol};

// To create a value of this type, we have to use a smart constructor
const NonZeroFinite = (n: number): NonZeroFinite => {
  if (Number.isFinite(n) && n !== 0) {
    return n as NonZeroFinite;
  }

  throw new TypeError(`Invalid NonZeroFinite: ${n}`);
};

/*
 * Now we can use the smart constructor to create a value of the phantom type
 * and use it in a type-safe way
 */
const divide = (dividend: number, divisor: NonZeroFinite): number =>
  dividend / divisor;

await test('divide', (t) => {
  // @ts-expect-error We have to cast 2 to NonZeroFinite
  assert.strictEqual(divide(4, 2), 2);

  assert.strictEqual(divide(4, NonZeroFinite(2)), 2);

  assert.throws(() => divide(1, NonZeroFinite(0)), TypeError);
});

/*
 * Io-ts allows us to define phantom types and type guards.
 */

type Palindrome = io.Branded<string, {readonly Palindrome: symbol}>;
const Palindrome = io.brand(
  io.string,
  (s: string): s is Palindrome => [...s].reverse().join('') === s,
  'Palindrome',
);

await test('Palindrome', (t) => {
  const VALID_PALINDROMES = ['racecar', 'level', 'noon'];
  VALID_PALINDROMES.forEach((s) => {
    assert.strictEqual(Palindrome.is(s), true);
  });

  const INVALID_PALINDROMES = ['hello', 'world', 'foo'];
  INVALID_PALINDROMES.forEach((s) => {
    assert.strictEqual(Palindrome.is(s), false);
  });
});

/**
 * Utils
 */

function decode<T>(codec: io.Type<T>) {
  return (value: unknown) =>
    pipe(
      value,
      codec.decode,
      getOrElse((): T => {
        throw new TypeError('Invalid object');
      }),
    );
}
