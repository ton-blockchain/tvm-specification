// Code generated from JSON Schema using quicktype. DO NOT EDIT.
// To parse and unparse this JSON data, add this code to your project and do:
//
//    specification, err := UnmarshalSpecification(bytes)
//    bytes, err = specification.Marshal()

package spec

import "bytes"
import "errors"

import "encoding/json"

func UnmarshalSpecification(data []byte) (Specification, error) {
	var r Specification
	err := json.Unmarshal(data, &r)
	return r, err
}

func (r *Specification) Marshal() ([]byte, error) {
	return json.Marshal(r)
}

type Specification struct {
	Schema           string            `json:"$schema"`
	FiftInstructions []FiftInstruction `json:"fift_instructions"`
	Instructions     []Instruction     `json:"instructions"`
	Version          string            `json:"version"`
}

// Represents a Fift instruction with its actual TVM instruction name and arguments
type FiftInstruction struct {
	// The actual TVM instruction name
	ActualName                                          string         `json:"actual_name"`
	// List of arguments for the instruction
	Arguments                                           []FiftArgument `json:"arguments,omitempty"`
	// Optional description of what the instruction does
	Description                                         *string        `json:"description,omitempty"`
	// The unique name of the Fift instruction
	Name                                                string         `json:"name"`
}

// Represents a TVM instruction with its properties, layout, effects and signature
type Instruction struct {
	// Main category of the instruction (e.g. stack_basic, cont_loops, dict_get)
	Category                                                                    string                    `json:"category"`
	ControlFlow                                                                 *ControlFlowOfInstruction `json:"control_flow,omitempty"`
	Description                                                                 Description               `json:"description"`
	// List of side effects that this instruction may have
	Effects                                                                     []string                  `json:"effects,omitempty"`
	Implementation                                                              *ImplementationInfo       `json:"implementation,omitempty"`
	Layout                                                                      Layout                    `json:"layout"`
	// The unique name of the instruction
	Name                                                                        string                    `json:"name"`
	Signature                                                                   *InstructionSignature     `json:"signature,omitempty"`
	// Sub-category for more specific grouping of instructions
	SubCategory                                                                 string                    `json:"sub_category"`
}

// Information related to current cc modification by instruction
type ControlFlowOfInstruction struct {
	// Array of current continuation possible values after current instruction execution
	Branches                                                                            []Continuation `json:"branches"`
}

// Values of saved control flow registers c0-c3
type ContinuationSavelist struct {
	C0 *Continuation `json:"c0,omitempty"`
	C1 *Continuation `json:"c1,omitempty"`
	C2 *Continuation `json:"c2,omitempty"`
	C3 *Continuation `json:"c3,omitempty"`
}

type Args struct {
	After *Continuation `json:"after,omitempty"`
	Body  *Continuation `json:"body,omitempty"`
	Cond  *Continuation `json:"cond,omitempty"`
	Count *string       `json:"count,omitempty"`
	Next  *Continuation `json:"next,omitempty"`
	Value *int64        `json:"value,omitempty"`
}

// Description of a continuation with static savelist
type Continuation struct {
	Save    *ContinuationSavelist `json:"save,omitempty"`
	Type    ContinuationType      `json:"type"`
	VarName *string               `json:"var_name,omitempty"`
	Index   *int64                `json:"index,omitempty"`
	Args    *Args                 `json:"args,omitempty"`
	Name    *ContinuationName     `json:"name,omitempty"`
}

// Detailed description of an instruction including documentation, examples and related
// information
type Description struct {
	// List of documentation links related to this instruction
	DocsLinks                                                      []DocsLink            `json:"docs_links,omitempty"`
	// List of examples showing how to use this instruction
	Examples                                                       []Example             `json:"examples,omitempty"`
	// List of possible exit codes and their conditions
	ExitCodes                                                      []ExitCode            `json:"exit_codes,omitempty"`
	// List of gas consumption entries for this instruction
	Gas                                                            []GasConsumptionEntry `json:"gas,omitempty"`
	// Detailed description of the instruction's functionality
	Long                                                           string                `json:"long"`
	// List of operand names
	Operands                                                       []string              `json:"operands"`
	// List of alternative implementations of this instruction
	OtherImplementations                                           []OtherImplementation `json:"other_implementations,omitempty"`
	// List of instructions that are related or similar to this one
	RelatedInstructions                                            []string              `json:"related_instructions,omitempty"`
	// Brief one-line description of the instruction
	Short                                                          string                `json:"short"`
	// List of tags for categorizing and searching instructions
	Tags                                                           []string              `json:"tags,omitempty"`
}

// Represents a link to documentation with name and URL
type DocsLink struct {
	// Display name for the documentation link
	Name                                      string `json:"name"`
	// URL to the documentation
	URL                                       string `json:"url"`
}

// Example of instruction usage with stack state and execution result
type Example struct {
	// Exit code of the example execution
	ExitCode                               *float64             `json:"exit_code,omitempty"`
	// List of instructions in this example
	Instructions                           []ExampleInstruction `json:"instructions"`
	Stack                                  ExampleStack         `json:"stack"`
}

// Single instruction in an example with optional comment and main flag
type ExampleInstruction struct {
	// Optional comment explaining the instruction
	Comment                                                   *string `json:"comment,omitempty"`
	// Instruction text or mnemonic
	Instruction                                               string  `json:"instruction"`
	// Whether this is the main instruction being demonstrated
	IsMain                                                    *bool   `json:"is_main,omitempty"`
}

// Stack state before and after instruction execution
type ExampleStack struct {
	// Stack state before instruction execution
	Input                                      []string `json:"input"`
	// Stack state after instruction execution
	Output                                     []string `json:"output"`
}

// Represents an instruction exit code and its condition
type ExitCode struct {
	// Condition that triggers this exit code
	Condition                                string `json:"condition"`
	// Exit code number
	Errno                                    string `json:"errno"`
}

// Represents gas consumption for an instruction with value and description
type GasConsumptionEntry struct {
	// Description of the gas consumption
	Description                                    string  `json:"description"`
	// Optional formula for dynamic gas calculation
	Formula                                        *string `json:"formula,omitempty"`
	// The gas consumption value
	Value                                          float64 `json:"value"`
}

// Alternative implementation of an instruction using other instructions
type OtherImplementation struct {
	// Whether this implementation exactly matches the original instruction's behavior
	Exact                                                                             bool     `json:"exact"`
	// List of instructions that implement the same functionality
	Instructions                                                                      []string `json:"instructions"`
}

// Information about the C++ implementation of the instruction in TON repository
type ImplementationInfo struct {
	// Git commit hash of the TON repository
	CommitHash                                               string  `json:"commit_hash"`
	// Path to the C++ file containing the implementation
	FilePath                                                 string  `json:"file_path"`
	// Name of the C++ function implementing this instruction
	FunctionName                                             string  `json:"function_name"`
	// Line number where the function is defined
	LineNumber                                               float64 `json:"line_number"`
}

// Information about instruction's bytecode layout and execution
type Layout struct {
	Args                                                 LayoutArgs `json:"args"`
	CheckLen                                             float64    `json:"checkLen"`
	Exec                                                 string     `json:"exec"`
	// Type of instruction layout format
	Kind                                                 Kind       `json:"kind"`
	// Maximum value for instruction operand range
	Max                                                  float64    `json:"max"`
	// Minimum value for instruction operand range
	Min                                                  float64    `json:"min"`
	// Numeric value of instruction prefix
	Prefix                                               float64    `json:"prefix"`
	// String representation of instruction prefix in hex
	PrefixStr                                            string     `json:"prefix_str"`
	SkipLen                                              float64    `json:"skipLen"`
	// TLB schema of the instruction
	Tlb                                                  string     `json:"tlb"`
	Version                                              *float64   `json:"version,omitempty"`
}

// Arguments structure for instruction operands
type LayoutArgs struct {
	// Type of arguments structure
	Empty                               ArgsEnum  `json:"$"`
	// List of child argument structures
	Children                            []Child   `json:"children,omitempty"`
	Range                               *ArgRange `json:"range,omitempty"`
}

// Child argument structure with its properties
type Child struct {
	// Type identifier for the child argument
	Empty                                    string    `json:"$"`
	Arg                                      *Arg      `json:"arg,omitempty"`
	Bits                                     *Arg      `json:"bits,omitempty"`
	Delta                                    *float64  `json:"delta,omitempty"`
	// Length of the argument in bits
	Len                                      *float64  `json:"len,omitempty"`
	Pad                                      *float64  `json:"pad,omitempty"`
	Range                                    *ArgRange `json:"range,omitempty"`
	Refs                                     *Refs     `json:"refs,omitempty"`
}

type Arg struct {
	Empty                            Bits     `json:"$"`
	// Length of the argument in bits
	Len                              float64  `json:"len"`
	Range                            ArgRange `json:"range"`
}

type ArgRange struct {
	Max string `json:"max"`
	Min string `json:"min"`
}

type Refs struct {
	Empty string    `json:"$"`
	Arg   *Arg      `json:"arg,omitempty"`
	Count *float64  `json:"count,omitempty"`
	Delta *float64  `json:"delta,omitempty"`
	Len   *float64  `json:"len,omitempty"`
	Range *ArgRange `json:"range,omitempty"`
}

// Information related to usage of stack and registers by instruction. If omitted, exact
// signature is not available.
type InstructionSignature struct {
	Inputs      *InstructionInputs  `json:"inputs,omitempty"`
	Outputs     *InstructionOutputs `json:"outputs,omitempty"`
	StackString *string             `json:"stack_string,omitempty"`
}

// Incoming values constraints.
type InstructionInputs struct {
	Registers []Register   `json:"registers,omitempty"`
	Stack     []StackEntry `json:"stack,omitempty"`
}

// Represents read/write access to a register
type Register struct {
	Index   *float64      `json:"index,omitempty"`
	Type    RegisterType  `json:"type"`
	VarName *string       `json:"var_name,omitempty"`
	Name    *RegisterName `json:"name,omitempty"`
}

type MatchArm struct {
	Stack []StackEntry `json:"stack"`
	Value float64      `json:"value"`
}

// Stack constraints. Top of stack is the last value.
//
// Representation of stack entry or group of stack entries
type StackEntry struct {
	Mutations                                                                                []Mutation          `json:"mutations,omitempty"`
	Name                                                                                     *string             `json:"name,omitempty"`
	Presentation                                                                             *string             `json:"presentation,omitempty"`
	// Optional range constraint for the value, specifying minimum and maximum allowed values
	Range                                                                                    *Range              `json:"range,omitempty"`
	Type                                                                                     StackEntryType      `json:"type"`
	ValueTypes                                                                               []PossibleValueType `json:"value_types,omitempty"`
	Value                                                                                    *ConstantValue      `json:"value"`
	ValueType                                                                                *ConstantType       `json:"value_type,omitempty"`
	Else                                                                                     []StackEntry        `json:"else,omitempty"`
	Match                                                                                    []MatchArm          `json:"match,omitempty"`
	ArrayEntry                                                                               []StackEntry        `json:"array_entry,omitempty"`
	LengthVar                                                                                *string             `json:"length_var,omitempty"`
}

type Mutation struct {
	Length Length `json:"length"`
}

type Length struct {
	AmountArg      *float64 `json:"amount_arg,omitempty"`
	StackAmountArg *float64 `json:"stack_amount_arg,omitempty"`
}

// Optional range constraint for the value, specifying minimum and maximum allowed values
//
// Represents a numeric range with minimum and maximum values
type Range struct {
	// Maximum allowed value (inclusive)
	Max                                 float64 `json:"max"`
	// Minimum allowed value (inclusive)
	Min                                 float64 `json:"min"`
}

// Outgoing values constraints.
type InstructionOutputs struct {
	Registers []Register   `json:"registers,omitempty"`
	Stack     []StackEntry `json:"stack,omitempty"`
}

type ContinuationName string

const (
	Again   ContinuationName = "again"
	Pushint ContinuationName = "pushint"
	Repeat  ContinuationName = "repeat"
	Until   ContinuationName = "until"
	While   ContinuationName = "while"
)

type ContinuationType string

const (
	Cc             ContinuationType = "cc"
	PurpleSpecial  ContinuationType = "special"
	PurpleVariable ContinuationType = "variable"
	TypeRegister   ContinuationType = "register"
)

type Bits string

const (
	Stack Bits = "stack"
	Uint  Bits = "uint"
)

// Type of arguments structure
type ArgsEnum string

const (
	Dictpush   ArgsEnum = "dictpush"
	SimpleArgs ArgsEnum = "simpleArgs"
	XchgArgs   ArgsEnum = "xchgArgs"
)

// Type of instruction layout format
type Kind string

const (
	EXT        Kind = "ext"
	EXTRange   Kind = "ext-range"
	Fixed      Kind = "fixed"
	FixedRange Kind = "fixed-range"
	KindSimple Kind = "simple"
)

type RegisterName string

const (
	Cstate RegisterName = "cstate"
	Gas    RegisterName = "gas"
	R      RegisterName = "r"
)

type RegisterType string

const (
	Constant       RegisterType = "constant"
	FluffySpecial  RegisterType = "special"
	FluffyVariable RegisterType = "variable"
)

type StackEntryType string

const (
	Array       StackEntryType = "array"
	Conditional StackEntryType = "conditional"
	Const       StackEntryType = "const"
	TypeSimple  StackEntryType = "simple"
)

type ConstantType string

const (
	ConstantTypeInt  ConstantType = "Int"
	ConstantTypeNull ConstantType = "Null"
)

type PossibleValueType string

const (
	Any                           PossibleValueType = "Any"
	Bool                          PossibleValueType = "Bool"
	Builder                       PossibleValueType = "Builder"
	Cell                          PossibleValueType = "Cell"
	PossibleValueTypeContinuation PossibleValueType = "Continuation"
	PossibleValueTypeInt          PossibleValueType = "Int"
	PossibleValueTypeNull         PossibleValueType = "Null"
	Slice                         PossibleValueType = "Slice"
	Tuple                         PossibleValueType = "Tuple"
)

// Argument for a Fift instruction
type FiftArgument struct {
	Double *float64
	String *string
}

func (x *FiftArgument) UnmarshalJSON(data []byte) error {
	object, err := unmarshalUnion(data, nil, &x.Double, nil, &x.String, false, nil, false, nil, false, nil, false, nil, false)
	if err != nil {
		return err
	}
	if object {
	}
	return nil
}

func (x *FiftArgument) MarshalJSON() ([]byte, error) {
	return marshalUnion(nil, x.Double, nil, x.String, false, nil, false, nil, false, nil, false, nil, false)
}

type ConstantValue struct {
	Double *float64
	String *string
}

func (x *ConstantValue) UnmarshalJSON(data []byte) error {
	object, err := unmarshalUnion(data, nil, &x.Double, nil, &x.String, false, nil, false, nil, false, nil, false, nil, true)
	if err != nil {
		return err
	}
	if object {
	}
	return nil
}

func (x *ConstantValue) MarshalJSON() ([]byte, error) {
	return marshalUnion(nil, x.Double, nil, x.String, false, nil, false, nil, false, nil, false, nil, true)
}

func unmarshalUnion(data []byte, pi **int64, pf **float64, pb **bool, ps **string, haveArray bool, pa interface{}, haveObject bool, pc interface{}, haveMap bool, pm interface{}, haveEnum bool, pe interface{}, nullable bool) (bool, error) {
	if pi != nil {
		*pi = nil
	}
	if pf != nil {
		*pf = nil
	}
	if pb != nil {
		*pb = nil
	}
	if ps != nil {
		*ps = nil
	}

	dec := json.NewDecoder(bytes.NewReader(data))
	dec.UseNumber()
	tok, err := dec.Token()
	if err != nil {
		return false, err
	}

	switch v := tok.(type) {
	case json.Number:
		if pi != nil {
			i, err := v.Int64()
			if err == nil {
				*pi = &i
				return false, nil
			}
		}
		if pf != nil {
			f, err := v.Float64()
			if err == nil {
				*pf = &f
				return false, nil
			}
			return false, errors.New("Unparsable number")
		}
		return false, errors.New("Union does not contain number")
	case float64:
		return false, errors.New("Decoder should not return float64")
	case bool:
		if pb != nil {
			*pb = &v
			return false, nil
		}
		return false, errors.New("Union does not contain bool")
	case string:
		if haveEnum {
			return false, json.Unmarshal(data, pe)
		}
		if ps != nil {
			*ps = &v
			return false, nil
		}
		return false, errors.New("Union does not contain string")
	case nil:
		if nullable {
			return false, nil
		}
		return false, errors.New("Union does not contain null")
	case json.Delim:
		if v == '{' {
			if haveObject {
				return true, json.Unmarshal(data, pc)
			}
			if haveMap {
				return false, json.Unmarshal(data, pm)
			}
			return false, errors.New("Union does not contain object")
		}
		if v == '[' {
			if haveArray {
				return false, json.Unmarshal(data, pa)
			}
			return false, errors.New("Union does not contain array")
		}
		return false, errors.New("Cannot handle delimiter")
	}
	return false, errors.New("Cannot unmarshal union")
}

func marshalUnion(pi *int64, pf *float64, pb *bool, ps *string, haveArray bool, pa interface{}, haveObject bool, pc interface{}, haveMap bool, pm interface{}, haveEnum bool, pe interface{}, nullable bool) ([]byte, error) {
	if pi != nil {
		return json.Marshal(*pi)
	}
	if pf != nil {
		return json.Marshal(*pf)
	}
	if pb != nil {
		return json.Marshal(*pb)
	}
	if ps != nil {
		return json.Marshal(*ps)
	}
	if haveArray {
		return json.Marshal(pa)
	}
	if haveObject {
		return json.Marshal(pc)
	}
	if haveMap {
		return json.Marshal(pm)
	}
	if haveEnum {
		return json.Marshal(pe)
	}
	if nullable {
		return json.Marshal(nil)
	}
	return nil, errors.New("Union must not be null")
}
