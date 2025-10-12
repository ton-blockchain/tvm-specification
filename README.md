# TON Virtual Machine Instructions Specification

Specification of 900+ instruction of TVM.

Full specification as a JSON file can be found in [`gen/tvm-specification.json`](gen/tvm-specification.json).

TypeScript wrappers can be found in [`types/`](src/types) and used via `tvm-specification` package.

JSON Schema of specifications is available in [`gen/schema.json`](gen/schema.json).
Generators such as [quicktype.io](https://app.quicktype.io/) can be used to generate wrappers for specific programming
language.

## Current state

- Instructions count: **908**
- With exit code description: **111**
- With examples: **32**
- With other implementations description: **100**
- Without any text description: **4**, including arithmetic: **142**
- With empty stack signature: **90**
- Fift instructions count: **116**

## Validity

This repository contains scripts that check the validity of instruction descriptions:

- [input-instr-signature.ts](validity/input-instr-signature.ts) — checks the validity of instruction signatures and
  operands (currently 825 instructions are automatically checked (90%))

## Development

[`data/`](data) directory contains a set of files with description for all instructions. This description doesn't
include information that can be obtained from [`src/instructions/instructions.ts`](src/instructions/instructions.ts)
file which contains bit-level specification for each instruction.

### Generation

To generate latest specification run:

```
yarn generate
```

Before commit run:

```
yarn precommit
```

To format, build and validate changes.

# License

MIT © TON Core
