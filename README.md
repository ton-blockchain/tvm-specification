# TON Virtual Machine Instructions Specification

Specification of 900+ instruction of TVM.

Full specification as a JSON file can be found in [`gen/tvm-specification.json`](gen/tvm-specification.json).

TypeScript wrappers can be found in [`types/`](src/types) and used via `tvm-specification` package.

JSON Schema of specifications is available in [`gen/schema.json`](gen/schema.json).
Generators such as [quicktype.io](https://app.quicktype.io/) can be used to generate wrappers for a specific programming
language.

## Current state

- Instructions count: **910**
- With exit code description: **165**
- With examples: **33**
- With other implementations description: **102**
- With TLB representation: **910**
- Without any text description: **0**, including arithmetic: **0**
- With unverified empty stack signature: **0**
- Fift instructions count: **116**
- With C++ implementations: **910**

## Validity

This repository contains scripts that check the validity of instruction descriptions:

- [input-instr-signature.ts](validity/input-instr-signature.ts) — checks the validity of instruction signatures and
  operands (currently 825 instructions are automatically checked (90%))
- [examples-validation.ts](validity/examples-validation.ts) — checks the validity of instruction examples by executing
  them and verifying that the resulting stack matches the expected output
- [other-implementations-validation.ts](validity/other-implementations-validation.ts) — checks that the instructions
  listed in `other_implementations` is compilable
- [tlb-validation.ts](validity/tlb-validation.ts) — checks the validity of TLB representations by parsing them and
  generating TypeScript wrapper code
- JSON Schema validation — validates the JSON schema itself and checks that the generated specification conforms to it

## Projects that use this specification

- [TxTracer](https://txtracer.ton.org/) — Web app for tracing and analyzing transactions
- [Playground](https://txtracer.ton.org/play/) — TVM Assembly and FunC playground
- [TVM Specification page](https://txtracer.ton.org/spec/) — Visual representation of this specification
- [TASM](https://github.com/ton-blockchain/tasm) — Assembler and disassembler implementation for TVM bitcode in pure
  TypeScript tested on 100k real contracts from blockchain

## Development

[`data/`](data) directory contains a set of files with description for all instructions. This description doesn't
include information that can be obtained from [`src/instructions/instructions.ts`](src/instructions/instructions.ts)
file which contains bit-level specification for each instruction.

### Generation

To generate C++ implementations for each instruction, we need to clone the TON repository. Before the full specification
generation run the following command to clone TON repository and generate `implementations.json` file.

```
yarn find-implementations
```

To generate the full specification, run:

```
yarn generate
```

Before the commit run:

```
yarn precommit
```

To format, build and validate changes.

# License

MIT © TON Core
