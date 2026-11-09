/// <reference types="jest" />

type LegacyTestContext = {
  mock: {
    method: (target: object, name: string, implementation?: (...args: never[]) => unknown) => unknown;
  };
  after: (callback: () => unknown) => void;
  test: (name: string, body: () => unknown) => Promise<void>;
};

type LegacyTestBody = (context: LegacyTestContext) => unknown;

const legacyTest = (name: string, body: LegacyTestBody): void => {
  test(name, async () => {
    const cleanups: Array<() => unknown> = [];
    const restoreMocks: Array<() => void> = [];
    const context: LegacyTestContext = {
      mock: {
        method: (target, name, implementation) => {
          let owner: object | null = target;
          let inheritedDescriptor: PropertyDescriptor | undefined;
          while (owner !== null && inheritedDescriptor === undefined) {
            inheritedDescriptor = Object.getOwnPropertyDescriptor(owner, name);
            owner = Reflect.getPrototypeOf(owner);
          }
          const ownDescriptor = Object.getOwnPropertyDescriptor(target, name);
          if (!inheritedDescriptor || typeof implementation !== "function") {
            throw new TypeError(`Cannot mock ${name}: expected an existing method and implementation.`);
          }
          if (!("value" in inheritedDescriptor)) {
            throw new TypeError(`Cannot mock ${name}: expected a data method.`);
          }
          Object.defineProperty(target, name, {
            configurable: true,
            enumerable: inheritedDescriptor.enumerable ?? false,
            writable: true,
            value: implementation
          });
          restoreMocks.push(() => {
            if (ownDescriptor) Object.defineProperty(target, name, ownDescriptor);
            else Reflect.deleteProperty(target, name);
          });
        }
      },
      after: (callback) => { cleanups.push(callback); },
      test: async (_name, nestedBody) => { await nestedBody(); }
    };

    try {
      await body(context);
    } finally {
      try {
        for (const cleanup of cleanups.reverse()) await cleanup();
      } finally {
        for (const restore of restoreMocks.reverse()) restore();
      }
    }
  });
};

export default legacyTest;
