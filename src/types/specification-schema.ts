import type {InstructionSignature} from "./stack-signatures-schema"

export interface Specification {
    readonly $schema: string
    readonly version: string
    readonly instructions: Record<string, Instruction>
    readonly fift_instructions: Record<string, FiftInstruction>
}

export type FiftArgument = number | string

export interface FiftInstruction {
    readonly actual_name: string
    readonly arguments: readonly FiftArgument[]
    readonly description: string
}

export interface Instruction {
    readonly category: string
    readonly sub_category: string
    readonly description: Description
    readonly layout: Layout
    readonly effects?: readonly string[]
    readonly signature: InstructionSignature
}

export interface ExitCode {
    readonly errno: string
    readonly condition: string
}

export interface OtherImplementation {
    readonly exact: boolean
    readonly instructions: readonly string[]
}

export interface ExampleInstruction {
    readonly instruction: string
    readonly comment?: string
    readonly is_main?: boolean
}

export interface ExampleStack {
    readonly input: readonly string[]
    readonly output: readonly string[]
}

export interface Example {
    readonly instructions: readonly ExampleInstruction[]
    readonly stack: ExampleStack
    readonly exit_code?: number
}

export interface Description {
    readonly short: string
    readonly long: string
    readonly tags: readonly string[]
    readonly operands: readonly string[]
    readonly exit_codes?: readonly ExitCode[]
    readonly other_implementations?: readonly OtherImplementation[]
    readonly related_instructions?: readonly string[]
    readonly examples?: readonly Example[]
}

export interface Layout {
    readonly min: number
    readonly max: number
    readonly checkLen: number
    readonly skipLen: number
    readonly args: Args
    readonly exec: string
    readonly kind: "ext" | "ext-range" | "fixed" | "fixed-range" | "simple"
    readonly prefix: number
    readonly prefix_str: string
    readonly version?: number
}

export interface Args {
    readonly $: "dictpush" | "simpleArgs" | "xchgArgs"
    readonly children?: readonly Child[]
    readonly range?: ArgRange
}

export interface Child {
    readonly $: string
    readonly len?: number
    readonly range?: ArgRange
    readonly delta?: number
    readonly arg?: Arg
    readonly refs?: Refs
    readonly bits?: Arg
    readonly pad?: number
}

export interface Arg {
    readonly $: "stack" | "uint"
    readonly len: number
    readonly range: ArgRange
}

export interface ArgRange {
    readonly min: string
    readonly max: string
}

export interface Refs {
    readonly $: string
    readonly count?: number
    readonly delta?: number
    readonly arg?: Arg
    readonly len?: number
    readonly range?: ArgRange
}
