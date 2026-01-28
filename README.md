# TON Virtual Machine Instructions Specification

Specification of 900+ instruction of TVM.

Full specification as a JSON file can be found in [`gen/tvm-specification.json`](gen/tvm-specification.json).

TypeScript wrappers can be found in [`types/`](src/types) and used via `tvm-specification` package.

JSON Schema of specifications is available in [`gen/schema.json`](gen/schema.json).
Generators such as [quicktype.io](https://app.quicktype.io/) can be used to generate wrappers for a specific programming
language.

## Current state

- Instructions count: **919**
- With exit code description: **169**
- With examples: **33**
- With other implementations description: **102**
- With TLB representation: **919**
- Without any text description: **0**, including arithmetic: **0**
- With unverified empty stack signature: **0**
- Fift instructions count: **116**
- With C++ implementations: **918**

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
- [docs-links-validation.ts](validity/docs-links-validation.ts) — checks that documentation links in `docs_links` are
  reachable
- JSON Schema validation — validates the JSON schema itself and checks that the generated specification conforms to it

## Projects that use this specification

- [TxTracer](https://txtracer.ton.org/) — Web app for tracing and analyzing transactions
- [Playground](https://txtracer.ton.org/play/) — TVM Assembly and FunC playground
- [TON VS Code Extension](https://github.com/ton-blockchain/ton-language-server) — VS Code extension for TON developers
- [TVM Specification page](https://txtracer.ton.org/spec/) — Visual representation of this specification
- [TASM](https://github.com/ton-blockchain/tasm) — Assembler and disassembler implementation for TVM bitcode in pure
  TypeScript tested on 100k real contracts from blockchain

## Examples

This repository includes practical examples demonstrating how to use this specification:

- [Simple TVM Disassembler (Go)](examples/golang/tasm-go/) — Minimal implementation (200 lines of core deserialization
  logic) showing how to create a TVM bytecode disassembler using the specification.

## Use cases

Currently, the specification is mainly used in two ways:

- Using human-readable instruction descriptions in interfaces (TxTracer on hover) or for
  autocompletion (Playground).
- Using machine-readable instruction descriptions for tools such as TASM.

Let's briefly describe the main fields for each way of using the specification. If you want to read full documentation
about each field, check out the [specification schema](src/types/specification-schema.ts).

### As Documentation

If you want to use this specification as documentation, the main source of information is the
`description` field that exists for each instruction.

#### Required fields:

- `short` — brief mostly one-line description of the instruction. If non-empty, describes the short description of the
  instruction
- `long` — detailed description of the instruction's functionality
- `operands` — list of operand names for the instruction, their types and possible values are located in the root
  `layout` field

#### Optional fields:

- `tags` — list of tags for categorizing and searching instructions
- `exit_codes` — list of possible exit codes and their trigger conditions
- `other_implementations` — list of alternative implementations for this instruction using other instructions
- `related_instructions` — list of instructions that are related or similar to this one
- `examples` — list of examples showing how to use this instruction with stack state
- `gas` — list of gas consumption entries with descriptions and formulas
- `docs_links` — list of documentation links related to this instruction

If you also want to display the stack signature, use the root `signature` field and the `stack_string`
field from it. This field contains a human-readable description of the input and output types on the stack.

#### Fift instructions

This specification also describes instructions that are only available in Fift and are aliases for existing
instructions.

### For Tool Developers

When building tools that work with TVM bytecode (disassemblers, analyzers, debuggers, etc.), you need to decode
complete instructions from the bytecode stream. The specification provides all the necessary information in the
`layout` field of each instruction to implement this process.

Check out [examples/golang/tasm-go/tasm/decompile.go](examples/golang/tasm-go/tasm/decompile.go) for a minimal
implementation of a TVM bytecode disassembler using the specification.

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
