import nodeAssert from "node:assert";
/// <reference types="jest" />

const assert = Object.assign(
  (...args: Parameters<typeof nodeAssert>): ReturnType<typeof nodeAssert> => {
    nodeAssert(...args);
  },
  nodeAssert,
  {
    equal: (actual: unknown, expected: unknown, message?: string | Error): void => {
      nodeAssert.strictEqual(actual, expected, message);
    },
    notEqual: (actual: unknown, expected: unknown, message?: string | Error): void => {
      nodeAssert.notStrictEqual(actual, expected, message);
    },
    deepEqual: (actual: unknown, expected: unknown): void => {
      expect(actual).toEqual(expected);
    }
  }
);

export default assert;
