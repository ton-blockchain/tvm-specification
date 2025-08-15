# TON Virtual Machine Instructions Specification

Specification of 900+ instruction of TVM.

Full specification as a JSON file can be found in [`/gen/tvm-specification.json`](gen/tvm-specification.json).

TypeScript wrappers can be found in [types/](src/types) and used via `tvm-specification` package.

## Current state

- Instructions count: **908**
- With exit code description: **76**
- With examples: **25**
- With other implementations description: **67**
- Without any text description: **217**
- With empty stack signature: **174**

## Development

[data/](data) directory contains a set of files with description for all instructions. This description doesn't include
information that can be obtained from [sec/instructions/instructions.ts](src/instructions/instructions.ts) file which
contains bit-level specification for each instruction.

### Generation

To generate latest specification run:

```
yarn gen
```

# License

MIT © TON Core
