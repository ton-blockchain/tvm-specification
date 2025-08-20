import * as fs from "node:fs"
import {
    Description,
    Instruction,
    Layout,
    Specification,
    InstructionSignature,
    FiftInstruction,
    ControlFlowOfInstruction,
} from "../types"
import {instructions, signatureString} from "../instructions"

export interface InstructionEntry {
    readonly name?: string
    readonly description: Description
    readonly signature: InstructionSignature
    readonly control_flow?: ControlFlowOfInstruction
}

const main = () => {
    const entries: Record<string, InstructionEntry> = {}

    const files = fs.readdirSync(`${__dirname}/../../data`)

    for (const filename of files) {
        if (filename === "fift") continue

        const descriptions = JSON.parse(
            fs.readFileSync(`${__dirname}/../../data/${filename}`, "utf8"),
        ) as Record<string, InstructionEntry>

        for (const [name, desc] of Object.entries(descriptions)) {
            entries[name] = desc
        }
    }

    const allInstructions: Record<string, Instruction> = {}

    for (const [name, opcode] of Object.entries(instructions)) {
        if (name.startsWith("f") || name.startsWith("PSEUDO") || name === "DEBUGMARK") {
            continue
        }

        const instr = entries[name]
        if (!instr) {
            throw new Error(`no description for ${name}`)
        }

        const signature = instr.signature
        const signatureStr = signature ? signatureString(signature) : ""

        const layout: Layout = {
            ...opcode,
            // @ts-ignore
            category: undefined,
            subCategory: undefined,
            effects: undefined,
            prefix_str: opcode.prefix.toString(16).toUpperCase(),
        }
        allInstructions[name] = {
            category: opcode.category,
            sub_category: opcode.subCategory,
            description: instr.description,
            layout: layout,
            effects: opcode.effects?.map(it => it.$),
            signature: signature
                ? {
                      stack_string: signatureStr,
                      ...signature,
                  }
                : {},
            control_flow: instr.control_flow,
        }
    }

    const fiftInstructions = JSON.parse(
        fs.readFileSync(`${__dirname}/../../data/fift/fift-instructions.json`, "utf8"),
    ) as Record<string, FiftInstruction>

    validateFiftInstructions(fiftInstructions, allInstructions)

    const version = JSON.parse(fs.readFileSync(`${__dirname}/../../package.json`, "utf8")).version

    const spec: Specification = {
        $schema: "./schema.json",
        version,
        instructions: allInstructions,
        fift_instructions: fiftInstructions,
    }

    const bigintReplacer = () => (_key: unknown, value: unknown) => {
        if (typeof value === "bigint") {
            return value.toString()
        }
        return value
    }

    fs.writeFileSync(
        `${__dirname}/../../gen/tvm-specification.json`,
        JSON.stringify(spec, bigintReplacer(), 2),
    )
}

const validateFiftInstructions = (
    fiftInstructions: Record<string, FiftInstruction>,
    allInstructions: Record<string, Instruction>,
) => {
    for (const [name, instr] of Object.entries(fiftInstructions)) {
        if (Object.keys(instructions).includes(name)) {
            throw new Error(`Alias name ${name} is actual instruction name`)
        }

        if (instr.actual_name === "none") continue

        if (!Object.keys(instructions).includes(instr.actual_name)) {
            throw new Error(`Aliased instruction ${instr.actual_name} doesn't exist`)
        }

        const aliasedInstr = allInstructions[instr.actual_name]
        if (!aliasedInstr) {
            throw new Error(`Aliased instruction ${instr.actual_name} doesn't exist`)
        }

        if (instr.arguments) {
            if (instr.arguments.length !== aliasedInstr.description.operands.length) {
                throw new Error(
                    `Count operands mismatch for ${name}:\n  alias: ${instr.arguments.length}\n  instr: ${aliasedInstr.description.operands.length}`,
                )
            }
        }
    }
}

void main()
