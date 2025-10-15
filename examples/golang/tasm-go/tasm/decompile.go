package tasm

import (
	"fmt"
	"log"
	"math/big"
	"slices"
	"strings"
	"tasm-go/spec"

	"github.com/xssnick/tonutils-go/tvm/cell"
)

// DecompileCell recursively decompiles TVM cell into sequence of instructions.
func DecompileCell(tvmSpec spec.Specification, cell *cell.Cell) DecompiledCode {
	if load == nil {
		load = loader(tvmSpec.Instructions)
	}

	return decompileCell(cell)
}

// decompileCell recursively decompiles TVM cell into sequence of instructions.
func decompileCell(cell *cell.Cell) DecompiledCode {
	slice := cell.BeginParse()
	result := make([]DeserializedInstruction, 0, 32)

	// Parse all instructions in the current cell
	for slice.BitsLeft() > 0 {
		result = append(result, load(slice))
	}

	// And recursively process references to other cells
	for slice.RefsNum() > 0 {
		code := decompileCell(slice.MustLoadRef().MustToCell())
		// ref is a special pseudo-instruction that denotes a code that placed in reference
		result = append(result, DeserializedInstruction{name: "ref", args: []any{code}})
	}

	return DecompiledCode{result}
}

type Control struct{ idx uint64 }
type StackRegister struct{ idx int64 }
type DecompiledCode struct{ instructions []DeserializedInstruction }

func (c Control) String() string       { return fmt.Sprintf("c%d", c.idx) }
func (s StackRegister) String() string { return fmt.Sprintf("s%d", s.idx) }
func (d DecompiledCode) String() string {
	builder := strings.Builder{}
	for _, instruction := range d.instructions {
		builder.WriteString(fmt.Sprintf("%s\n", instruction))
	}
	return builder.String()
}

type DecompiledMethod struct {
	id           uint64
	instructions []DeserializedInstruction
}

type DecompiledDict struct {
	methods []DecompiledMethod
}

type DeserializedInstruction struct {
	name  string
	instr *spec.Instruction // null, if it is pseudo `ref` instruction
	args  []any             // see formatArg for actual types
}

func (d DeserializedInstruction) String() string {
	return d.Print(0)
}

func (d DeserializedInstruction) Print(depth int) string {
	indent := strings.Repeat("    ", depth)
	builder := strings.Builder{}

	builder.WriteString(indent)
	builder.WriteString(normalizeName(d.name))
	builder.WriteString(" ")

	for i, arg := range d.args {
		builder.WriteString(formatArg(arg, depth))
		if i < len(d.args)-1 {
			builder.WriteString(" ")
		}
	}

	return strings.TrimRight(builder.String(), " ")
}

// normalizeName converts TVM instruction names to readable format.
// Some instructions in the specification have special notations (#, prefix 2).
func normalizeName(name string) string {
	if strings.HasPrefix(name, "2") {
		return name[1:] + "2"
	}
	return strings.ReplaceAll(name, "#", "_")
}

func formatArg(arg any, depth int) string {
	indent := strings.Repeat("    ", depth)
	switch v := arg.(type) {
	case int64, uint64:
		return fmt.Sprintf("%d", v)
	case Control, StackRegister, *big.Int:
		return fmt.Sprintf("%s", v)
	case *cell.Slice:
		return v.String()
	case DecompiledCode:
		builder := strings.Builder{}
		builder.WriteString("{\n")
		for _, instruction := range v.instructions {
			builder.WriteString(instruction.Print(depth + 1))
			builder.WriteString("\n")
		}
		builder.WriteString(indent)
		builder.WriteString("}")
		return builder.String()
	case DecompiledDict:
		builder := strings.Builder{}
		builder.WriteString("[\n")
		for _, method := range v.methods {
			builder.WriteString(indent)
			builder.WriteString(fmt.Sprintf("    %d => {\n", method.id))
			for _, instruction := range method.instructions {
				builder.WriteString(instruction.Print(depth + 2))
				builder.WriteString("\n")
			}
			builder.WriteString("    ")
			builder.WriteString(indent)
			builder.WriteString("}\n")
		}
		builder.WriteString(indent)
		builder.WriteString("]")
		return builder.String()
	default:
		log.Fatalf("unhandled value: %v", v)
		return ""
	}
}

const maxOpcodeBits = 24

type instructionWithRange struct {
	min   int64
	max   int64
	instr *spec.Instruction
}

type loaderFunc func(slice *cell.Slice) DeserializedInstruction

var load = loaderFunc(nil)

// loadSlice loads a TVM slice according to specification.
// In TVM, slices contain data followed by a completion tag (bit 1)
// and optionally padding zeros. Function trims trailing zeros and completion tag.
func loadSlice(slice *cell.Slice, arg spec.Arg) *cell.Slice {
	// Determine the number of references in the slice
	countRefs := uint64(0)
	// Refs length can be zero if slice doesn't have any references
	if *arg.Refs.Len != 0 {
		countRefs = slice.MustLoadUInt(uint(*arg.Refs.Len))
	}

	// Calculate slice length in bits: data + padding
	y := slice.MustLoadUInt(uint(*arg.Bits.Len))
	realLength := int64(y*8 + uint64(*arg.Pad))
	r := slice.MustLoadSlice(uint(realLength))

	// Find completion tag (first 1 bit from the end) and trim everything after it
	var length uint64
	for i := realLength - 1; i >= 0; i-- {
		byteIdx := i / 8
		dataByte := r[byteIdx]
		bitShift := i % 8
		// Check bit in big-endian order (MSB first)
		bit := dataByte & (1 << (8 - bitShift))
		if bit == 0 {
			continue
		}
		// Found completion tag, trim everything after it (including the tag)
		length = uint64(i - 1)
		break
	}

	newSlice := cell.Builder{}
	newSlice.MustStoreSlice(r, uint(length))
	for i := uint64(0); i < countRefs; i++ {
		newSlice.MustStoreRef(slice.MustLoadRef().MustToCell())
	}
	return newSlice.ToSlice()
}

// loader creates a function to parse TVM instructions based on specification.
// TVM instructions have opcode ranges. Function builds a sorted list
// of ranges for efficient instruction lookup by opcode.
func loader(instructions []spec.Instruction) loaderFunc {
	var instructionRanges []instructionWithRange
	for _, instr := range instructions {
		instructionRanges = append(instructionRanges, instructionWithRange{
			min:   instr.Layout.Min,
			max:   instr.Layout.Max,
			instr: &instr,
		})
	}

	var list []instructionWithRange
	topOpcode := int64(1 << maxOpcodeBits)
	slices.SortFunc(instructionRanges, func(a, b instructionWithRange) int {
		return int(a.min - b.min)
	})

	upto := int64(0)
	for _, instr := range instructionRanges {
		if instr.min >= instr.max || instr.min < upto || instr.max > topOpcode {
			panic("instruction list is invalid")
		}
		if upto < instr.min {
			// Fill gaps with dummy instructions for continuous opcode range
			list = append(list, instructionWithRange{min: upto, max: instr.min, instr: nil})
		}
		list = append(list, instr)
		upto = instr.max
	}

	if upto < topOpcode {
		list = append(list, instructionWithRange{min: upto, max: topOpcode, instr: nil})
	}

	return func(slice *cell.Slice) DeserializedInstruction {
		// Preload 24 bits of opcode, since opcode can be up to 24 bits
		bits := min(slice.BitsLeft(), maxOpcodeBits)
		// If there are less than 24 bits left (last instruction), align the opcode to 24 bits
		opcode := slice.MustPreloadUInt(bits) << (maxOpcodeBits - bits)

		i := 0
		j := len(list)

		for j-i > 1 {
			k := (j + i) >> 1
			if k >= len(list) {
				break
			}
			kElement := list[k]
			if kElement.min <= int64(opcode) {
				i = k
			} else {
				j = k
			}
		}

		instr := list[i]
		if instr.instr == nil {
			panic("instruction is invalid")
		}
		layout := instr.instr.Layout

		slice.MustLoadUInt(uint(layout.CheckLen)) // skip opcode, we already know an instruction

		var args []any

		switch layout.Args.Empty {
		case spec.SimpleArgs:
			for _, child := range layout.Args.Children {
				switch child.Empty {
				case "delta":
					switch child.Arg.Empty {
					case "uint":
						args = append(args, slice.MustLoadUInt(uint(*child.Arg.Len))+uint64(*child.Delta))
					case "int":
						args = append(args, slice.MustLoadInt(uint(*child.Arg.Len))+int64(*child.Delta))
					case "stack":
						args = append(args, StackRegister{idx: slice.MustLoadInt(4) + int64(*child.Delta)})
					}
				case "int":
					args = append(args, slice.MustLoadInt(uint(*child.Len)))
				case "uint":
					args = append(args, slice.MustLoadUInt(uint(*child.Len)))
				case "tinyInt":
					args = append(args, ((int64(slice.MustLoadUInt(4))+5)&15)-5)
				case "largeInt":
					y := slice.MustLoadUInt(5)
					args = append(args, slice.MustLoadBigUInt(uint(3+((y&31)+2)*8)))
				case "plduzArg":
					args = append(args, ((slice.MustLoadUInt(3)&7)+1)<<5)
				case "control":
					args = append(args, Control{idx: slice.MustLoadUInt(4)})
				case "stack":
					args = append(args, StackRegister{idx: int64(slice.MustLoadUInt(4))})
				case "s1":
					args = append(args, StackRegister{idx: 1})
				case "minusOne":
					args = append(args, -1)
				case "hash":
					args = append(args, slice.MustLoadUInt(8))
				case "runvmArg":
					args = append(args, slice.MustLoadUInt(12))
				case "refCodeSlice":
					val, _ := slice.LoadRefCell()
					args = append(args, decompileCell(val))
				case "inlineCodeSlice":
					y := slice.MustLoadUInt(uint(*child.Bits.Len))
					realLength := y * 8
					r := slice.MustLoadSlice(uint(realLength))
					sliceBuilder := cell.Builder{}
					sliceBuilder.MustStoreSlice(r, uint(realLength))
					args = append(args, decompileCell(sliceBuilder.EndCell()))
				case "codeSlice":
					countRefs := slice.MustLoadUInt(uint(*child.Refs.Len))
					y := slice.MustLoadUInt(uint(*child.Bits.Len))
					realLength := y * 8
					r := slice.MustLoadSlice(uint(realLength))
					sliceBuilder := cell.Builder{}
					sliceBuilder.MustStoreSlice(r, uint(realLength))
					for i := uint64(0); i < countRefs; i++ {
						sliceBuilder.MustStoreRef(slice.MustLoadRef().MustToCell())
					}
					args = append(args, decompileCell(sliceBuilder.EndCell()))
				case "slice":
					args = append(args, loadSlice(slice, child))
				case "debugstr":
					y := slice.MustLoadUInt(4)
					realLength := (y + 1) * 8
					r := slice.MustLoadSlice(uint(realLength))
					sliceBuilder := cell.Builder{}
					sliceBuilder.MustStoreSlice(r, uint(realLength))
					args = append(args, sliceBuilder.ToSlice())
				default:
					log.Fatalf("unhandled type of arg: %v", child)
				}
			}
		case spec.Dictpush:
			keyLength := slice.MustLoadUInt(10)
			dictCell, _ := slice.LoadRefCell()
			dict := dictCell.AsDict(uint(keyLength))
			all, _ := dict.LoadAll()

			methods := make([]DecompiledMethod, 0, len(all))
			for _, kv := range all {
				id := kv.Key.MustLoadUInt(uint(keyLength))
				code := decompileCell(kv.Value.MustToCell())
				methods = append(methods, DecompiledMethod{id, code.instructions})
			}

			args = append(args, keyLength, DecompiledDict{methods})
		}

		return DeserializedInstruction{
			name:  instr.instr.Name,
			instr: instr.instr,
			args:  args,
		}
	}
}
