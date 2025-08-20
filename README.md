# TON Virtual Machine Instructions Specification

Specification of 900+ instruction of TVM.

Full specification as a JSON file can be found in [`gen/tvm-specification.json`](gen/tvm-specification.json).

TypeScript wrappers can be found in [`types/`](src/types) and used via `tvm-specification` package.

JSON Schema of specifications is available in [`gen/schema.json`](gen/schema.json).
Generators such as [quicktype.io](https://app.quicktype.io/) can be used to generate wrappers for specific programming
language.

## Current state

- Instructions count: **908**
- With exit code description: **82**
- With examples: **25**
- With other implementations description: **90**
- Without any text description: **4**, with arithmetic: **142**
- With empty stack signature: **99**
- Fift instructions count: **116**

## Development

[`data/`](data) directory contains a set of files with description for all instructions. This description doesn't
include information that can be obtained from [`src/instructions/instructions.ts`](src/instructions/instructions.ts)
file which contains bit-level specification for each instruction.

### Generation

To generate latest specification run:

```
yarn gen
```

# License

MIT © TON Core
