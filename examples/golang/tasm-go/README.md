# Simple TVM Disassembler (TASM-Go)

This project demonstrates the practical application
of [TVM specification](https://github.com/ton-blockchain/tvm-specification) to
create a real-world tool — a disassembler for TON Virtual Machine (TVM)
bytecode.

## What this project does

The project implements a disassembler that can disassemble TON smart contracts
from BoC format and presents it as readable assembly code.

This project aims for a minimal implementation (only 200 lines of code for the
core deserialization logic) to be understandable for any reader interested in
developing tools based on the TVM specification.

### Key features

- **Complete TVM support**: The disassembler understands all TVM instructions
- **Recursive parsing**: Automatically handles nested cells (references) and
  contract methods
- **Readable output**: Disassembly results are presented in clear text format

## How it works

### Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   JSON Spec     │ -> │   Go Structs     │ -> │   Disassembler  │
│ (tvm-spec.json) │    │ (spec package)   │    │ (tasm package)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                       │
                                                       v
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   BOC File      │ -> │   Cell Parser    │ -> │   TASM Code     │
│ (.boc)          │    │ (tonutils-go)    │    │ (Human readable)│
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Key components

1. **`spec/spec.go`** - Generated data structures for working with TVM
   specification
2. **`tasm/decompile.go`** - Main disassembly logic
3. **`main.go`** - Demo application showing disassembler usage

## Usage

### Requirements

- Go 1.24+
- [tonutils-go](https://github.com/xssnick/tonutils-go) library

### CI/CD

This example includes GitHub Actions workflow that automatically:
- Builds the project on every push/PR
- Runs basic tests
- Verifies dependencies
- Tests disassembler execution

See [`.github/workflows/go-example.yml`](../../../.github/workflows/go-example.yml) for details.

### Running

```bash
go run main.go
```

The example disassembles a jetton-minter contract and outputs its code to
console.
